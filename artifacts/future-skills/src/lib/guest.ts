import { setAuthTokenGetter } from "@workspace/api-client-react";

/**
 * Random guest token that identifies this browser to the career assistant.
 * The server stores only its hash; clearing site data starts a fresh history.
 */
const KEY = "afs.guestToken";

function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function ensureGuestToken(): string {
  const existing = readToken();
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  localStorage.setItem(KEY, token);
  return token;
}

setAuthTokenGetter(() => readToken());
