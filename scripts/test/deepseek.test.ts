import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DeepSeekError,
  DeepSeekInputLimitError,
  DeepSeekNotConfiguredError,
  generateReply,
} from "../../lib/rag/src/deepseek.ts";
import { getChatModelName } from "../../lib/rag/src/config.ts";

const envNames = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_MAX_INPUT_TOKENS",
  "DEEPSEEK_MAX_OUTPUT_TOKENS",
] as const;

async function withProviderStub<T>(
  env: Partial<Record<(typeof envNames)[number], string | undefined>>,
  fetcher: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const oldFetch = globalThis.fetch;
  for (const name of envNames) {
    const value = env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = fetcher;
  try {
    return await run();
  } finally {
    for (const name of envNames) {
      const value = oldEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    globalThis.fetch = oldFetch;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const turns = [{ role: "user" as const, text: "How do I build this skill?" }];

test("defaults chat model to the documented DeepSeek model", async () => {
  await withProviderStub({}, globalThis.fetch, async () => {
    assert.equal(getChatModelName(), "deepseek-flash");
  });
});

test("missing secret fails before any request", async () => {
  let calls = 0;
  await withProviderStub(
    { DEEPSEEK_API_KEY: "" },
    async () => {
      calls += 1;
      return jsonResponse(200, {});
    },
    async () => {
      await assert.rejects(
        generateReply({ systemInstruction: "Be helpful.", turns }),
        DeepSeekNotConfiguredError,
      );
      assert.equal(calls, 0);
    },
  );
});

test("sends the selected model and maps the completion without external traffic", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  let calls = 0;
  await withProviderStub(
    {
      DEEPSEEK_API_KEY: "unit-test-key",
      DEEPSEEK_MODEL: "deepseek-flash",
      DEEPSEEK_MAX_INPUT_TOKENS: "4000",
      DEEPSEEK_MAX_OUTPUT_TOKENS: "512",
    },
    async (input, init) => {
      calls += 1;
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse(200, {
        id: "local-test",
        object: "chat.completion",
        created: 1,
        model: "deepseek-flash",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "A grounded answer [1]." },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      });
    },
    async () => {
      const result = await generateReply({
        systemInstruction: "Use only the provided approved sources.",
        turns,
      });
      assert.equal(calls, 1);
      assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
      assert.equal(requestBody.model, "deepseek-flash");
      assert.equal(requestBody.max_tokens, 512);
      assert.equal(result.text, "A grounded answer [1].");
      assert.equal(result.promptTokens, 20);
      assert.equal(result.completionTokens, 8);
    },
  );
});

test("maps insufficient balance without retrying", async () => {
  let calls = 0;
  await withProviderStub(
    { DEEPSEEK_API_KEY: "unit-test-key" },
    async () => {
      calls += 1;
      return jsonResponse(402, { error: { message: "Insufficient balance" } });
    },
    async () => {
      await assert.rejects(
        generateReply({ systemInstruction: "Be helpful.", turns }),
        (err: unknown) => err instanceof DeepSeekError && err.status === 402,
      );
      assert.equal(calls, 1);
    },
  );
});

test("rejects an over-budget prompt before sending a request", async () => {
  let calls = 0;
  await withProviderStub(
    { DEEPSEEK_API_KEY: "unit-test-key", DEEPSEEK_MAX_INPUT_TOKENS: "1" },
    async () => {
      calls += 1;
      return jsonResponse(200, {});
    },
    async () => {
      await assert.rejects(
        generateReply({ systemInstruction: "Use the approved sources.", turns }),
        DeepSeekInputLimitError,
      );
      assert.equal(calls, 0);
    },
  );
});
