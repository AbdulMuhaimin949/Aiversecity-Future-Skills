import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dataSourcesTable } from "./catalogue";
import { createdAt, dataOriginEnum, updatedAt } from "./common";
import { languagesTable, usersTable } from "./users";

/**
 * Retrieval (RAG) storage for the future Gemini assistant.
 *
 * Embeddings use a single fixed dimension so they can be indexed with HNSW
 * (pgvector caps HNSW on `vector` at 2000 dimensions). Gemini's
 * `gemini-embedding-001` supports 768 via `outputDimensionality`; every row in
 * `embedding_models` must match this value and every stored vector is tied to
 * one model row. Changing the dimension requires a new column/table.
 */
export const EMBEDDING_DIMENSIONS = 768;

export const approvalStatusEnum = pgEnum("knowledge_approval_status", [
  "pending",
  "approved",
  "rejected",
  "retired",
]);

export const knowledgeSourcesTable = pgTable(
  "knowledge_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Optional link to the citation catalogue (e.g. SRC_MASCO_2020). */
    dataSourceId: text("data_source_id").references(
      () => dataSourcesTable.sourceId,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(),
    baseUrl: text("base_url"),
    licenceNotes: text("licence_notes"),
    defaultLanguage: text("default_language")
      .notNull()
      .default("ms")
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    approvalStatus: approvalStatusEnum("approval_status")
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("knowledge_sources_name_unique").on(t.name),
    index("knowledge_sources_data_source_idx").on(t.dataSourceId),
  ],
);

export const knowledgeDocumentsTable = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    knowledgeSourceId: uuid("knowledge_source_id")
      .notNull()
      .references(() => knowledgeSourcesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    language: text("language")
      .notNull()
      .default("ms")
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    mimeType: text("mime_type"),
    /** SHA-256 of the normalised document text; used to skip re-ingestion. */
    contentHash: text("content_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    approvalStatus: approvalStatusEnum("approval_status")
      .notNull()
      .default("pending"),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("knowledge_documents_source_hash_unique").on(
      t.knowledgeSourceId,
      t.contentHash,
    ),
    index("knowledge_documents_status_idx").on(t.approvalStatus, t.language),
  ],
);

export const knowledgeChunksTable = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    language: text("language")
      .notNull()
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    tokenCount: integer("token_count"),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("knowledge_chunks_doc_index_unique").on(t.documentId, t.chunkIndex),
    check("knowledge_chunks_index_nonnegative", sql`${t.chunkIndex} >= 0`),
    check(
      "knowledge_chunks_content_not_blank",
      sql`length(btrim(${t.content})) > 0`,
    ),
  ],
);

/**
 * Embedding model configurations. Empty until a Gemini embedding key is
 * configured; no placeholder rows are seeded.
 */
export const embeddingModelsTable = pgTable(
  "embedding_models",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    modelName: text("model_name").notNull(),
    dimensions: integer("dimensions").notNull(),
    /** Gemini task type used for documents, e.g. RETRIEVAL_DOCUMENT. */
    documentTaskType: text("document_task_type"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("embedding_models_config_unique").on(
      t.provider,
      t.modelName,
      t.dimensions,
    ),
    check("embedding_models_provider", sql`${t.provider} in ('google_gemini')`),
    check(
      "embedding_models_dimensions_fixed",
      sql`${t.dimensions} = ${sql.raw(String(EMBEDDING_DIMENSIONS))}`,
    ),
  ],
);

export const knowledgeChunkEmbeddingsTable = pgTable(
  "knowledge_chunk_embeddings",
  {
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => knowledgeChunksTable.id, { onDelete: "cascade" }),
    // FK declared below with a short name (the default exceeds 63 chars).
    embeddingModelId: text("embedding_model_id").notNull(),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.chunkId, t.embeddingModelId] }),
    foreignKey({
      name: "knowledge_chunk_embeddings_model_fk",
      columns: [t.embeddingModelId],
      foreignColumns: [embeddingModelsTable.id],
    }).onUpdate("cascade"),
    index("knowledge_chunk_embeddings_model_idx").on(t.embeddingModelId),
    index("knowledge_chunk_embeddings_hnsw_cosine").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
  "needs_changes",
  "retired",
]);

/** Human approval history for documents entering the knowledge base. */
export const knowledgeApprovalsTable = pgTable(
  "knowledge_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    decision: approvalDecisionEnum("decision").notNull(),
    notes: text("notes"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("knowledge_approvals_document_idx").on(t.documentId, t.decidedAt),
    index("knowledge_approvals_reviewer_idx").on(t.reviewerUserId),
  ],
);

export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

/** One row per ingestion or import run (knowledge base or catalogue CSVs). */
export const ingestionRunsTable = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    knowledgeSourceId: uuid("knowledge_source_id").references(
      () => knowledgeSourcesTable.id,
      { onDelete: "set null" },
    ),
    runType: text("run_type").notNull(),
    status: ingestionStatusEnum("status").notNull().default("queued"),
    triggeredBy: uuid("triggered_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsInserted: integer("records_inserted").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    errorMessage: text("error_message"),
    details: text("details"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("ingestion_runs_source_idx").on(t.knowledgeSourceId, t.startedAt),
    index("ingestion_runs_type_idx").on(t.runType, t.startedAt),
    check(
      "ingestion_runs_finish_after_start",
      sql`${t.finishedAt} is null or ${t.finishedAt} >= ${t.startedAt}`,
    ),
    check(
      "ingestion_runs_counts_nonnegative",
      sql`${t.recordsSeen} >= 0 and ${t.recordsInserted} >= 0 and ${t.recordsUpdated} >= 0`,
    ),
    check(
      "ingestion_runs_failed_has_error",
      sql`${t.status} <> 'failed' or ${t.errorMessage} is not null`,
    ),
  ],
);

export const insertKnowledgeSourceSchema = createInsertSchema(
  knowledgeSourcesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeSource = z.infer<typeof insertKnowledgeSourceSchema>;
export type KnowledgeSource = typeof knowledgeSourcesTable.$inferSelect;

export const insertKnowledgeDocumentSchema = createInsertSchema(
  knowledgeDocumentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeDocument = z.infer<
  typeof insertKnowledgeDocumentSchema
>;
export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;

export const insertKnowledgeChunkSchema = createInsertSchema(
  knowledgeChunksTable,
).omit({ id: true, createdAt: true });
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;
export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;

export const insertEmbeddingModelSchema = createInsertSchema(
  embeddingModelsTable,
).omit({ createdAt: true });
export type InsertEmbeddingModel = z.infer<typeof insertEmbeddingModelSchema>;
export type EmbeddingModel = typeof embeddingModelsTable.$inferSelect;

export const insertKnowledgeChunkEmbeddingSchema = createInsertSchema(
  knowledgeChunkEmbeddingsTable,
).omit({ createdAt: true });
export type InsertKnowledgeChunkEmbedding = z.infer<
  typeof insertKnowledgeChunkEmbeddingSchema
>;
export type KnowledgeChunkEmbedding =
  typeof knowledgeChunkEmbeddingsTable.$inferSelect;

export const insertKnowledgeApprovalSchema = createInsertSchema(
  knowledgeApprovalsTable,
).omit({ id: true, decidedAt: true });
export type InsertKnowledgeApproval = z.infer<
  typeof insertKnowledgeApprovalSchema
>;
export type KnowledgeApproval = typeof knowledgeApprovalsTable.$inferSelect;

export const insertIngestionRunSchema = createInsertSchema(
  ingestionRunsTable,
).omit({ id: true });
export type InsertIngestionRun = z.infer<typeof insertIngestionRunSchema>;
export type IngestionRun = typeof ingestionRunsTable.$inferSelect;
