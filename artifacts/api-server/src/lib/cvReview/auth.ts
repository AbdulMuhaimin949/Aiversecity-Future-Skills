/**
 * Reviewer identity: a Clerk sign-in mapped to a local `users` row
 * (auth_provider = 'clerk', auth_subject = Clerk user id). Being signed in is
 * not enough: the user also needs an app role in `user_roles`.
 *
 * A `reviewer` can access the review desk; an `admin` can access both the
 * reviewer desk and knowledge-base management.
 *
 * Roles are granted by email, either with the `cv:reviewer` script
 * (development database, `--role admin` for admins) or by listing the email in
 * the REVIEWER_EMAILS / ADMIN_EMAILS env var, which grants the role on the
 * user's next request once Clerk reports the email as verified (the only way
 * to bootstrap a reviewer or admin in production).
 */
import type { Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, sql } from "drizzle-orm";
import { auditLogsTable, db, userRolesTable, usersTable } from "@workspace/db";

const PROVIDER = "clerk";
export const REVIEWER_ROLE = "reviewer";
/** Manages the knowledge base (add, approve and embed AI Mentor documents). */
export const ADMIN_ROLE = "admin";

export type SignedInUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  isReviewer: boolean;
  isAdmin: boolean;
};

function clerkUserId(req: Request): string | null {
  if (!process.env.CLERK_SECRET_KEY) return null;
  const auth = getAuth(req);
  const claims = auth?.sessionClaims as { userId?: string } | undefined;
  return claims?.userId || auth?.userId || null;
}

/** Emails granted a role on sign-in: REVIEWER_EMAILS for reviewer, ADMIN_EMAILS for admin. */
function envRoleEmails(role: string): Set<string> {
  const name = role === ADMIN_ROLE ? "ADMIN_EMAILS" : "REVIEWER_EMAILS";
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function hasRole(userId: string, role: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.roleCode, role)));
  return Boolean(row);
}

type LocalUser = { id: string; email: string | null; displayName: string | null; emailVerified: boolean };

async function clerkProfile(subject: string) {
  const clerkUser = await clerkClient.users.getUser(subject);
  const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ?? null;
  const email = primary?.emailAddress.toLowerCase() ?? null;
  const emailVerified = primary?.verification?.status === "verified";
  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;
  return { email, emailVerified, displayName };
}

/**
 * Finds or creates the local user for a Clerk user. Only verified emails are
 * stored, so a stored email is a verified one and Clerk is only asked again
 * while the user has none. A row pre-created by `cv:reviewer --grant` (email
 * only, no identity yet) is linked when the verified email matches.
 */
async function localUserFor(subject: string): Promise<LocalUser> {
  const [linked] = await db
    .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
    .from(usersTable)
    .where(and(eq(usersTable.authProvider, PROVIDER), eq(usersTable.authSubject, subject)));
  if (linked?.email) {
    await db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, linked.id));
    return { ...linked, email: linked.email.toLowerCase(), emailVerified: true };
  }

  const profile = await clerkProfile(subject);
  const verifiedEmail = profile.emailVerified ? profile.email : null;

  return db.transaction(async (tx) => {
    const pre = verifiedEmail
      ? (
          await tx
            .select({ id: usersTable.id, authProvider: usersTable.authProvider, authSubject: usersTable.authSubject })
            .from(usersTable)
            .where(sql`lower(${usersTable.email}) = ${verifiedEmail}`)
            .for("update")
        )[0]
      : undefined;
    if (pre && pre.authProvider !== null && !(pre.authProvider === PROVIDER && pre.authSubject === subject)) {
      throw new Error("This email is already linked to another sign-in account.");
    }

    if (linked) {
      // Email became verified since the first visit.
      if (verifiedEmail && !pre) {
        await tx.update(usersTable).set({ email: verifiedEmail, lastSeenAt: new Date() }).where(eq(usersTable.id, linked.id));
        return { id: linked.id, email: verifiedEmail, displayName: linked.displayName, emailVerified: true };
      }
      if (!pre) {
        await tx.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, linked.id));
        return { id: linked.id, email: profile.email, displayName: linked.displayName, emailVerified: false };
      }
      // A pre-granted row with this email exists alongside the linked one: keep the linked one.
      return { id: linked.id, email: profile.email, displayName: linked.displayName, emailVerified: false };
    }

    if (pre) {
      await tx
        .update(usersTable)
        .set({ authProvider: PROVIDER, authSubject: subject, displayName: profile.displayName, lastSeenAt: new Date() })
        .where(eq(usersTable.id, pre.id));
      await tx.insert(auditLogsTable).values({
        actorUserId: pre.id,
        actorType: "user",
        action: "user.identity.linked",
        entityType: "user",
        entityId: pre.id,
        metadata: { provider: PROVIDER },
      });
      return { id: pre.id, email: verifiedEmail, displayName: profile.displayName, emailVerified: true };
    }

    const [created] = await tx
      .insert(usersTable)
      .values({
        authProvider: PROVIDER,
        authSubject: subject,
        email: verifiedEmail,
        displayName: profile.displayName,
        preferredLanguage: "en",
        lastSeenAt: new Date(),
      })
      .returning({ id: usersTable.id });
    return { id: created!.id, email: profile.email, displayName: profile.displayName, emailVerified: Boolean(verifiedEmail) };
  });
}

/** The signed-in user, or null when the request has no Clerk session. */
export async function currentUser(req: Request): Promise<SignedInUser | null> {
  const subject = clerkUserId(req);
  if (!subject) return null;
  const user = await localUserFor(subject);
  const [isReviewer, isAdmin] = await Promise.all([
    hasOrBootstrapRole(user, REVIEWER_ROLE),
    hasOrBootstrapRole(user, ADMIN_ROLE),
  ]);
  return { id: user.id, email: user.email, displayName: user.displayName, isReviewer, isAdmin };
}

/** True if the user holds the role, granting it first when their verified email is listed in the role's env var. */
async function hasOrBootstrapRole(user: LocalUser, role: string): Promise<boolean> {
  if (await hasRole(user.id, role)) return true;
  if (!user.email || !user.emailVerified || !envRoleEmails(role).has(user.email)) return false;
  const envName = role === ADMIN_ROLE ? "ADMIN_EMAILS" : "REVIEWER_EMAILS";
  await db.transaction(async (tx) => {
    await tx.insert(userRolesTable).values({ userId: user.id, roleCode: role }).onConflictDoNothing();
    await tx.insert(auditLogsTable).values({
      actorType: "system",
      action: "user.role.granted",
      entityType: "user",
      entityId: user.id,
      metadata: { role, via: envName },
    });
  });
  return true;
}

/** Sends 401/403 unless the caller is a signed-in reviewer or admin. */
export async function requireReviewer(req: Request, res: Response): Promise<SignedInUser | null> {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in with an approved reviewer account to review CV claims." });
    return null;
  }
  if (!user.isReviewer && !user.isAdmin) {
    res.status(403).json({ error: "Your account does not have the reviewer role." });
    return null;
  }
  return user;
}

/** Sends 401/403 and returns null unless the caller is a signed-in admin. */
export async function requireAdmin(req: Request, res: Response): Promise<SignedInUser | null> {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to manage the knowledge base." });
    return null;
  }
  if (!user.isAdmin) {
    res.status(403).json({ error: "Your account does not have the admin role." });
    return null;
  }
  return user;
}
