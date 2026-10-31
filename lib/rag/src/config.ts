import { EMBEDDING_DIMENSIONS } from "@workspace/db/schema";

/**
 * The single embedding configuration used for the knowledge base.
 * Stored as a row in `embedding_models`; every vector references this id.
 */
export const EMBEDDING_MODEL = {
  id: "gemini-embedding-001@768",
  provider: "google_gemini",
  modelName: "gemini-embedding-001",
  dimensions: EMBEDDING_DIMENSIONS,
  documentTaskType: "RETRIEVAL_DOCUMENT",
  queryTaskType: "RETRIEVAL_QUERY",
} as const;

/** DeepSeek chat model (env `DEEPSEEK_MODEL`). Verified in DeepSeek's API docs. */
export const DEFAULT_CHAT_MODEL = "deepseek-flash";

export function getChatModelName(): string {
  return process.env["DEEPSEEK_MODEL"]?.trim() || DEFAULT_CHAT_MODEL;
}

export function getDeepSeekApiKey(): string | null {
  const key = process.env["DEEPSEEK_API_KEY"]?.trim();
  return key ? key : null;
}

function positiveIntegerEnv(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

/** Conservative prompt budget: CJK code points count as one token, other chars as half. */
export function getMaxChatInputTokens(): number {
  return positiveIntegerEnv("DEEPSEEK_MAX_INPUT_TOKENS", 12_000, 64_000);
}

export function getMaxChatOutputTokens(): number {
  return positiveIntegerEnv("DEEPSEEK_MAX_OUTPUT_TOKENS", 1_200, 4_096);
}

/** The user's own Gemini API key (Replit Secret `GEMINI_API_KEY`), or null. */
export function getGeminiApiKey(): string | null {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  return key ? key : null;
}
