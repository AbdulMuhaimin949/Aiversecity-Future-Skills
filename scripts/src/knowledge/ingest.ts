/**
 * Knowledge-base ingestion for the Gemini career assistant.
 *
 * For every source in ./sources.ts:
 *   1. upsert the knowledge_sources row (its approval status is never changed here);
 *   2. register each document by SHA-256 of its normalised text — new or changed
 *      documents are stored as `pending` together with their chunks;
 *   3. embed chunks of APPROVED documents in APPROVED sources that have no vector yet
 *      (gemini-embedding-001, 768 dimensions), registering the model row first.
 * Embeddings of anything no longer approved are deleted first.
 * Each source gets one ingestion_runs row with counts and errors.
 *
 * Run: pnpm --filter @workspace/scripts run knowledge:ingest [-- --source "<name>"] [--no-embed]
 */
import { parseArgs } from "node:util";
import { cliArgs } from "./args";
import { and, eq, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  ingestionRunsTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
  pool,
} from "@workspace/db";
import {
  chunksAwaitingEmbedding,
  documentHash,
  embedApprovedChunks,
  EMBEDDING_MODEL,
  ensureEmbeddingModel,
  getGeminiApiKey,
  registerDocument,
} from "@workspace/rag";
import { SOURCES, type SourceDefinition } from "./sources";

const RUN_TYPE = "knowledge_ingest";

type RunSummary = {
  source: string;
  status: "succeeded" | "failed";
  documentsSeen: number;
  documentsNew: number;
  documentsUnchanged: number;
  documentsPendingReview: number;
  approvedDocumentsNotInSource: number;
  chunksCreated: number;
  chunksEmbedded: number;
  chunksFailedToEmbed: number;
  chunksAwaitingEmbedding: number;
  embedding: string;
  errors: string[];
};

async function upsertSource(def: SourceDefinition): Promise<{ id: string; approvalStatus: string }> {
  const [row] = await db
    .insert(knowledgeSourcesTable)
    .values({
      name: def.name,
      sourceType: def.sourceType,
      dataSourceId: def.dataSourceId,
      baseUrl: def.baseUrl,
      licenceNotes: def.licenceNotes,
      defaultLanguage: def.defaultLanguage,
    })
    .onConflictDoUpdate({
      target: knowledgeSourcesTable.name,
      set: {
        sourceType: def.sourceType,
        dataSourceId: def.dataSourceId,
        baseUrl: def.baseUrl,
        licenceNotes: def.licenceNotes,
        defaultLanguage: def.defaultLanguage,
      },
    })
    .returning({ id: knowledgeSourcesTable.id, approvalStatus: knowledgeSourcesTable.approvalStatus });
  if (!row) throw new Error(`Could not upsert source ${def.name}`);
  return row;
}

async function registerDocuments(def: SourceDefinition, sourceId: string, summary: RunSummary) {
  const docs = def.load();
  summary.documentsSeen = docs.length;
  for (const problem of def.validate?.() ?? []) summary.errors.push(`rejected row ${problem}`);
  const existing = await db
    .select({ id: knowledgeDocumentsTable.id, hash: knowledgeDocumentsTable.contentHash, status: knowledgeDocumentsTable.approvalStatus })
    .from(knowledgeDocumentsTable)
    .where(eq(knowledgeDocumentsTable.knowledgeSourceId, sourceId));
  const byHash = new Map(existing.map((d) => [d.hash, d]));
  const seenHashes = new Set<string>();

  for (const doc of docs) {
    try {
      const { text, hash } = documentHash(doc.text);
      if (!text) throw new Error("document text is empty");
      if (seenHashes.has(hash)) throw new Error("duplicate of another document in this source");
      seenHashes.add(hash);
      if (byHash.has(hash)) {
        summary.documentsUnchanged++;
        continue;
      }
      const { chunkCount } = await registerDocument(sourceId, doc);
      summary.documentsNew++;
      summary.chunksCreated += chunkCount;
    } catch (err) {
      summary.errors.push(`document "${doc.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  summary.approvedDocumentsNotInSource = existing.filter((d) => d.status === "approved" && !seenHashes.has(d.hash)).length;
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeDocumentsTable)
    .where(and(eq(knowledgeDocumentsTable.knowledgeSourceId, sourceId), eq(knowledgeDocumentsTable.approvalStatus, "pending")));
  summary.documentsPendingReview = pending?.n ?? 0;
}

async function embedSource(sourceId: string, summary: RunSummary) {
  const r = await embedApprovedChunks({ sourceId }, {
    onProgress: (done, total) => process.stdout.write(`  embedded ${done}/${total}\r`),
  });
  if (r.embedded || r.failed) process.stdout.write("\n");
  summary.chunksEmbedded += r.embedded;
  summary.chunksFailedToEmbed += r.failed;
  summary.errors.push(...r.errors);
}

async function ingestSource(def: SourceDefinition, embed: boolean): Promise<RunSummary> {
  const source = await upsertSource(def);
  const [run] = await db
    .insert(ingestionRunsTable)
    .values({ knowledgeSourceId: source.id, runType: RUN_TYPE, status: "running" })
    .returning({ id: ingestionRunsTable.id });
  if (!run) throw new Error("Could not record ingestion run");

  const summary: RunSummary = {
    source: def.name,
    status: "succeeded",
    documentsSeen: 0,
    documentsNew: 0,
    documentsUnchanged: 0,
    documentsPendingReview: 0,
    approvedDocumentsNotInSource: 0,
    chunksCreated: 0,
    chunksEmbedded: 0,
    chunksFailedToEmbed: 0,
    chunksAwaitingEmbedding: 0,
    embedding: "",
    errors: [],
  };

  try {
    await registerDocuments(def, source.id, summary);
    if (source.approvalStatus !== "approved") {
      summary.embedding = `skipped: source is ${source.approvalStatus}`;
    } else if (!embed) {
      summary.embedding = "skipped: GEMINI_API_KEY not set or --no-embed";
    } else {
      await embedSource(source.id, summary);
      summary.embedding = `${EMBEDDING_MODEL.id}`;
    }
    summary.chunksAwaitingEmbedding = (await chunksAwaitingEmbedding({ sourceId: source.id })).length;
  } catch (err) {
    summary.errors.push(err instanceof Error ? err.message : String(err));
  }
  summary.status = summary.errors.length ? "failed" : "succeeded";

  await db
    .update(ingestionRunsTable)
    .set({
      status: summary.status,
      recordsSeen: summary.documentsSeen,
      recordsInserted: summary.documentsNew,
      recordsUpdated: summary.chunksEmbedded,
      errorMessage: summary.errors.length ? summary.errors.join("\n").slice(0, 4000) : null,
      details: JSON.stringify({
        recordsInserted: "new documents registered (pending review)",
        recordsUpdated: "chunks embedded",
        ...summary,
      }),
      finishedAt: new Date(),
    })
    .where(eq(ingestionRunsTable.id, run.id));
  await db.insert(auditLogsTable).values({
    actorType: "import-script",
    action: "knowledge.ingest",
    entityType: "ingestion_run",
    entityId: run.id,
    metadata: { source: def.name, status: summary.status, documentsNew: summary.documentsNew, chunksEmbedded: summary.chunksEmbedded },
  });
  return summary;
}

async function main() {
  const { values } = parseArgs({
    args: cliArgs(),
    options: { source: { type: "string" }, "no-embed": { type: "boolean", default: false } },
  });
  const selected = values.source ? SOURCES.filter((s) => s.name === values.source) : SOURCES;
  if (selected.length === 0) {
    throw new Error(`Unknown source "${values.source}". Known: ${SOURCES.map((s) => s.name).join(", ")}`);
  }
  const embed = !values["no-embed"] && getGeminiApiKey() !== null;
  if (!values["no-embed"] && !embed) {
    console.warn("WARNING: GEMINI_API_KEY is not set — documents are registered but nothing is embedded.");
  }

  if (embed) {
    await ensureEmbeddingModel();
  } else {
    console.log("No-embed mode: preserving existing embeddings and registering documents only.");
  }

  const results: RunSummary[] = [];
  for (const def of selected) {
    console.log(`\n[${def.name}]`);
    const r = await ingestSource(def, embed);
    results.push(r);
    for (const e of r.errors) console.error(`  ERROR ${e}`);
  }
  console.log();
  console.table(
    results.map(({ errors, ...r }) => ({ ...r, errors: errors.length })),
  );
  if (results.some((r) => r.status === "failed")) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
