/**
 * Anonymous guest identity for the career assistant.
 *
 * The browser keeps a random 256-bit token and sends it as
 * `Authorization: Bearer <token>`. Only its SHA-256 hash is stored
 * (users.auth_provider = 'guest', users.auth_subject = hash), so chat history
 * is private to that browser until real sign-in exists.
 */
import { createHash } from "node:crypto";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, type LanguageCode } from "@workspace/db";
import { guestToken } from "../../middlewares/guestToken";

const PROVIDER = "guest";

/** SHA-256 of the caller's guest token (taken off the header by guestTokenMiddleware). */
export function guestSubject(req: Request): string | null {
  const token = guestToken(req);
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

export async function findGuestUserId(subject: string): Promise<string | null> {
  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.authProvider, PROVIDER), eq(usersTable.authSubject, subject)));
  return row?.id ?? null;
}

export async function findOrCreateGuestUserId(subject: string, language: LanguageCode): Promise<string> {
  const existing = await findGuestUserId(subject);
  if (existing) return existing;
  await db
    .insert(usersTable)
    .values({ authProvider: PROVIDER, authSubject: subject, preferredLanguage: language })
    .onConflictDoNothing();
  const id = await findGuestUserId(subject);
  if (!id) throw new Error("Could not create guest user");
  return id;
}
