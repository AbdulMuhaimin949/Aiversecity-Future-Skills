/**
 * Gemini client (official @google/genai SDK, Gemini Developer API) for
 * embeddings and grounded replies. Uses the user's own API key.
 */
import { ApiError, GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
import { EMBEDDING_MODEL, getGeminiApiKey } from "./config";

/** Texts per embedContent call. */
export const EMBED_BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export class GeminiNotConfiguredError extends GeminiError {
  constructor() {
    super("GEMINI_API_KEY is not set, so the Gemini API cannot be called.");
    this.name = "GeminiNotConfiguredError";
  }
}

let client: { key: string; ai: GoogleGenAI } | null = null;

function ai(): GoogleGenAI {
  const key = getGeminiApiKey();
  if (!key) throw new GeminiNotConfiguredError();
  if (client?.key !== key) {
    // Retries are handled below so Google's RetryInfo delay is honoured.
    client = { key, ai: new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } } }) };
  }
  return client.ai;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads Google's RetryInfo ("retryDelay": "12s") from an error message, if present. */
function retryDelayMs(message: string): number | null {
  const m = message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
  return m ? Math.ceil(Number.parseFloat(m[1]!) * 1000) : null;
}

/** Short reason from an ApiError whose message embeds the JSON error body. */
function apiMessage(err: ApiError): string {
  const m = err.message.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return (m?.[1] ?? err.message).slice(0, 300);
}

async function call<T>(fn: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  const client = ai();
  let lastError: GeminiError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn(client);
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      if (err instanceof ApiError) {
        lastError = new GeminiError(`Gemini API ${err.status}: ${apiMessage(err)}`, err.status);
        const retryable = err.status === 429 || err.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) break;
        await sleep(Math.min(retryDelayMs(err.message) ?? 2000 * 2 ** (attempt - 1), 65_000));
        continue;
      }
      lastError = new GeminiError(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(1000 * attempt);
    }
  }
  throw lastError ?? new GeminiError("Gemini request failed");
}

function normalise(values: number[]): number[] {
  // Gemini only normalises full 3072-d output; truncated vectors must be
  // normalised by the caller before cosine comparison.
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
  if (!norm) throw new GeminiError("Gemini returned a zero embedding vector");
  return values.map((v) => v / norm);
}

export type EmbedInput = { text: string; title?: string };

/**
 * Embeds up to EMBED_BATCH_SIZE texts in one call. Documents use
 * RETRIEVAL_DOCUMENT (title prefixed when the text lacks it); queries use
 * RETRIEVAL_QUERY.
 */
export async function embedBatch(
  inputs: EmbedInput[],
  kind: "document" | "query",
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  if (inputs.length > EMBED_BATCH_SIZE) {
    throw new GeminiError(`At most ${EMBED_BATCH_SIZE} texts per embedding batch`);
  }
  const taskType =
    kind === "document"
      ? EMBEDDING_MODEL.documentTaskType
      : EMBEDDING_MODEL.queryTaskType;
  const res = await call((c) =>
    c.models.embedContent({
      model: EMBEDDING_MODEL.modelName,
      // The SDK takes one title per call, so a missing document title is prefixed to the text instead.
      contents: inputs.map((i) => (kind === "document" && i.title && !i.text.includes(i.title) ? `${i.title}\n\n${i.text}` : i.text)),
      config: { taskType, outputDimensionality: EMBEDDING_MODEL.dimensions },
    }),
  );
  const embeddings = res.embeddings ?? [];
  if (embeddings.length !== inputs.length) {
    throw new GeminiError(
      `Gemini returned ${embeddings.length} embeddings for ${inputs.length} inputs`,
    );
  }
  return embeddings.map((e) => {
    const values = e.values ?? [];
    if (values.length !== EMBEDDING_MODEL.dimensions) {
      throw new GeminiError(
        `Expected ${EMBEDDING_MODEL.dimensions} dimensions, got ${values.length}`,
      );
    }
    return normalise(values);
  });
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedBatch([{ text }], "query");
  return vec!;
}

function thinkingFor(model: string): ThinkingConfig {
  return /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.LOW };
}

/**
 * Structured (JSON) output constrained by `responseSchema`. Returns the parsed
 * object; the caller must still validate every field it uses.
 */
export async function generateJson(opts: {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<{ data: unknown; promptTokens: number | null; completionTokens: number | null }> {
  const res = await call((c) =>
    c.models.generateContent({
      model: opts.model,
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: 0,
        maxOutputTokens: opts.maxOutputTokens ?? 2000,
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        thinkingConfig: thinkingFor(opts.model),
      },
    }),
  );
  if (res.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini blocked the request (${res.promptFeedback.blockReason})`);
  }
  const candidate = res.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    throw new GeminiError(`Gemini returned no output (finish reason: ${candidate?.finishReason ?? "unknown"})`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GeminiError(`Gemini returned invalid JSON (finish reason: ${candidate?.finishReason ?? "unknown"})`);
  }
  return {
    data,
    promptTokens: res.usageMetadata?.promptTokenCount ?? null,
    completionTokens: res.usageMetadata?.candidatesTokenCount ?? null,
  };
}
