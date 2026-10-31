/**
 * Read models for the knowledge-base admin page: sources, documents (with
 * version number and embedding progress), chunks and approval history.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { EMBEDDING_MODEL, getActiveEmbeddingModelId, getGeminiApiKey } from "@workspace/rag";

export const PAGE_SIZE = 20;

/** Documents added from the admin page without choosing a source go here. */
export const ADMIN_SOURCE = {
  name: "Aiversecity admin uploads",
  sourceType: "admin_upload",
  licenceNotes:
    "Documents added by administrators on the knowledge admin page. Synthetic demo text unless marked source-attributed.",
  defaultLanguage: "en",
} as const;

type Status = "pending" | "approved" | "rejected" | "retired";
type Decision = "approved" | "rejected" | "needs_changes" | "retired";

const iso = (v: Date | string) => new Date(v).toISOString();
const isoOrNull = (v: Date | string | null) => (v ? iso(v) : null);

// ------------------------------------------------------------------ sources

type SourceRow = {
  id: string;
  name: string;
  source_type: string;
  approval_status: Status;
  licence_notes: string | null;
  pending: number;
  approved: number;
  rejected: number;
  retired: number;
  chunks: number;
  embedded: number;
  awaiting: number;
};

async function sourceRows(where: SQL = sql`true`) {
  const res = await db.execute<SourceRow>(sql`
    select s.id, s.name, s.source_type, s.approval_status, s.licence_notes,
      (select count(*)::int from knowledge_documents d where d.knowledge_source_id = s.id and d.approval_status = 'pending') as pending,
      (select count(*)::int from knowledge_documents d where d.knowledge_source_id = s.id and d.approval_status = 'approved') as approved,
      (select count(*)::int from knowledge_documents d where d.knowledge_source_id = s.id and d.approval_status = 'rejected') as rejected,
      (select count(*)::int from knowledge_documents d where d.knowledge_source_id = s.id and d.approval_status = 'retired') as retired,
      (select count(*)::int from knowledge_chunks c join knowledge_documents d on d.id = c.document_id
        where d.knowledge_source_id = s.id) as chunks,
      (select count(*)::int from knowledge_chunk_embeddings e join knowledge_chunks c on c.id = e.chunk_id
        join knowledge_documents d on d.id = c.document_id
        where d.knowledge_source_id = s.id and e.embedding_model_id = ${EMBEDDING_MODEL.id}) as embedded,
      (select count(*)::int from knowledge_chunks c join knowledge_documents d on d.id = c.document_id
        where d.knowledge_source_id = s.id and d.approval_status = 'approved' and s.approval_status = 'approved'
          and not exists (select 1 from knowledge_chunk_embeddings e
            where e.chunk_id = c.id and e.embedding_model_id = ${EMBEDDING_MODEL.id})) as awaiting
    from knowledge_sources s
    where ${where}
    order by s.name`);
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    sourceType: r.source_type,
    approvalStatus: r.approval_status,
    licenceNotes: r.licence_notes,
    documentCounts: { pending: r.pending, approved: r.approved, rejected: r.rejected, retired: r.retired },
    chunkCount: r.chunks,
    embeddedChunkCount: r.embedded,
    awaitingEmbeddingCount: r.awaiting,
  }));
}

export async function knowledgeSource(id: string) {
  const [row] = await sourceRows(sql`s.id = ${id}`);
  return row ?? null;
}

export async function knowledgeOverview() {
  const [sources, runs, modelId] = await Promise.all([
    sourceRows(),
    db.execute<{
      id: string;
      source_name: string | null;
      run_type: string;
      status: string;
      records_seen: number;
      records_inserted: number;
      records_updated: number;
      error_message: string | null;
      triggered_by_name: string | null;
      started_at: string;
      finished_at: string | null;
    }>(sql`
      select r.id, s.name as source_name, r.run_type, r.status, r.records_seen, r.records_inserted,
        r.records_updated, r.error_message, coalesce(u.display_name, u.email) as triggered_by_name,
        r.started_at, r.finished_at
      from ingestion_runs r
      left join knowledge_sources s on s.id = r.knowledge_source_id
      left join users u on u.id = r.triggered_by
      where r.run_type like 'knowledge%'
      order by r.started_at desc
      limit 8`),
    getActiveEmbeddingModelId(),
  ]);
  return {
    geminiConfigured: getGeminiApiKey() !== null,
    embeddingModel: EMBEDDING_MODEL.id,
    embeddingModelActive: modelId !== null,
    adminSourceName: ADMIN_SOURCE.name,
    sources,
    recentRuns: runs.rows.map((r) => ({
      id: r.id,
      sourceName: r.source_name,
      runType: r.run_type,
      status: r.status,
      recordsSeen: r.records_seen,
      recordsInserted: r.records_inserted,
      recordsUpdated: r.records_updated,
      errorMessage: r.error_message,
      triggeredByName: r.triggered_by_name,
      startedAt: iso(r.started_at),
      finishedAt: isoOrNull(r.finished_at),
    })),
  };
}

// ---------------------------------------------------------------- documents

type DocRow = {
  id: string;
  title: string;
  source_id: string;
  source_name: string;
  source_status: Status;
  language: string;
  data_origin: "SYNTHETIC" | "SOURCE_ATTRIBUTED";
  approval_status: Status;
  version: number;
  version_count: number;
  chunks: number;
  embedded: number;
  created_at: string;
  url: string | null;
  content_hash: string;
  ad_id: string | null;
  ad_decision: Decision | null;
  ad_notes: string | null;
  ad_reviewer: string | null;
  ad_decided_at: string | null;
};

/** Documents with version numbers computed over all documents sharing title and source. */
function documentQuery(where: SQL, tail: SQL) {
  return sql`
    with versioned as (
      select d.*,
        row_number() over (partition by d.knowledge_source_id, d.title order by d.created_at, d.id)::int as version,
        count(*) over (partition by d.knowledge_source_id, d.title)::int as version_count
      from knowledge_documents d
    )
    select d.id, d.title, s.id as source_id, s.name as source_name, s.approval_status as source_status,
      d.language, d.data_origin, d.approval_status, d.version, d.version_count, d.created_at, d.url, d.content_hash,
      (select count(*)::int from knowledge_chunks c where c.document_id = d.id) as chunks,
      (select count(*)::int from knowledge_chunk_embeddings e join knowledge_chunks c on c.id = e.chunk_id
        where c.document_id = d.id and e.embedding_model_id = ${EMBEDDING_MODEL.id}) as embedded,
      ad.id as ad_id, ad.decision as ad_decision, ad.notes as ad_notes, ad.reviewer as ad_reviewer, ad.decided_at as ad_decided_at
    from versioned d
    join knowledge_sources s on s.id = d.knowledge_source_id
    left join lateral (
      select a.id, a.decision, a.notes, a.decided_at, coalesce(u.display_name, u.email, 'Unknown reviewer') as reviewer
      from knowledge_approvals a left join users u on u.id = a.reviewer_user_id
      where a.document_id = d.id
      order by a.decided_at desc
      limit 1
    ) ad on true
    where ${where}
    ${tail}`;
}

function toSummary(r: DocRow) {
  return {
    id: r.id,
    title: r.title,
    sourceId: r.source_id,
    sourceName: r.source_name,
    sourceStatus: r.source_status,
    language: r.language,
    dataOrigin: r.data_origin,
    approvalStatus: r.approval_status,
    version: r.version,
    versionCount: r.version_count,
    chunkCount: r.chunks,
    embeddedChunkCount: r.embedded,
    createdAt: iso(r.created_at),
    lastDecision: r.ad_id
      ? { id: r.ad_id, decision: r.ad_decision!, notes: r.ad_notes, reviewerName: r.ad_reviewer!, decidedAt: iso(r.ad_decided_at!) }
      : null,
  };
}

export type DocumentFilter = "all" | Status;

export async function listDocuments(opts: { status: DocumentFilter; sourceId?: string; search?: string; page: number }) {
  const base: SQL[] = [sql`true`];
  if (opts.sourceId) base.push(sql`d.knowledge_source_id = ${opts.sourceId}`);
  if (opts.search) base.push(sql`d.title ilike ${`%${opts.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`);
  const baseWhere = sql.join(base, sql` and `);
  const where = opts.status === "all" ? baseWhere : sql`${baseWhere} and d.approval_status = ${opts.status}`;

  const [items, counts] = await Promise.all([
    db.execute<DocRow>(
      documentQuery(
        where,
        sql`order by (d.approval_status = 'pending') desc, d.created_at desc, d.id
            limit ${PAGE_SIZE} offset ${(opts.page - 1) * PAGE_SIZE}`,
      ),
    ),
    db.execute<{ status: Status; n: number }>(sql`
      select d.approval_status as status, count(*)::int as n
      from knowledge_documents d where ${baseWhere} group by d.approval_status`),
  ]);
  const c = { pending: 0, approved: 0, rejected: 0, retired: 0 };
  for (const r of counts.rows) c[r.status] = r.n;
  const all = c.pending + c.approved + c.rejected + c.retired;
  return {
    items: items.rows.map(toSummary),
    page: opts.page,
    pageSize: PAGE_SIZE,
    total: opts.status === "all" ? all : c[opts.status],
    counts: { all, ...c },
  };
}

export async function documentDetail(id: string) {
  const [row] = (await db.execute<DocRow>(documentQuery(sql`d.id = ${id}`, sql``))).rows;
  if (!row) return null;
  const [chunks, versions, approvals, modelId] = await Promise.all([
    db.execute<{ id: string; chunk_index: number; content: string; embedded: boolean }>(sql`
      select c.id, c.chunk_index, c.content,
        exists (select 1 from knowledge_chunk_embeddings e where e.chunk_id = c.id and e.embedding_model_id = ${EMBEDDING_MODEL.id}) as embedded
      from knowledge_chunks c where c.document_id = ${id} order by c.chunk_index`),
    db.execute<{ id: string; version: number; approval_status: Status; created_at: string }>(sql`
      select d.id, row_number() over (order by d.created_at, d.id)::int as version, d.approval_status, d.created_at
      from knowledge_documents d
      where d.knowledge_source_id = ${row.source_id} and d.title = ${row.title}
      order by d.created_at desc, d.id desc`),
    db.execute<{ id: string; decision: Decision; notes: string | null; reviewer: string; decided_at: string }>(sql`
      select a.id, a.decision, a.notes, a.decided_at, coalesce(u.display_name, u.email, 'Unknown reviewer') as reviewer
      from knowledge_approvals a left join users u on u.id = a.reviewer_user_id
      where a.document_id = ${id} order by a.decided_at desc`),
    getActiveEmbeddingModelId(),
  ]);
  const summary = toSummary(row);
  return {
    document: summary,
    url: row.url,
    contentHash: row.content_hash,
    retrievable:
      summary.approvalStatus === "approved" &&
      summary.sourceStatus === "approved" &&
      modelId !== null &&
      summary.chunkCount > 0 &&
      summary.embeddedChunkCount >= summary.chunkCount,
    chunks: chunks.rows.map((c) => ({ id: c.id, chunkIndex: c.chunk_index, content: c.content, embedded: c.embedded })),
    versions: versions.rows.map((v) => ({ id: v.id, version: v.version, approvalStatus: v.approval_status, createdAt: iso(v.created_at) })),
    approvals: approvals.rows.map((a) => ({
      id: a.id,
      decision: a.decision,
      notes: a.notes,
      reviewerName: a.reviewer,
      decidedAt: iso(a.decided_at),
    })),
  };
}
