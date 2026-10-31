import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

// Load local secrets (LLM_API_KEY etc.) from the gitignored .env file.
if (existsSync(".env")) process.loadEnvFile(".env");

function freePorts(ports) {
  for (const port of ports) {
    try {
      const out = execSync(`/usr/sbin/lsof -ti tcp:${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (!out) continue;
      for (const pidStr of out.split(/\s+/)) {
        const pid = Number(pidStr);
        if (pid && pid !== process.pid) {
          try {
            process.kill(pid, "SIGKILL");
            console.log(`Freed port ${port} (stopped old process ${pid})`);
          } catch {
            // already exited
          }
        }
      }
    } catch {
      // nothing listening on port
    }
  }
}

freePorts([8080, 3000]);

await new Promise((r) => setTimeout(r, 400));

const children = [];

function start(name, args, extraEnv) {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

console.log("Starting Backend (port 8080) and Frontend (port 3000)...");
start("api-server", ["--filter", "@workspace/api-server", "run", "dev"], {
  PORT: "8080",
});
start("future-skills", ["--filter", "@workspace/future-skills", "run", "dev"], {
  PORT: "3000",
  BASE_PATH: "/",
});

function shutdown() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

