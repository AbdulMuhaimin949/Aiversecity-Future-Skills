/**
 * Knowledge document lifecycle shared by the CLI scripts and the admin API:
 * register (pending) -> human decision (approve retires older versions) ->
 * embed approved chunks. Retrieval only ever sees approved documents in
 * approved sources (see `approvedChunkCondition`).
 */
import { and, eq, inArray, ne, notExists, sql, type SQL } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  knowledgeApprovalsTable,
  knowledgeChunkEmbeddingsTable,
  knowledgeChunksTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
} from "@workspace/db";
import type { LanguageCode } from "@workspace/db/schema";
import { chunkText, normaliseText, sha256 } from "./chunking";
import { EMBEDDING_MODEL } from "./config";
import { EMBED_BATCH_SIZE, embedBatch } from "./gemini";
import { approvedChunkCondition } from "./retrieval";

export type NewKnowledgeDocument = {
  title: string;
  url: string | null;
  language: LanguageCode;
  mimeType: string;
  dataOrigin: "SOURCE_ATTRIBUTED" | "SYNTHETIC";
  publishedAt: Date | null;
  text: string;
};

/** Normalised text and its hash, as stored on the document row. */
export function documentHash(text: string): { text: string; hash: string } {
  const normalised = normaliseText(text);
  return { text: normalised, hash: sha256(normalised) };
}

/**
 * Stores a new document as `pending` with its chunks. The caller checks for an
 * existing document with the same hash in the source first; the unique
 * constraint on (source, hash) still guards against races.
 */
export async function registerDocument(
  sourceId: string,
  doc: NewKnowledgeDocument,
): Promise<{ id: string; hash: string; chunkCount: number }> {
  const { text, hash } = documentHash(doc.text);
  if (!text) throw new Error("document text is empty");
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("document produced no chunks");
  const id = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(knowledgeDocumentsTable)
      .values({
        knowledgeSourceId: sourceId,
        title: doc.title,
        url: doc.url,
        language: doc.language,
        mimeType: doc.mimeType,
        contentHash: hash,
        publishedAt: doc.publishedAt,
        retrievedAt: new Date(),
        dataOrigin: doc.dataOrigin,
      })
      .returning({ id: knowledgeDocumentsTable.id });
    await tx.insert(knowledgeChunksTable).values(
      chunks.map((content, chunkIndex) => ({
        documentId: inserted!.id,
        chunkIndex,
        content,
        language: doc.language,
        contentHash: sha256(content),
      })),
    );
    return inserted!.id;
  });
  return { id, hash, chunkCount: chunks.length };
}

export const DOCUMENT_DECISIONS = ["approved", "rejected", "needs_changes", "retired"] as const;
export type DocumentDecision = (typeof DOCUMENT_DECISIONS)[number];

export const DOCUMENT_STATUS_AFTER: Record<DocumentDecision, "approved" | "rejected" | "pending" | "retired"> = {
  approved: "approved",
  rejected: "rejected",
  needs_changes: "pending",
  retired: "retired",
};

export class UnknownDocumentError extends Error {
  constructor(readonly ids: string[]) {
    super(`Unknown document id(s): ${ids.join(", ")}`);
    this.name = "UnknownDocumentError";
  }
}

/**
 * Records a human decision on documents (knowledge_approvals + audit log).
 * Approving a document retires older approved versions (same title, same
 * source). Embeddings of anything no longer approved are deleted afterwards.
 */
export async function decideDocuments(opts: {
  reviewerUserId: string;
  documentIds: string[];
  decision: DocumentDecision;
  notes: string | null;
  via?: string;
}): Promise<{ decided: number; superseded: number; embeddingsRemoved: number }> {
  const { reviewerUserId, documentIds, decision, notes } = opts;
  const docs = await db
    .select({ id: knowledgeDocumentsTable.id, title: knowledgeDocumentsTable.title, sourceId: knowledgeDocumentsTable.knowledgeSourceId })
    .from(knowledgeDocumentsTable)
    .where(inArray(knowledgeDocumentsTable.id, documentIds));
  if (docs.length !== documentIds.length) {
    const found = new Set(docs.map((d) => d.id));
    throw new UnknownDocumentError(documentIds.filter((id) => !found.has(id)));
  }
  let superseded = 0;
  await db.transaction(async (tx) => {
    for (const d of docs) {
      await tx.insert(knowledgeApprovalsTable).values({ documentId: d.id, reviewerUserId, decision, notes });
      await tx
        .update(knowledgeDocumentsTable)
        .set({ approvalStatus: DOCUMENT_STATUS_AFTER[decision] })
        .where(eq(knowledgeDocumentsTable.id, d.id));
      if (decision === "approved") {
        const older = await tx
          .update(knowledgeDocumentsTable)
          .set({ approvalStatus: "retired" })
          .where(
            and(
              eq(knowledgeDocumentsTable.knowledgeSourceId, d.sourceId),
              eq(knowledgeDocumentsTable.title, d.title),
              eq(knowledgeDocumentsTable.approvalStatus, "approved"),
              ne(knowledgeDocumentsTable.id, d.id),
            ),
          )
          .returning({ id: knowledgeDocumentsTable.id });
        for (const o of older) {
          await tx.insert(knowledgeApprovalsTable).values({
            documentId: o.id,
            reviewerUserId,
            decision: "retired",
            notes: `Superseded by document ${d.id}`,
          });
        }
        superseded += older.length;
      }
    }
    await tx.insert(auditLogsTable).values({
      actorUserId: reviewerUserId,
      actorType: "user",
      action: `knowledge.document.${decision}`,
      entityType: "knowledge_document",
      entityId: documentIds.length === 1 ? documentIds[0]! : null,
      metadata: { documentIds, notes, superseded, ...(opts.via ? { via: opts.via } : {}) },
    });
  });
  // Approval changes retrieval eligibility; it must not delete stored vectors.
  return { decided: docs.length, superseded, embeddingsRemoved: 0 };
}

export const SYNTHETIC_RAG_SOURCE_NAME = "Aiversecity synthetic knowledge add-on";
const MAX_SYNTHETIC_BULK_APPROVAL = 500;

export class SyntheticBulkApprovalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyntheticBulkApprovalConflictError";
  }
}

/**
 * Records a human-reviewed bulk approval for the exact synthetic RAG source.
 * The source and all its documents remain separately gated. This method never
 * embeds or deletes vectors; retrieval eligibility is enforced by approval state.
 */
export async function approvePendingSyntheticRagDocuments(opts: {
  sourceId: string;
  reviewerUserId: string;
  expectedPendingCount: number;
  notes: string;
}): Promise<{ found: boolean; approved: number }> {
  if (opts.expectedPendingCount < 1 || opts.expectedPendingCount > MAX_SYNTHETIC_BULK_APPROVAL) {
    throw new SyntheticBulkApprovalConflictError("The pending-document count is outside the allowed bulk-review range.");
  }

  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({
        id: knowledgeSourcesTable.id,
        name: knowledgeSourcesTable.name,
        sourceType: knowledgeSourcesTable.sourceType,
      })
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.id, opts.sourceId))
      .for("update");
    if (!source) return { found: false, approved: 0 };
    if (source.name !== SYNTHETIC_RAG_SOURCE_NAME || source.sourceType !== "synthetic_demo") {
      throw new SyntheticBulkApprovalConflictError("Bulk approval is restricted to the Aiversecity synthetic RAG source.");
    }

    const docs = await tx
      .select({
        id: knowledgeDocumentsTable.id,
        title: knowledgeDocumentsTable.title,
        url: knowledgeDocumentsTable.url,
        language: knowledgeDocumentsTable.language,
        dataOrigin: knowledgeDocumentsTable.dataOrigin,
        approvalStatus: knowledgeDocumentsTable.approvalStatus,
      })
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.knowledgeSourceId, opts.sourceId))
      .for("update");
    const pending = docs.filter((doc) => doc.approvalStatus === "pending");
    if (pending.length !== opts.expectedPendingCount || docs.length !== pending.length) {
      throw new SyntheticBulkApprovalConflictError("The source changed since it was reviewed. Refresh the page and review the current pending documents.");
    }
    if (
      pending.length === 0 ||
      pending.some(
        (doc) =>
          doc.dataOrigin !== "SYNTHETIC" ||
          doc.language !== "en" ||
          doc.url !== null ||
          !doc.title.endsWith("(Synthetic)"),
      )
    ) {
      throw new SyntheticBulkApprovalConflictError("Every document must match the reviewed English synthetic demo dataset.");
    }
    if (new Set(pending.map((doc) => doc.title)).size !== pending.length) {
      throw new SyntheticBulkApprovalConflictError("Duplicate titles require individual review before approval.");
    }

    await tx.insert(knowledgeApprovalsTable).values(
      pending.map((doc) => ({
        documentId: doc.id,
        reviewerUserId: opts.reviewerUserId,
        decision: "approved" as const,
        notes: opts.notes,
      })),
    );
    const updated = await tx
      .update(knowledgeDocumentsTable)
      .set({ approvalStatus: "approved" })
      .where(
        and(
          eq(knowledgeDocumentsTable.knowledgeSourceId, opts.sourceId),
          eq(knowledgeDocumentsTable.approvalStatus, "pending"),
        ),
      )
      .returning({ id: knowledgeDocumentsTable.id });
    if (updated.length !== pending.length) {
      throw new SyntheticBulkApprovalConflictError("Some documents changed during approval; no decision was recorded.");
    }
    await tx.insert(auditLogsTable).values({
      actorUserId: opts.reviewerUserId,
      actorType: "user",
      action: "knowledge.documents.bulk_approved",
      entityType: "knowledge_source",
      entityId: opts.sourceId,
      metadata: {
        decision: "approved",
        documentCount: pending.length,
        notes: opts.notes,
        via: "admin-ui-bulk",
      },
    });
    return { found: true, approved: pending.length };
  });
}

export type EmbedScope = { sourceId?: string; documentIds?: string[] };
export type EmbedOptions = {
  onProgress?: (done: number, total: number) => void;
  /** Stop after this many chunks (the rest stay in `remaining`). */
  maxChunks?: number;
};

function scopeCondition(scope: EmbedScope): SQL | undefined {
  const parts: SQL[] = [approvedChunkCondition];
  if (scope.sourceId) parts.push(eq(knowledgeSourcesTable.id, scope.sourceId));
  if (scope.documentIds) parts.push(inArray(knowledgeDocumentsTable.id, scope.documentIds));
  return and(...parts);
}

/** Approved chunks in scope that have no vector for the active model yet. */
export async function chunksAwaitingEmbedding(scope: EmbedScope) {
  if (scope.documentIds && scope.documentIds.length === 0) return [];
  return db
    .select({ id: knowledgeChunksTable.id, content: knowledgeChunksTable.content, title: knowledgeDocumentsTable.title })
    .from(knowledgeChunksTable)
    .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
    .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
    .where(
      and(
        scopeCondition(scope),
        notExists(
          db
            .select({ one: sql`1` })
            .from(knowledgeChunkEmbeddingsTable)
            .where(
              and(
                eq(knowledgeChunkEmbeddingsTable.chunkId, knowledgeChunksTable.id),
                eq(knowledgeChunkEmbeddingsTable.embeddingModelId, EMBEDDING_MODEL.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(knowledgeChunksTable.documentId, knowledgeChunksTable.chunkIndex);
}

export type EmbedResult = { embedded: number; failed: number; remaining: number; errors: string[] };

/**
 * Embeds approved chunks in scope that lack a vector. The caller must have
 * registered the embedding model (`ensureEmbeddingModel`). Approval is
 * re-checked at write time so a document rejected mid-run is not stored.
 */
export async function embedApprovedChunks(scope: EmbedScope, opts: EmbedOptions = {}): Promise<EmbedResult> {
  const { onProgress, maxChunks } = opts;
  const all = await chunksAwaitingEmbedding(scope);
  const todo = maxChunks !== undefined ? all.slice(0, maxChunks) : all;
  const result: EmbedResult = { embedded: 0, failed: 0, remaining: 0, errors: [] };
  for (let i = 0; i < todo.length; i += EMBED_BATCH_SIZE) {
    const batch = todo.slice(i, i + EMBED_BATCH_SIZE);
    try {
      const vectors = await embedBatch(batch.map((c) => ({ text: c.content, title: c.title })), "document");
      const stillApproved = new Set(
        (
          await db
            .select({ id: knowledgeChunksTable.id })
            .from(knowledgeChunksTable)
            .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
            .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
            .where(and(inArray(knowledgeChunksTable.id, batch.map((c) => c.id)), approvedChunkCondition))
        ).map((r) => r.id),
      );
      const rows = batch
        .map((c, j) => ({ chunkId: c.id, embeddingModelId: EMBEDDING_MODEL.id, embedding: vectors[j]! }))
        .filter((r) => stillApproved.has(r.chunkId));
      if (rows.length) await db.insert(knowledgeChunkEmbeddingsTable).values(rows).onConflictDoNothing();
      result.embedded += rows.length;
    } catch (err) {
      result.failed += batch.length;
      result.errors.push(
        `embedding batch ${i / EMBED_BATCH_SIZE + 1} (${batch.length} chunks): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    onProgress?.(Math.min(i + batch.length, todo.length), todo.length);
  }
  result.remaining = (await chunksAwaitingEmbedding(scope)).length;
  return result;
}

export const SOURCE_DECISIONS = ["approved", "rejected", "retired", "pending"] as const;
export type SourceDecision = (typeof SOURCE_DECISIONS)[number];

/**
 * Sets a source's approval status (audit-logged). Documents are only retrieved
 * while their source is approved; un-approving removes their embeddings.
 */
export async function decideSource(opts: {
  reviewerUserId: string;
  sourceId: string;
  decision: SourceDecision;
  notes: string | null;
  via?: string;
}): Promise<{ found: boolean; embeddingsRemoved: number }> {
  const found = await db.transaction(async (tx) => {
    const [src] = await tx
      .update(knowledgeSourcesTable)
      .set({ approvalStatus: opts.decision })
      .where(eq(knowledgeSourcesTable.id, opts.sourceId))
      .returning({ id: knowledgeSourcesTable.id, name: knowledgeSourcesTable.name });
    if (!src) return false;
    await tx.insert(auditLogsTable).values({
      actorUserId: opts.reviewerUserId,
      actorType: "user",
      action: `knowledge.source.${opts.decision}`,
      entityType: "knowledge_source",
      entityId: src.id,
      metadata: { name: src.name, notes: opts.notes, ...(opts.via ? { via: opts.via } : {}) },
    });
    return true;
  });
  // Source status controls retrieval eligibility; stored vectors are retained.
  return { found, embeddingsRemoved: 0 };
}
