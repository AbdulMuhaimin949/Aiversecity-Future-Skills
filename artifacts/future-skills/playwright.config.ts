import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:25893",
    launchOptions: systemChromium ? { executablePath: systemChromium } : {},
  },
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      url: "http://127.0.0.1:8080/api/healthz",
      env: { PORT: "8080" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @workspace/future-skills run dev",
      url: "http://127.0.0.1:25893/",
      env: { PORT: "25893", BASE_PATH: "/" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
