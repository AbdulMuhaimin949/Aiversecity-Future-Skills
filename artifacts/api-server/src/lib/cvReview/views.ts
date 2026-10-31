/**
 * Read models for the CV review demo. Applicants and reviewers see different
 * shapes: applicants never see reviewer identities or other applicants'
 * appeals. Nobody sees expected outcomes: they are not in the database (the
 * synthetic import never reads the test oracle or ground-truth columns).
 */
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  appealsTable,
  auditLogsTable,
  cvClaimEvidenceTable,
  cvClaimsTable,
  cvDocumentsTable,
  db,
  occupationsTable,
  reviewDecisionsTable,
  skillsTable,
  usersTable,
  type Appeal,
  type CvClaim,
  type CvClaimEvidence,
} from "@workspace/db";

export const PAGE_SIZE = 24;

export type ApiDecision = "EVIDENCE_SUFFICIENT" | "REQUEST_MORE_EVIDENCE" | "ESCALATED";
type DbClaimDecision = "evidence_sufficient" | "request_more_evidence" | "escalated";

export const DECISION_TO_DB: Record<ApiDecision, DbClaimDecision> = {
  EVIDENCE_SUFFICIENT: "evidence_sufficient",
  REQUEST_MORE_EVIDENCE: "request_more_evidence",
  ESCALATED: "escalated",
};
const DB_TO_DECISION: Record<string, ApiDecision | undefined> = {
  evidence_sufficient: "EVIDENCE_SUFFICIENT",
  request_more_evidence: "REQUEST_MORE_EVIDENCE",
  escalated: "ESCALATED",
};
export const DECISION_TO_STATUS: Record<ApiDecision, CvClaim["status"]> = {
  EVIDENCE_SUFFICIENT: "evidence_sufficient",
  REQUEST_MORE_EVIDENCE: "more_evidence_requested",
  ESCALATED: "escalated",
};
export const STATUS_TO_DECISION: Partial<Record<CvClaim["status"], ApiDecision>> = {
  evidence_sufficient: "EVIDENCE_SUFFICIENT",
  more_evidence_requested: "REQUEST_MORE_EVIDENCE",
  escalated: "ESCALATED",
};

export const OPEN_APPEAL = sql`${appealsTable.status} in ('submitted', 'under_review')`;
export const isOpenAppeal = (a: Pick<Appeal, "status">) => a.status === "submitted" || a.status === "under_review";

// ---------------------------------------------------------------- CV summary

const counts = {
  claimCount: sql<number>`(select count(*)::int from ${cvClaimsTable} c where c.cv_document_id = ${cvDocumentsTable.id})`,
  pendingCount: sql<number>`(select count(*)::int from ${cvClaimsTable} c where c.cv_document_id = ${cvDocumentsTable.id} and c.status = 'pending_review')`,
  reviewCaseCount: sql<number>`(select count(*)::int from ${cvClaimsTable} c where c.cv_document_id = ${cvDocumentsTable.id} and c.review_case_id is not null)`,
  aiExtracted: sql<boolean>`exists (select 1 from ${cvClaimsTable} c where c.cv_document_id = ${cvDocumentsTable.id} and c.extraction_method = 'ai_model')`,
};

const summaryColumns = {
  id: cvDocumentsTable.id,
  externalId: cvDocumentsTable.externalId,
  candidateName: cvDocumentsTable.candidateName,
  status: cvDocumentsTable.status,
  attrs: cvDocumentsTable.fixtureAttributes,
  occupationId: occupationsTable.occupationId,
  occupationTitle: occupationsTable.canonicalTitle,
  cvText: cvDocumentsTable.cvText,
  ...counts,
};

type SummaryRow = {
  id: string;
  externalId: string | null;
  candidateName: string | null;
  status: "uploaded" | "scanned" | "reviewed" | "deleted";
  attrs: Record<string, string | number>;
  occupationId: string | null;
  occupationTitle: string | null;
  cvText: string | null;
  claimCount: number;
  pendingCount: number;
  reviewCaseCount: number;
  aiExtracted: boolean;
};

function toSummary(r: SummaryRow) {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    id: r.id,
    externalId: r.externalId ?? "",
    candidateName: r.candidateName ?? "",
    state: str(r.attrs["state"]),
    education: str(r.attrs["education"]),
    yearsExperience: num(r.attrs["yearsExperience"]),
    targetOccupation: r.occupationId ? { id: r.occupationId, title: r.occupationTitle ?? r.occupationId } : null,
    status: r.status,
    claimCount: r.claimCount,
    pendingCount: r.pendingCount,
    decidedCount: r.claimCount - r.pendingCount,
    reviewCaseCount: r.reviewCaseCount,
    aiExtracted: r.aiExtracted,
  };
}

function toDetail(r: SummaryRow) {
  return { ...toSummary(r), cvText: r.cvText ?? "", provenance: (r.attrs["provenance"] as string | undefined) ?? null };
}

const syntheticOnly = and(eq(cvDocumentsTable.isSynthetic, true), sql`${cvDocumentsTable.externalId} is not null`);

export async function listDemoCvs(opts: { search?: string; reviewCasesOnly?: boolean; page: number }) {
  const conds: SQL[] = [syntheticOnly!];
  const q = opts.search?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      or(
        sql`${cvDocumentsTable.candidateName} ilike ${like}`,
        sql`${cvDocumentsTable.externalId} ilike ${like}`,
        sql`${occupationsTable.canonicalTitle} ilike ${like}`,
      )!,
    );
  }
  if (opts.reviewCasesOnly) conds.push(sql`${counts.reviewCaseCount} > 0`);
  const where = and(...conds);
  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cvDocumentsTable)
    .leftJoin(occupationsTable, eq(occupationsTable.occupationId, cvDocumentsTable.targetOccupationId))
    .where(where);
  const rows = await db
    .select(summaryColumns)
    .from(cvDocumentsTable)
    .leftJoin(occupationsTable, eq(occupationsTable.occupationId, cvDocumentsTable.targetOccupationId))
    .where(where)
    .orderBy(asc(cvDocumentsTable.externalId))
    .limit(PAGE_SIZE)
    .offset((opts.page - 1) * PAGE_SIZE);
  return { items: rows.map((r) => toSummary(r as SummaryRow)), total: total?.n ?? 0, page: opts.page, pageSize: PAGE_SIZE };
}

async function loadCvRow(cvId: string): Promise<SummaryRow | null> {
  const [row] = await db
    .select(summaryColumns)
    .from(cvDocumentsTable)
    .leftJoin(occupationsTable, eq(occupationsTable.occupationId, cvDocumentsTable.targetOccupationId))
    .where(and(eq(cvDocumentsTable.id, cvId), syntheticOnly));
  return (row as SummaryRow | undefined) ?? null;
}

// ------------------------------------------------------------------- claims

type ClaimBundle = {
  claim: CvClaim & { skillName: string | null };
  evidence: CvClaimEvidence[];
  /** Claim decisions, newest first. */
  decisions: { id: string; decision: ApiDecision; rationale: string; reviewerUserId: string; createdAt: Date; viaAppeal: boolean }[];
  /** Appeals on the claim, newest first. */
  appeals: Appeal[];
};

async function loadClaims(where: SQL): Promise<ClaimBundle[]> {
  const claims = await db
    .select({ claim: cvClaimsTable, skillName: skillsTable.canonicalName })
    .from(cvClaimsTable)
    .leftJoin(skillsTable, eq(skillsTable.skillId, cvClaimsTable.skillId))
    .where(where)
    .orderBy(
      sql`case when ${cvClaimsTable.extractionMethod} = 'synthetic_fixture' then 0 else 1 end`,
      asc(cvClaimsTable.externalId),
      asc(cvClaimsTable.createdAt),
    );
  if (claims.length === 0) return [];
  const ids = claims.map((c) => c.claim.id);
  const [evidence, decisions, appeals] = await Promise.all([
    db.select().from(cvClaimEvidenceTable).where(inArray(cvClaimEvidenceTable.claimId, ids)).orderBy(asc(cvClaimEvidenceTable.createdAt)),
    db
      .select()
      .from(reviewDecisionsTable)
      .where(inArray(reviewDecisionsTable.cvClaimId, ids))
      .orderBy(desc(reviewDecisionsTable.createdAt), desc(reviewDecisionsTable.id)),
    db.select().from(appealsTable).where(inArray(appealsTable.cvClaimId, ids)).orderBy(desc(appealsTable.submittedAt)),
  ]);
  return claims.map(({ claim, skillName }) => {
    const claimAppeals = appeals.filter((a) => a.cvClaimId === claim.id);
    // A claim decision recorded while upholding an appeal shares that transaction's timestamp.
    const upheldAt = new Set(claimAppeals.filter((a) => a.status === "upheld" && a.resolvedAt).map((a) => a.resolvedAt!.getTime()));
    return {
      claim: { ...claim, skillName },
      evidence: evidence.filter((e) => e.claimId === claim.id),
      decisions: decisions
        .filter((d) => d.cvClaimId === claim.id && DB_TO_DECISION[d.decision])
        .map((d) => ({
          id: d.id,
          decision: DB_TO_DECISION[d.decision]!,
          rationale: d.rationale,
          reviewerUserId: d.reviewerUserId,
          createdAt: d.createdAt,
          viaAppeal: upheldAt.has(d.createdAt.getTime()),
        })),
      appeals: claimAppeals,
    };
  });
}

function evidenceDto(e: CvClaimEvidence) {
  return {
    id: e.id,
    kind: e.kind,
    quote: e.quote,
    documentTitle: e.documentTitle,
    issuerName: e.issuerName,
    description: e.description,
    isSynthetic: e.isSynthetic,
    verifiedExternal: e.verifiedExternal,
  };
}

function appealDto(a: Appeal) {
  return {
    id: a.id,
    claimId: a.cvClaimId ?? "",
    reason: a.reason,
    language: a.language as "ms" | "zh-CN" | "en",
    status: a.status,
    resolution: a.resolution,
    submittedAt: a.submittedAt,
    resolvedAt: a.resolvedAt,
  };
}

function claimBase(b: ClaimBundle) {
  const c = b.claim;
  return {
    id: c.id,
    externalId: c.externalId,
    claimType: c.claimType,
    claimText: c.claimedValue,
    skill: c.skillId ? { id: c.skillId, name: c.skillName ?? c.skillId } : null,
    extractionMethod: c.extractionMethod,
    extractionModel: c.extractionModel,
    status: c.status,
    evidence: b.evidence.map(evidenceDto),
  };
}

/** Whether `applicantId` may appeal the claim's current decision. */
export function appealAllowed(b: Pick<ClaimBundle, "decisions" | "appeals">, applicantId: string | null): boolean {
  const latest = b.decisions[0];
  if (!latest) return false;
  // A visitor without a guest identity yet has no appeals; submitting creates the identity.
  if (!applicantId) return true;
  const mine = b.appeals.filter((a) => a.applicantUserId === applicantId);
  if (mine.some(isOpenAppeal)) return false;
  // One appeal per decision: a later decision (e.g. after an upheld appeal) can be appealed again.
  return !mine.some((a) => a.submittedAt >= latest.createdAt);
}

function applicantClaimDto(b: ClaimBundle, applicantId: string | null) {
  const latest = b.decisions[0] ?? null;
  const mine = applicantId ? b.appeals.find((a) => a.applicantUserId === applicantId) ?? null : null;
  return {
    ...claimBase(b),
    reviewCase: b.claim.reviewCaseId !== null,
    latestDecision: latest
      ? { decision: latest.decision, rationale: latest.rationale, decidedAt: latest.createdAt, viaAppeal: latest.viaAppeal }
      : null,
    myAppeal: mine ? appealDto(mine) : null,
    canAppeal: appealAllowed(b, applicantId),
  };
}

export async function applicantCvDetail(cvId: string, applicantId: string | null) {
  const row = await loadCvRow(cvId);
  if (!row) return null;
  const claims = await loadClaims(eq(cvClaimsTable.cvDocumentId, cvId));
  return { cv: toDetail(row), claims: claims.map((b) => applicantClaimDto(b, applicantId)) };
}

// ----------------------------------------------------------------- reviewer

async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email, provider: usersTable.authProvider })
    .from(usersTable)
    .where(inArray(usersTable.id, unique));
  return new Map(
    rows.map((u) => [u.id, u.provider === "guest" ? guestLabel(u.id) : u.displayName || u.email || "Reviewer"]),
  );
}

/** Pseudonymous label so reviewers can tell applicants apart without identifying them. */
export const guestLabel = (userId: string) => `Guest applicant ${userId.slice(0, 6).toUpperCase()}`;

function reviewerClaimDto(b: ClaimBundle, names: Map<string, string>) {
  return {
    ...claimBase(b),
    cvId: b.claim.cvDocumentId,
    reviewCaseId: b.claim.reviewCaseId,
    decisions: b.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      rationale: d.rationale,
      reviewerName: names.get(d.reviewerUserId) ?? "Reviewer",
      decidedAt: d.createdAt,
      viaAppeal: d.viaAppeal,
    })),
    appeals: b.appeals.map((a) => ({
      ...appealDto(a),
      applicantLabel: guestLabel(a.applicantUserId),
      resolvedByName: a.resolvedBy ? names.get(a.resolvedBy) ?? "Reviewer" : null,
    })),
  };
}

export async function reviewerClaim(claimId: string) {
  const [b] = await loadClaims(eq(cvClaimsTable.id, claimId));
  if (!b) return null;
  const names = await namesFor([...b.decisions.map((d) => d.reviewerUserId), ...b.appeals.flatMap((a) => (a.resolvedBy ? [a.resolvedBy] : []))]);
  return reviewerClaimDto(b, names);
}

const AUDIT_SUMMARY: Record<string, (m: Record<string, unknown>) => string> = {
  "cv.claim.decided": (m) => `Decision ${m["decision"]} on ${m["claim"] ?? "claim"}`,
  "cv.claims.ai_extracted": (m) => `AI (${m["model"]}) extracted ${m["kept"]} claim(s); ${m["dropped"]} dropped by the verbatim-quote check`,
  "cv.appeal.submitted": (m) => `Appeal submitted on ${m["claim"] ?? "claim"}`,
  "cv.appeal.resolved": (m) =>
    `Appeal ${m["outcome"]} on ${m["claim"] ?? "claim"}${m["newDecision"] ? ` (decision changed to ${m["newDecision"]})` : ""}`,
};

export async function reviewerCvDetail(cvId: string) {
  const row = await loadCvRow(cvId);
  if (!row) return null;
  const claims = await loadClaims(eq(cvClaimsTable.cvDocumentId, cvId));
  const claimIds = claims.map((c) => c.claim.id);
  const appealIds = claims.flatMap((c) => c.appeals.map((a) => a.id));
  const entityConds = [and(eq(auditLogsTable.entityType, "cv_document"), eq(auditLogsTable.entityId, cvId))];
  if (claimIds.length) entityConds.push(and(eq(auditLogsTable.entityType, "cv_claim"), inArray(auditLogsTable.entityId, claimIds)));
  if (appealIds.length) entityConds.push(and(eq(auditLogsTable.entityType, "appeal"), inArray(auditLogsTable.entityId, appealIds)));
  const audit = await db
    .select()
    .from(auditLogsTable)
    .where(or(...entityConds))
    .orderBy(desc(auditLogsTable.createdAt), desc(auditLogsTable.id))
    .limit(100);
  const names = await namesFor([
    ...claims.flatMap((c) => c.decisions.map((d) => d.reviewerUserId)),
    ...claims.flatMap((c) => c.appeals.flatMap((a) => (a.resolvedBy ? [a.resolvedBy] : []))),
    ...audit.flatMap((a) => (a.actorUserId ? [a.actorUserId] : [])),
  ]);
  return {
    cv: toDetail(row),
    claims: claims.map((b) => reviewerClaimDto(b, names)),
    auditTrail: audit.map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      return {
        id: a.id,
        action: a.action,
        actorType: a.actorType,
        actorName: a.actorUserId ? names.get(a.actorUserId) ?? null : null,
        entityType: a.entityType,
        entityId: a.entityId,
        summary: AUDIT_SUMMARY[a.action]?.(meta) ?? a.action,
        createdAt: a.createdAt,
      };
    }),
  };
}

export type QueueFilter = "pending" | "review_cases" | "appeals" | "decided";

const hasOpenAppeal = sql`exists (select 1 from ${appealsTable} a where a.cv_claim_id = ${cvClaimsTable.id} and a.status in ('submitted', 'under_review'))`;

const QUEUE_FILTERS: Record<QueueFilter, SQL> = {
  pending: sql`${cvClaimsTable.status} = 'pending_review'`,
  review_cases: sql`${cvClaimsTable.reviewCaseId} is not null and ${cvClaimsTable.status} = 'pending_review'`,
  appeals: hasOpenAppeal,
  decided: sql`${cvClaimsTable.status} <> 'pending_review'`,
};

export async function reviewQueue(opts: { filter: QueueFilter; search?: string; page: number }) {
  const base = and(eq(cvDocumentsTable.isSynthetic, true), sql`${cvDocumentsTable.externalId} is not null`);
  const conds: SQL[] = [base!, QUEUE_FILTERS[opts.filter]];
  const q = opts.search?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      or(
        sql`${cvDocumentsTable.candidateName} ilike ${like}`,
        sql`${cvDocumentsTable.externalId} ilike ${like}`,
        sql`${cvClaimsTable.externalId} ilike ${like}`,
        sql`${cvClaimsTable.claimedValue} ilike ${like}`,
      )!,
    );
  }
  const from = () =>
    db
      .select({
        claimId: cvClaimsTable.id,
        cvId: cvDocumentsTable.id,
        cvExternalId: cvDocumentsTable.externalId,
        candidateName: cvDocumentsTable.candidateName,
        claimType: cvClaimsTable.claimType,
        claimText: cvClaimsTable.claimedValue,
        status: cvClaimsTable.status,
        reviewCaseId: cvClaimsTable.reviewCaseId,
        extractionMethod: cvClaimsTable.extractionMethod,
        evidenceCount: sql<number>`(select count(*)::int from ${cvClaimEvidenceTable} e where e.claim_id = ${cvClaimsTable.id})`,
        openAppealCount: sql<number>`(select count(*)::int from ${appealsTable} a where a.cv_claim_id = ${cvClaimsTable.id} and a.status in ('submitted', 'under_review'))`,
        lastDecisionAt: sql<Date | null>`(select max(d.created_at) from ${reviewDecisionsTable} d where d.cv_claim_id = ${cvClaimsTable.id})`,
      })
      .from(cvClaimsTable)
      .innerJoin(cvDocumentsTable, eq(cvDocumentsTable.id, cvClaimsTable.cvDocumentId));

  const where = and(...conds);
  const order =
    opts.filter === "decided"
      ? [sql`(select max(d.created_at) from ${reviewDecisionsTable} d where d.cv_claim_id = ${cvClaimsTable.id}) desc nulls last`]
      : opts.filter === "appeals"
        ? [sql`(select min(a.submitted_at) from ${appealsTable} a where a.cv_claim_id = ${cvClaimsTable.id} and a.status in ('submitted', 'under_review')) asc`]
        : [sql`case when ${cvClaimsTable.reviewCaseId} is not null then 0 else 1 end`, asc(cvClaimsTable.reviewCaseId), asc(cvClaimsTable.externalId), asc(cvClaimsTable.createdAt)];
  const [rows, [total], [countRow]] = await Promise.all([
    from().where(where).orderBy(...order).limit(PAGE_SIZE).offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(cvClaimsTable).innerJoin(cvDocumentsTable, eq(cvDocumentsTable.id, cvClaimsTable.cvDocumentId)).where(where),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${QUEUE_FILTERS.pending})::int`,
        review_cases: sql<number>`count(*) filter (where ${QUEUE_FILTERS.review_cases})::int`,
        appeals: sql<number>`count(*) filter (where ${QUEUE_FILTERS.appeals})::int`,
        decided: sql<number>`count(*) filter (where ${QUEUE_FILTERS.decided})::int`,
      })
      .from(cvClaimsTable)
      .innerJoin(cvDocumentsTable, eq(cvDocumentsTable.id, cvClaimsTable.cvDocumentId))
      .where(base),
  ]);
  return {
    items: rows.map((r) => ({
      ...r,
      cvExternalId: r.cvExternalId ?? "",
      candidateName: r.candidateName ?? "",
      reviewCase: r.reviewCaseId !== null,
      lastDecisionAt: r.lastDecisionAt ? new Date(r.lastDecisionAt) : null,
    })),
    total: total?.n ?? 0,
    page: opts.page,
    pageSize: PAGE_SIZE,
    counts: countRow ?? { pending: 0, review_cases: 0, appeals: 0, decided: 0 },
  };
}

export async function cvReviewStats() {
  const [row] = await db
    .select({
      demoCvCount: sql<number>`(select count(*)::int from ${cvDocumentsTable} where is_synthetic and external_id is not null)`,
      reviewCaseCount: sql<number>`(select count(*)::int from ${cvClaimsTable} where review_case_id is not null)`,
    })
    .from(sql`(select 1) as one`);
  return row ?? { demoCvCount: 0, reviewCaseCount: 0 };
}

export { loadClaims };
