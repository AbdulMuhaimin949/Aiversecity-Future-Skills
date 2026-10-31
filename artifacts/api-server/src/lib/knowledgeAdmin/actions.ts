/**
 * Write actions for the knowledge-base admin page. Every change is a human
 * decision recorded in knowledge_approvals / audit_logs; embedding runs are
 * recorded in ingestion_runs like the CLI ingest.
 */
import { and, eq } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  ingestionRunsTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
} from "@workspace/db";
import {
  documentHash,
  embedApprovedChunks,
  ensureEmbeddingModel,
  registerDocument,
  type EmbedResult,
  type EmbedScope,
  type NewKnowledgeDocument,
} from "@workspace/rag";
import { ADMIN_SOURCE } from "./views";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/** The admin uploads source, created (pending) on first use. */
async function adminSourceId(): Promise<string> {
  await db
    .insert(knowledgeSourcesTable)
    .values({
      name: ADMIN_SOURCE.name,
      sourceType: ADMIN_SOURCE.sourceType,
      licenceNotes: ADMIN_SOURCE.licenceNotes,
      defaultLanguage: ADMIN_SOURCE.defaultLanguage,
    })
    .onConflictDoNothing({ target: knowledgeSourcesTable.name });
  const [row] = await db
    .select({ id: knowledgeSourcesTable.id })
    .from(knowledgeSourcesTable)
    .where(eq(knowledgeSourcesTable.name, ADMIN_SOURCE.name));
  return row!.id;
}

/** Stores a new pending document. Returns its id. */
export async function createDocument(
  adminUserId: string,
  sourceId: string | null,
  doc: NewKnowledgeDocument,
): Promise<string> {
  let sid = sourceId;
  if (sid) {
    const [src] = await db.select({ id: knowledgeSourcesTable.id }).from(knowledgeSourcesTable).where(eq(knowledgeSourcesTable.id, sid));
    if (!src) throw new NotFoundError("Knowledge source not found.");
  } else {
    sid = await adminSourceId();
  }
  const { hash } = documentHash(doc.text);
  const [dup] = await db
    .select({ id: knowledgeDocumentsTable.id, title: knowledgeDocumentsTable.title, status: knowledgeDocumentsTable.approvalStatus })
    .from(knowledgeDocumentsTable)
    .where(and(eq(knowledgeDocumentsTable.knowledgeSourceId, sid), eq(knowledgeDocumentsTable.contentHash, hash)));
  if (dup) throw new ConflictError(`This exact text is already stored in this source as "${dup.title}" (${dup.status}).`);

  let id: string;
  try {
    ({ id } = await registerDocument(sid, doc));
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ConflictError("This exact text was just added to this source.");
    throw err;
  }
  await db.insert(auditLogsTable).values({
    actorUserId: adminUserId,
    actorType: "user",
    action: "knowledge.document.created",
    entityType: "knowledge_document",
    entityId: id,
    metadata: { sourceId: sid, title: doc.title, language: doc.language, dataOrigin: doc.dataOrigin, via: "admin-ui" },
  });
  return id;
}

const running = new Set<string>();
/** Keeps one request well under proxy timeouts; the rest is reported as remaining. */
const MAX_CHUNKS_PER_REQUEST = 300;

/**
 * Embeds approved chunks in scope without a vector, recording an
 * ingestion_runs row and an audit entry. One run per scope at a time.
 */
export async function runEmbedding(opts: {
  adminUserId: string;
  key: string;
  sourceId: string;
  scope: EmbedScope;
}): Promise<EmbedResult> {
  if (running.has(opts.key)) throw new ConflictError("Embedding is already running for this item. Wait for it to finish.");
  running.add(opts.key);
  try {
    await ensureEmbeddingModel();
    const [run] = await db
      .insert(ingestionRunsTable)
      .values({ knowledgeSourceId: opts.sourceId, runType: "knowledge_embed", status: "running", triggeredBy: opts.adminUserId })
      .returning({ id: ingestionRunsTable.id });
    let result: EmbedResult;
    try {
      result = await embedApprovedChunks(opts.scope, { maxChunks: MAX_CHUNKS_PER_REQUEST });
    } catch (err) {
      result = { embedded: 0, failed: 0, remaining: 0, errors: [err instanceof Error ? err.message : String(err)] };
    }
    const status = result.errors.length ? "failed" : "succeeded";
    await db
      .update(ingestionRunsTable)
      .set({
        status,
        recordsSeen: result.embedded + result.failed,
        recordsUpdated: result.embedded,
        errorMessage: result.errors.length ? result.errors.join("\n").slice(0, 4000) : null,
        details: JSON.stringify({ recordsUpdated: "chunks embedded", scope: opts.scope, ...result }),
        finishedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, run!.id));
    await db.insert(auditLogsTable).values({
      actorUserId: opts.adminUserId,
      actorType: "user",
      action: "knowledge.embed",
      entityType: opts.scope.documentIds ? "knowledge_document" : "knowledge_source",
      entityId: opts.scope.documentIds?.[0] ?? opts.sourceId,
      metadata: { runId: run!.id, status, embedded: result.embedded, failed: result.failed, remaining: result.remaining, via: "admin-ui" },
    });
    return result;
  } finally {
    running.delete(opts.key);
  }
}
