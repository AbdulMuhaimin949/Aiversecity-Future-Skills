import type { Request, RequestHandler } from "express";

/**
 * The web app identifies anonymous visitors with a random guest token sent as
 * `Authorization: Bearer <token>`. Clerk also reads the Authorization header
 * and, when it holds anything, ignores the session cookie, so a signed-in
 * reviewer would look signed out. This middleware runs before Clerk: it moves
 * a guest token (never a JWT, which contains dots) off the Authorization header
 * and keeps it for `guestToken(req)`.
 */
const GUEST_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const tokens = new WeakMap<Request, string>();

export const guestTokenMiddleware: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (GUEST_TOKEN.test(token)) {
      tokens.set(req, token);
      delete req.headers.authorization;
    }
  }
  next();
};

export function guestToken(req: Request): string | null {
  return tokens.get(req) ?? null;
}
