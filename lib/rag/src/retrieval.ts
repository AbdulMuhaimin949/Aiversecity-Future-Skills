import { and, eq, ne, sql } from "drizzle-orm";
import {
  dataSourcesTable,
  db,
  embeddingModelsTable,
  knowledgeChunkEmbeddingsTable,
  knowledgeChunksTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
} from "@workspace/db";
import { EMBEDDING_MODEL } from "./config";

/** Registers the embedding model row and makes it the only active one. */
export async function ensureEmbeddingModel(): Promise<string> {
  await db.transaction(async (tx) => {
    await tx
      .insert(embeddingModelsTable)
      .values({
        id: EMBEDDING_MODEL.id,
        provider: EMBEDDING_MODEL.provider,
        modelName: EMBEDDING_MODEL.modelName,
        dimensions: EMBEDDING_MODEL.dimensions,
        documentTaskType: EMBEDDING_MODEL.documentTaskType,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: embeddingModelsTable.id,
        set: { isActive: true, documentTaskType: EMBEDDING_MODEL.documentTaskType },
      });
    await tx
      .update(embeddingModelsTable)
      .set({ isActive: false })
      .where(ne(embeddingModelsTable.id, EMBEDDING_MODEL.id));
  });
  return EMBEDDING_MODEL.id;
}

/** Id of the active embedding model, or null if none has been registered. */
export async function getActiveEmbeddingModelId(): Promise<string | null> {
  const [row] = await db
    .select({ id: embeddingModelsTable.id })
    .from(embeddingModelsTable)
    .where(
      and(
        eq(embeddingModelsTable.isActive, true),
        eq(embeddingModelsTable.id, EMBEDDING_MODEL.id),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * SQL condition: the chunk's document AND its source are approved.
 * Every retrieval and every embedding step goes through this gate.
 */
export const approvedChunkCondition = sql`${knowledgeDocumentsTable.approvalStatus} = 'approved' and ${knowledgeSourcesTable.approvalStatus} = 'approved'`;

/**
 * Removes embeddings of chunks whose document or source is no longer approved,
 * so un-approved text can never be retrieved. Returns the number removed.
 */
export async function purgeUnapprovedEmbeddings(): Promise<number> {
  const res = await db.execute(sql`
    delete from ${knowledgeChunkEmbeddingsTable} e
    using ${knowledgeChunksTable} c, ${knowledgeDocumentsTable} d, ${knowledgeSourcesTable} s
    where e.chunk_id = c.id and c.document_id = d.id and d.knowledge_source_id = s.id
      and not (d.approval_status = 'approved' and s.approval_status = 'approved')
  `);
  return res.rowCount ?? 0;
}

export type RetrievedChunk = {
  chunkId: string;
  chunkIndex: number;
  content: string;
  language: string;
  documentId: string;
  documentTitle: string;
  documentUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  dataSourceId: string | null;
  /** Cosine similarity (1 − cosine distance), higher is closer. */
  score: number;
};

export const DEFAULT_TOP_K = 6;
/** Chunks below this cosine similarity are not used as evidence. */
export const DEFAULT_MIN_SCORE = 0.55;

/**
 * Cosine nearest-neighbour search over approved chunks using the HNSW index.
 * Iterative index scans keep filling results when the approval filter
 * removes candidates.
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  opts: { modelId: string; topK?: number; minScore?: number },
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const e = knowledgeChunkEmbeddingsTable;
  const c = knowledgeChunksTable;
  const d = knowledgeDocumentsTable;
  const s = knowledgeSourcesTable;
  const distance = sql<number>`${e.embedding} <=> ${vectorLiteral}::vector`;

  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`set local hnsw.ef_search = 100`);
    await tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`);
    return tx
      .select({
        chunkId: c.id,
        chunkIndex: c.chunkIndex,
        content: c.content,
        language: c.language,
        documentId: d.id,
        documentTitle: d.title,
        documentUrl: d.url,
        sourceName: s.name,
        sourceBaseUrl: s.baseUrl,
        dataSourceId: s.dataSourceId,
        dataSourceUrl: dataSourcesTable.sourceUrl,
        distance,
      })
      .from(e)
      .innerJoin(c, eq(e.chunkId, c.id))
      .innerJoin(d, eq(c.documentId, d.id))
      .innerJoin(s, eq(d.knowledgeSourceId, s.id))
      .leftJoin(dataSourcesTable, eq(s.dataSourceId, dataSourcesTable.sourceId))
      .where(and(eq(e.embeddingModelId, opts.modelId), approvedChunkCondition))
      .orderBy(distance)
      .limit(topK);
  });

  return rows
    .map((r) => ({
      chunkId: r.chunkId,
      chunkIndex: r.chunkIndex,
      content: r.content,
      language: r.language,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      documentUrl: r.documentUrl,
      sourceName: r.sourceName,
      sourceUrl: r.sourceBaseUrl ?? r.dataSourceUrl ?? null,
      dataSourceId: r.dataSourceId,
      score: 1 - Number(r.distance),
    }))
    .filter((r) => r.score >= minScore);
}

/** Counts used by the assistant status endpoint. */
export async function knowledgeStats(modelId: string | null) {
  const [docs] = await db
    .select({ approved: sql<number>`count(*)::int` })
    .from(knowledgeDocumentsTable)
    .innerJoin(
      knowledgeSourcesTable,
      eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id),
    )
    .where(approvedChunkCondition);
  const [chunkRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeChunksTable)
    .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
    .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
    .where(approvedChunkCondition);
  let embedded = 0;
  if (modelId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(knowledgeChunkEmbeddingsTable)
      .innerJoin(knowledgeChunksTable, eq(knowledgeChunkEmbeddingsTable.chunkId, knowledgeChunksTable.id))
      .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
      .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
      .where(and(eq(knowledgeChunkEmbeddingsTable.embeddingModelId, modelId), approvedChunkCondition));
    embedded = row?.n ?? 0;
  }
  return { approvedDocuments: docs?.approved ?? 0, approvedChunks: chunkRow?.n ?? 0, embeddedChunks: embedded };
}
