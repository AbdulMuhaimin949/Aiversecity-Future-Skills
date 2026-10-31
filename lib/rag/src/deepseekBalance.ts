import { getDeepSeekApiKey } from "./config";

export type DeepSeekAvailability = {
  configured: boolean;
  /** True only when DeepSeek's balance endpoint says the account can be used. */
  available: boolean;
  reason: "ok" | "no_key" | "insufficient_balance" | "key_rejected" | "unreachable";
};

let cache: { at: number; value: DeepSeekAvailability } | null = null;
const TTL_MS = 60_000;

/**
 * Read-only account check (GET /user/balance). It does not generate text and is
 * not billed. Cached for a minute so status polling does not hammer the API.
 */
export async function getDeepSeekAvailability(): Promise<DeepSeekAvailability> {
  const key = getDeepSeekApiKey();
  if (!key) return { configured: false, available: false, reason: "no_key" };
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: DeepSeekAvailability;
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) {
      value = { configured: true, available: false, reason: "key_rejected" };
    } else if (!res.ok) {
      value = { configured: true, available: false, reason: "unreachable" };
    } else {
      const body = (await res.json()) as { is_available?: boolean };
      value = body.is_available === true
        ? { configured: true, available: true, reason: "ok" }
        : { configured: true, available: false, reason: "insufficient_balance" };
    }
  } catch {
    value = { configured: true, available: false, reason: "unreachable" };
  }
  cache = { at: Date.now(), value };
  return value;
}
