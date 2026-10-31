/**
 * Shows the knowledge base: sources, documents by approval status,
 * embedded chunks, and the latest ingestion runs.
 *
 * Run: pnpm --filter @workspace/scripts run knowledge:status [-- --pending]
 */
import { parseArgs } from "node:util";
import { cliArgs } from "./args";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  ingestionRunsTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
  pool,
} from "@workspace/db";
import { EMBEDDING_MODEL } from "@workspace/rag";

async function main() {
  const { values } = parseArgs({
    args: cliArgs(), options: { pending: { type: "boolean", default: false } } });

  const rows = await db.execute<{
    name: string;
    source_status: string;
    approved: number;
    pending: number;
    rejected: number;
    retired: number;
    chunks: number;
    embedded: number;
  }>(sql`
    select s.name, s.approval_status as source_status,
      count(distinct d.id) filter (where d.approval_status = 'approved')::int as approved,
      count(distinct d.id) filter (where d.approval_status = 'pending')::int as pending,
      count(distinct d.id) filter (where d.approval_status = 'rejected')::int as rejected,
      count(distinct d.id) filter (where d.approval_status = 'retired')::int as retired,
      count(distinct c.id)::int as chunks,
      count(distinct e.chunk_id)::int as embedded
    from knowledge_sources s
    left join knowledge_documents d on d.knowledge_source_id = s.id
    left join knowledge_chunks c on c.document_id = d.id
    left join knowledge_chunk_embeddings e on e.chunk_id = c.id and e.embedding_model_id = ${EMBEDDING_MODEL.id}
    group by s.id order by s.name`);
  console.log("Knowledge sources:");
  console.table(rows.rows);

  if (values.pending) {
    const pending = await db
      .select({ id: knowledgeDocumentsTable.id, source: knowledgeSourcesTable.name, title: knowledgeDocumentsTable.title })
      .from(knowledgeDocumentsTable)
      .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
      .where(eq(knowledgeDocumentsTable.approvalStatus, "pending"))
      .orderBy(knowledgeSourcesTable.name, knowledgeDocumentsTable.title);
    console.log("Pending documents:");
    console.table(pending);
  }

  const runs = await db
    .select({
      startedAt: ingestionRunsTable.startedAt,
      runType: ingestionRunsTable.runType,
      status: ingestionRunsTable.status,
      seen: ingestionRunsTable.recordsSeen,
      inserted: ingestionRunsTable.recordsInserted,
      updated: ingestionRunsTable.recordsUpdated,
      error: ingestionRunsTable.errorMessage,
    })
    .from(ingestionRunsTable)
    .orderBy(desc(ingestionRunsTable.startedAt))
    .limit(10);
  console.log("Latest ingestion runs:");
  console.table(runs.map((r) => ({ ...r, error: r.error?.slice(0, 80) ?? "" })));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
