import OpenAI from "openai";
import {
  getChatModelName,
  getDeepSeekApiKey,
  getMaxChatInputTokens,
  getMaxChatOutputTokens,
} from "./config";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const REQUEST_TIMEOUT_MS = 30_000;

export type ChatTurn = { role: "user" | "model"; text: string };

export type GenerateResult = {
  text: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

export class DeepSeekError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export class DeepSeekNotConfiguredError extends DeepSeekError {
  constructor() {
    super("DEEPSEEK_API_KEY is not configured.");
    this.name = "DeepSeekNotConfiguredError";
  }
}

export class DeepSeekInputLimitError extends DeepSeekError {
  constructor() {
    super("The chat context exceeds the configured input limit. Start a new chat or shorten the question.");
    this.name = "DeepSeekInputLimitError";
  }
}

/**
 * A deliberately conservative estimate for mixed Latin/CJK text. This is a
 * budget guard, not a replacement for provider-reported token counts.
 */
export function estimateInputTokens(text: string): number {
  let estimate = 0;
  for (const char of text) {
    if (/\p{Script=Han}/u.test(char)) estimate += 1;
    else if (/\s/u.test(char)) estimate += 0.25;
    else estimate += 0.5;
  }
  return Math.ceil(estimate);
}

function buildMessages(systemInstruction: string, turns: ChatTurn[]) {
  return [
    { role: "system" as const, content: systemInstruction },
    ...turns.map((turn) => ({
      role: turn.role === "model" ? ("assistant" as const) : ("user" as const),
      content: turn.text,
    })),
  ];
}

function messageTokens(messages: ReturnType<typeof buildMessages>): number {
  return messages.reduce((sum, message) => sum + estimateInputTokens(message.content), 0);
}

function providerStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Sends grounded chat turns to the official DeepSeek API via its OpenAI-compatible
 * endpoint. Automatic SDK retries are disabled so transient failures never
 * create unexpected duplicate billable requests.
 */
export async function generateReply(opts: {
  model?: string;
  systemInstruction: string;
  turns: ChatTurn[];
}): Promise<GenerateResult> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new DeepSeekNotConfiguredError();

  const turns = [...opts.turns];
  let messages = buildMessages(opts.systemInstruction, turns);
  const maxInputTokens = getMaxChatInputTokens();

  // Trim only old conversation context, never the current question or source evidence.
  while (turns.length > 1 && messageTokens(messages) > maxInputTokens) {
    turns.shift();
    if (turns[0]?.role === "model") turns.shift();
    messages = buildMessages(opts.systemInstruction, turns);
  }
  if (messageTokens(messages) > maxInputTokens) throw new DeepSeekInputLimitError();

  const client = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    fetch: globalThis.fetch,
  });

  try {
    const response = await client.chat.completions.create({
      model: opts.model ?? getChatModelName(),
      messages,
      temperature: 0.2,
      max_tokens: getMaxChatOutputTokens(),
      stream: false,
    });
    const text = response.choices[0]?.message.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new DeepSeekError("DeepSeek returned no answer text.");
    }
    return {
      text: text.trim(),
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
    };
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    const status = providerStatus(err);
    const reason = err instanceof Error ? err.message.slice(0, 300) : "Unknown DeepSeek API error";
    throw new DeepSeekError(
      status ? `DeepSeek API returned HTTP ${status}: ${reason}` : `DeepSeek request failed: ${reason}`,
      status,
    );
  }
}
