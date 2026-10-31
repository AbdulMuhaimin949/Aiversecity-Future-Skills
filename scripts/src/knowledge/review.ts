/**
 * Records a reviewer's decision on a knowledge source or document.
 * Only documents that are approved AND belong to an approved source are
 * embedded and retrieved by the assistant.
 *
 *   # approve / reject / retire a whole source
 *   pnpm --filter @workspace/scripts run knowledge:review -- --reviewer you@example.com --source "<name>" --decision approved
 *   # decide one document
 *   ... -- --reviewer you@example.com --document <uuid> --decision approved|rejected|needs_changes|retired [--notes "..."]
 *   # decide every pending document of a source
 *   ... -- --reviewer you@example.com --source "<name>" --all-pending --decision approved
 *
 * Approving a new version of a document retires older approved versions with the
 * same title in the same source. Non-approval decisions delete the affected embeddings.
 * Run knowledge:ingest afterwards to embed newly approved documents.
 */
import { parseArgs } from "node:util";
import { cliArgs } from "./args";
import { and, eq, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
  pool,
  rolesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { DOCUMENT_DECISIONS, SOURCE_DECISIONS, decideDocuments, type DocumentDecision, type SourceDecision } from "@workspace/rag";

async function ensureReviewer(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(normalised)) throw new Error(`"${email}" is not an email address`);
  let [user] = await db.select({ id: usersTable.id }).from(usersTable).where(sql`lower(${usersTable.email}) = ${normalised}`);
  if (!user) {
    [user] = await db.insert(usersTable).values({ email: normalised, displayName: normalised }).returning({ id: usersTable.id });
  }
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, "reviewer"));
  if (!role) throw new Error('The "reviewer" role is missing. Run db:import-catalogue first to seed roles.');
  await db.insert(userRolesTable).values({ userId: user!.id, roleCode: "reviewer" }).onConflictDoNothing();
  return user!.id;
}

async function decide(reviewerId: string, docIds: string[], decision: DocumentDecision, notes: string | null) {
  const r = await decideDocuments({ reviewerUserId: reviewerId, documentIds: docIds, decision, notes, via: "knowledge:review" });
  console.log(`Recorded "${decision}" for ${r.decided} document(s).${r.superseded ? ` Retired ${r.superseded} older version(s).` : ""}`);
}

async function main() {
  const { values } = parseArgs({
    args: cliArgs(),
    options: {
      reviewer: { type: "string" },
      source: { type: "string" },
      document: { type: "string" },
      "all-pending": { type: "boolean", default: false },
      decision: { type: "string" },
      notes: { type: "string" },
    },
  });
  if (!values.reviewer) throw new Error("--reviewer <email> is required");
  if (!values.decision) throw new Error("--decision is required");
  if (!values.source && !values.document) throw new Error("Pass --source <name> or --document <id>");
  const notes = values.notes ?? null;
  const reviewerId = await ensureReviewer(values.reviewer);

  if (values.document || values["all-pending"]) {
    if (!DOCUMENT_DECISIONS.includes(values.decision as DocumentDecision)) {
      throw new Error(`Document decision must be one of ${DOCUMENT_DECISIONS.join(", ")}`);
    }
    let ids: string[];
    if (values.document) {
      ids = [values.document];
    } else {
      const [src] = await db.select({ id: knowledgeSourcesTable.id }).from(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.name, values.source!));
      if (!src) throw new Error(`Unknown source "${values.source}". Run knowledge:ingest first.`);
      ids = (
        await db
          .select({ id: knowledgeDocumentsTable.id })
          .from(knowledgeDocumentsTable)
          .where(and(eq(knowledgeDocumentsTable.knowledgeSourceId, src.id), eq(knowledgeDocumentsTable.approvalStatus, "pending")))
      ).map((r) => r.id);
      if (ids.length === 0) {
        console.log("No pending documents in this source.");
        return;
      }
    }
    await decide(reviewerId, ids, values.decision as DocumentDecision, notes);
  } else {
    if (!SOURCE_DECISIONS.includes(values.decision as SourceDecision)) {
      throw new Error(`Source decision must be one of ${SOURCE_DECISIONS.join(", ")}`);
    }
    const [src] = await db
      .update(knowledgeSourcesTable)
      .set({ approvalStatus: values.decision as SourceDecision })
      .where(eq(knowledgeSourcesTable.name, values.source!))
      .returning({ id: knowledgeSourcesTable.id });
    if (!src) throw new Error(`Unknown source "${values.source}". Run knowledge:ingest first.`);
    await db.insert(auditLogsTable).values({
      actorUserId: reviewerId,
      actorType: "user",
      action: `knowledge.source.${values.decision}`,
      entityType: "knowledge_source",
      entityId: src.id,
      metadata: { name: values.source, notes },
    });
    console.log(`Source "${values.source}" is now ${values.decision}.`);
  }

  if (values.decision === "approved") console.log("Run knowledge:ingest to embed the approved documents.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
