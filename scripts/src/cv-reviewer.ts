/**
 * Grants or revokes the `reviewer` role used by the CV review pages, or with
 * `--role admin` the `admin` role used by the knowledge-base admin page.
 *
 *   pnpm --filter @workspace/scripts run cv:reviewer -- --grant you@example.com
 *   pnpm --filter @workspace/scripts run cv:reviewer -- --revoke you@example.com
 *   pnpm --filter @workspace/scripts run cv:reviewer -- --list
 *   pnpm --filter @workspace/scripts run cv:reviewer -- --role admin --grant you@example.com
 *
 * Granting by email creates an email-only user if needed; it is linked to the
 * Clerk account on first sign-in once Clerk reports that email as verified.
 * This edits the development database only. For the published app, list the
 * email in the REVIEWER_EMAILS (or ADMIN_EMAILS) env var instead (granted on
 * next sign-in). Revoking does not remove an env entry, which would re-grant it.
 */
import { parseArgs } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { auditLogsTable, db, pool, rolesTable, userRolesTable, usersTable } from "@workspace/db";
import { cliArgs } from "./knowledge/args";

const ROLES = ["reviewer", "admin"] as const;
type RoleCode = (typeof ROLES)[number];
const ENV_VAR: Record<RoleCode, string> = { reviewer: "REVIEWER_EMAILS", admin: "ADMIN_EMAILS" };

function normaliseEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error(`"${email}" is not an email address`);
  return e;
}

async function findUser(email: string) {
  const [user] = await db
    .select({ id: usersTable.id, provider: usersTable.authProvider })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`);
  return user ?? null;
}

async function grant(email: string, roleCode: RoleCode) {
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, roleCode));
  if (!role) throw new Error(`The "${roleCode}" role is missing. Run db:import-catalogue first to seed roles.`);
  let user = await findUser(email);
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({ email, displayName: email, preferredLanguage: "en" })
      .returning({ id: usersTable.id, provider: usersTable.authProvider });
    user = created!;
  }
  await db.transaction(async (tx) => {
    await tx.insert(userRolesTable).values({ userId: user!.id, roleCode }).onConflictDoNothing();
    await tx.insert(auditLogsTable).values({
      actorType: "cli",
      action: "user.role.granted",
      entityType: "user",
      entityId: user!.id,
      metadata: { role: roleCode, via: "cv:reviewer" },
    });
  });
  console.log(
    `${email} has the ${roleCode} role.${user.provider ? "" : " They will be linked on first sign-in with this verified email."}`,
  );
}

async function revoke(email: string, roleCode: RoleCode) {
  const user = await findUser(email);
  if (!user) {
    console.log(`No user with email ${email}.`);
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(userRolesTable).where(and(eq(userRolesTable.userId, user.id), eq(userRolesTable.roleCode, roleCode)));
    await tx.insert(auditLogsTable).values({
      actorType: "cli",
      action: "user.role.revoked",
      entityType: "user",
      entityId: user.id,
      metadata: { role: roleCode, via: "cv:reviewer" },
    });
  });
  console.log(`Removed the ${roleCode} role from ${email}.`);
  if ((process.env[ENV_VAR[roleCode]] ?? "").toLowerCase().split(",").map((e) => e.trim()).includes(email)) {
    console.warn(`Note: this email is also in ${ENV_VAR[roleCode]} and will be re-granted on next sign-in.`);
  }
}

async function list(roleCode: RoleCode) {
  const rows = await db
    .select({ email: usersTable.email, name: usersTable.displayName, provider: usersTable.authProvider })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(eq(userRolesTable.roleCode, roleCode));
  if (rows.length === 0) console.log(`No users with the ${roleCode} role yet.`);
  else console.table(rows.map((r) => ({ email: r.email, name: r.name, linked: r.provider === "clerk" })));
}

async function main() {
  const { values } = parseArgs({
    args: cliArgs(),
    options: {
      grant: { type: "string" },
      revoke: { type: "string" },
      list: { type: "boolean", default: false },
      role: { type: "string", default: "reviewer" },
    },
  });
  const role = values.role as RoleCode;
  if (!ROLES.includes(role)) throw new Error(`--role must be one of ${ROLES.join(", ")}`);
  if (values.grant) await grant(normaliseEmail(values.grant), role);
  else if (values.revoke) await revoke(normaliseEmail(values.revoke), role);
  else if (values.list) await list(role);
  else throw new Error("Pass --grant <email>, --revoke <email> or --list");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
