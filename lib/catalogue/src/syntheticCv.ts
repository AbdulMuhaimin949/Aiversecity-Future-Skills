/**
 * Imports the fictional CV fixtures from knowledge/synthetic-addon:
 *   synthetic_cv_profiles.csv  -> cv_documents      (is_synthetic, external_id)
 *   synthetic_cv_claims.csv    -> cv_claims         (extraction_method = synthetic_fixture)
 *   synthetic_cv_evidence.csv  -> cv_claim_evidence (kind = simulated_document_metadata)
 *   synthetic_review_cases.csv -> cv_claims.review_case_id
 *
 * Rules:
 * - Everything is labelled synthetic. Evidence rows are fictional placeholder
 *   metadata (kind simulated_document_metadata, verified_external = false,
 *   enforced by database checks), never verbatim CV text or a credential.
 * - The expected answers are never stored: synthetic_claim_test_oracle.csv is
 *   not read, and the `scenario_ground_truth` (claims) and `scenario` /
 *   `expected_training_action` (review cases) columns are ignored, so neither
 *   the LLM, applicants nor reviewers can see them.
 * - Idempotent: rows are upserted by dataset id. Re-running updates dataset
 *   fields only; claim review status, decisions and appeals are kept.
 * - Every row is validated (ids, references to the catalogue, synthetic
 *   flags) before anything is written; any problem aborts the import.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import {
  auditLogsTable,
  cvClaimEvidenceTable,
  cvClaimsTable,
  cvDocumentsTable,
  db,
  ingestionRunsTable,
  occupationsTable,
  pool,
  skillsTable,
  usersTable,
  type InsertCvClaim,
  type InsertCvClaimEvidence,
  type InsertCvDocument,
} from "@workspace/db";
import { lineOf, readCsvFile, Validator } from "./import";

export const SYNTHETIC_CV_RUN_TYPE = "synthetic_cv_import";

/** System account that owns the fictional CVs (no real person). */
export const SYNTHETIC_CV_OWNER = {
  authProvider: "system",
  authSubject: "synthetic-cv-dataset",
  displayName: "Fictional demo applicants (synthetic dataset)",
} as const;

/** The only files this import reads. The test oracle is deliberately absent. */
export const SYNTHETIC_CV_FILES = [
  "synthetic_cv_profiles.csv",
  "synthetic_cv_claims.csv",
  "synthetic_cv_evidence.csv",
  "synthetic_review_cases.csv",
] as const;

const CLAIM_TYPES = {
  EDUCATION: "education",
  WORK_EXPERIENCE: "experience",
  CERTIFICATION: "certification",
  TECHNICAL_SKILL: "skill",
} as const;

const SKILL_PREFIX = "Claims proficiency in ";
const CHUNK_SIZE = 500;

export function resolveSyntheticAddonDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env["SYNTHETIC_ADDON_DIR"],
    path.resolve(here, "../../../knowledge/synthetic-addon"),
    path.resolve(process.cwd(), "knowledge/synthetic-addon"),
    path.resolve(process.cwd(), "../../knowledge/synthetic-addon"),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, SYNTHETIC_CV_FILES[0])));
  if (!found) throw new Error(`Synthetic add-on directory not found. Tried: ${candidates.join(", ")}`);
  return found;
}

export function syntheticCvFingerprint(dir: string): string {
  const hash = createHash("sha256");
  for (const name of SYNTHETIC_CV_FILES) {
    hash.update(name).update("\0").update(fs.readFileSync(path.join(dir, name))).update("\0");
  }
  return hash.digest("hex");
}

export function syntheticCvCsvRowCounts(dir: string) {
  return {
    cv_documents: readCsvFile(path.join(dir, "synthetic_cv_profiles.csv")).length,
    cv_claims: readCsvFile(path.join(dir, "synthetic_cv_claims.csv")).length,
    cv_claim_evidence: readCsvFile(path.join(dir, "synthetic_cv_evidence.csv")).length,
  };
}

type Row = Record<string, string>;
type DocRow = Omit<InsertCvDocument, "userId">;
type ClaimRow = Omit<InsertCvClaim, "cvDocumentId"> & { profileId: string };
type EvidenceRow = Omit<InsertCvClaimEvidence, "claimId"> & { claimExternalId: string };

function requireTrue(v: Validator, row: Row, line: number, col: string) {
  if (!v.bool(row, line, col)) v.fail(line, `"${col}" must be true: every add-on row is synthetic`);
}

function buildProfiles(rows: Row[], v: Validator, occupationIds: Set<string>): DocRow[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const externalId = v.required(r, line, "profile_id");
    v.unique(line, "profile_id", externalId, seen);
    requireTrue(v, r, line, "is_synthetic");
    const target = v.required(r, line, "target_occupation_id");
    v.reference(line, "target_occupation_id", target, occupationIds, "occupations (run db:import-catalogue first)");
    const cvText = v.required(r, line, "cv_text");
    return {
      originalFilename: `${externalId}.txt`,
      mimeType: "text/plain",
      byteSize: Buffer.byteLength(cvText, "utf-8"),
      sha256: createHash("sha256").update(cvText).digest("hex"),
      isSynthetic: true,
      externalId,
      candidateName: v.required(r, line, "display_name"),
      cvText,
      targetOccupationId: target,
      fixtureAttributes: {
        state: v.required(r, line, "state_malaysia"),
        education: v.required(r, line, "education"),
        yearsExperience: v.decimal(r, line, "years_experience", 0, 60),
        provenance: v.required(r, line, "data_provenance"),
      },
    };
  });
}

function buildClaims(
  rows: Row[],
  v: Validator,
  profileIds: Set<string>,
  skillByName: Map<string, string>,
  reviewCases: Map<string, string>,
): ClaimRow[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const externalId = v.required(r, line, "claim_id");
    v.unique(line, "claim_id", externalId, seen);
    const profileId = v.required(r, line, "profile_id");
    v.reference(line, "profile_id", profileId, profileIds, "synthetic_cv_profiles.csv");
    requireTrue(v, r, line, "is_synthetic");
    v.oneOf(r, line, "review_status", ["PENDING_REVIEW"]);
    const rawType = v.oneOf(r, line, "claim_type", Object.keys(CLAIM_TYPES)) as keyof typeof CLAIM_TYPES;
    const claimType = CLAIM_TYPES[rawType] ?? "other";
    const text = v.required(r, line, "claim_text");
    let skillId: string | null = null;
    if (claimType === "skill") {
      const name = text.startsWith(SKILL_PREFIX) ? text.slice(SKILL_PREFIX.length).trim() : "";
      skillId = skillByName.get(name.toLowerCase()) ?? null;
      if (!skillId) v.fail(line, `skill claim "${text}" does not name a catalogue skill`);
    }
    // scenario_ground_truth is an evaluation answer and is intentionally not read.
    return {
      profileId,
      claimType,
      skillId,
      claimedValue: text,
      extractionMethod: "synthetic_fixture",
      isSynthetic: true,
      externalId,
      reviewCaseId: reviewCases.get(externalId) ?? null,
    };
  });
}

function buildEvidence(rows: Row[], v: Validator, claimIds: Set<string>): EvidenceRow[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const externalId = v.required(r, line, "evidence_id");
    v.unique(line, "evidence_id", externalId, seen);
    const claimExternalId = v.required(r, line, "claim_id");
    v.reference(line, "claim_id", claimExternalId, claimIds, "synthetic_cv_claims.csv");
    requireTrue(v, r, line, "is_synthetic");
    if (v.bool(r, line, "verified_external")) {
      v.fail(line, `"verified_external" must be false: fictional evidence is never externally verified`);
    }
    v.oneOf(r, line, "evidence_type", ["SIMULATED_DOCUMENT_METADATA"]);
    return {
      claimExternalId,
      kind: "simulated_document_metadata",
      quote: null,
      isSynthetic: true,
      externalId,
      documentTitle: v.required(r, line, "document_title"),
      issuerName: v.required(r, line, "issuer_name"),
      description: v.required(r, line, "evidence_description"),
      verifiedExternal: false,
    };
  });
}

/** Maps claim id -> review case id. Only ids are read; expected outcomes are ignored. */
function buildReviewCases(rows: Row[], v: Validator): Map<string, string> {
  const byClaim = new Map<string, string>();
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = lineOf(i);
    const caseId = v.required(r, line, "case_id");
    v.unique(line, "case_id", caseId, seen);
    requireTrue(v, r, line, "is_synthetic");
    const claimId = v.required(r, line, "claim_id");
    if (byClaim.has(claimId)) v.fail(line, `claim "${claimId}" already has review case ${byClaim.get(claimId)}`);
    byClaim.set(claimId, caseId);
  });
  return byClaim;
}

export interface SyntheticCvImportResult {
  runId: string;
  fingerprint: string;
  rows: { cv_documents: number; cv_claims: number; cv_claim_evidence: number; review_cases: number };
  inserted: { cv_documents: number; cv_claims: number; cv_claim_evidence: number };
  /** Dataset ids in the database that are no longer in the CSVs (kept, not deleted). */
  notInCsv: { cv_documents: string[]; cv_claims: string[]; cv_claim_evidence: string[] };
}

/** Validates and upserts the fixtures. Throws (after recording a failed run) on any problem. */
export async function importSyntheticCvs(
  options: { dir?: string; actorType?: string } = {},
): Promise<SyntheticCvImportResult> {
  const dir = options.dir ?? resolveSyntheticAddonDir();
  const actorType = options.actorType ?? "import-script";
  const fingerprint = syntheticCvFingerprint(dir);
  const read = (name: (typeof SYNTHETIC_CV_FILES)[number]) => readCsvFile(path.join(dir, name));

  const occupationIds = new Set(
    (await db.select({ id: occupationsTable.occupationId }).from(occupationsTable)).map((r) => r.id),
  );
  const skillByName = new Map(
    (await db.select({ id: skillsTable.skillId, name: skillsTable.canonicalName }).from(skillsTable)).map((s) => [
      s.name.toLowerCase(),
      s.id,
    ]),
  );

  const profileV = new Validator("synthetic_cv_profiles.csv");
  const profiles = buildProfiles(read("synthetic_cv_profiles.csv"), profileV, occupationIds);
  const caseV = new Validator("synthetic_review_cases.csv");
  const caseRows = read("synthetic_review_cases.csv");
  const reviewCases = buildReviewCases(caseRows, caseV);
  const claimV = new Validator("synthetic_cv_claims.csv");
  const claims = buildClaims(
    read("synthetic_cv_claims.csv"),
    claimV,
    new Set(profiles.map((p) => p.externalId!)),
    skillByName,
    reviewCases,
  );
  const claimIds = new Set(claims.map((c) => c.externalId!));
  for (const [claimId, caseId] of reviewCases) {
    if (!claimIds.has(claimId)) caseV.fail(0, `review case ${caseId} points to unknown claim "${claimId}"`);
  }
  const evidenceV = new Validator("synthetic_cv_evidence.csv");
  const evidence = buildEvidence(read("synthetic_cv_evidence.csv"), evidenceV, claimIds);

  const errors = [profileV, caseV, claimV, evidenceV].flatMap((v) => v.errors);
  const [run] = await db
    .insert(ingestionRunsTable)
    .values({
      runType: SYNTHETIC_CV_RUN_TYPE,
      status: "running",
      recordsSeen: profiles.length + claims.length + evidence.length,
    })
    .returning({ id: ingestionRunsTable.id });
  if (!run) throw new Error("Could not record ingestion run");
  const markFailed = (message: string) =>
    db
      .update(ingestionRunsTable)
      .set({ status: "failed", errorMessage: message.slice(0, 4000), finishedAt: new Date() })
      .where(eq(ingestionRunsTable.id, run.id));

  if (errors.length > 0) {
    await markFailed(`${errors.length} validation error(s):\n${errors.join("\n")}`);
    const more = errors.length > 25 ? `\n  ...and ${errors.length - 25} more` : "";
    throw new Error(
      `Synthetic CV import aborted, nothing was written. ${errors.length} problem(s):\n  ${errors.slice(0, 25).join("\n  ")}${more}`,
    );
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.insert(usersTable).values({ ...SYNTHETIC_CV_OWNER, preferredLanguage: "en" }).onConflictDoNothing();
      const [owner] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.authProvider, SYNTHETIC_CV_OWNER.authProvider),
            eq(usersTable.authSubject, SYNTHETIC_CV_OWNER.authSubject),
          ),
        );
      if (!owner) throw new Error("Could not create the synthetic CV owner account");

      const inserted = { cv_documents: 0, cv_claims: 0, cv_claim_evidence: 0 };
      const docIdByExternal = new Map<string, string>();
      for (let i = 0; i < profiles.length; i += CHUNK_SIZE) {
        const chunk = profiles.slice(i, i + CHUNK_SIZE).map((p) => ({ ...p, userId: owner.id }));
        const res = await tx
          .insert(cvDocumentsTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: cvDocumentsTable.externalId,
            set: {
              originalFilename: sql`excluded.original_filename`,
              byteSize: sql`excluded.byte_size`,
              sha256: sql`excluded.sha256`,
              candidateName: sql`excluded.candidate_name`,
              cvText: sql`excluded.cv_text`,
              targetOccupationId: sql`excluded.target_occupation_id`,
              fixtureAttributes: sql`excluded.fixture_attributes`,
            },
          })
          .returning({ id: cvDocumentsTable.id, externalId: cvDocumentsTable.externalId, inserted: sql<boolean>`(xmax = 0)` });
        for (const r of res) {
          docIdByExternal.set(r.externalId!, r.id);
          if (r.inserted) inserted.cv_documents++;
        }
      }

      const claimIdByExternal = new Map<string, string>();
      for (let i = 0; i < claims.length; i += CHUNK_SIZE) {
        const chunk = claims.slice(i, i + CHUNK_SIZE).map(({ profileId, ...c }) => ({
          ...c,
          cvDocumentId: docIdByExternal.get(profileId)!,
        }));
        // Status is not in the update set, so reviewer outcomes survive a re-import.
        const res = await tx
          .insert(cvClaimsTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: cvClaimsTable.externalId,
            set: {
              cvDocumentId: sql`excluded.cv_document_id`,
              claimType: sql`excluded.claim_type`,
              skillId: sql`excluded.skill_id`,
              claimedValue: sql`excluded.claimed_value`,
              reviewCaseId: sql`excluded.review_case_id`,
            },
          })
          .returning({ id: cvClaimsTable.id, externalId: cvClaimsTable.externalId, inserted: sql<boolean>`(xmax = 0)` });
        for (const r of res) {
          claimIdByExternal.set(r.externalId!, r.id);
          if (r.inserted) inserted.cv_claims++;
        }
      }

      for (let i = 0; i < evidence.length; i += CHUNK_SIZE) {
        const chunk = evidence.slice(i, i + CHUNK_SIZE).map(({ claimExternalId, ...e }) => ({
          ...e,
          claimId: claimIdByExternal.get(claimExternalId)!,
        }));
        const res = await tx
          .insert(cvClaimEvidenceTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: cvClaimEvidenceTable.externalId,
            set: {
              claimId: sql`excluded.claim_id`,
              documentTitle: sql`excluded.document_title`,
              issuerName: sql`excluded.issuer_name`,
              description: sql`excluded.description`,
            },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        inserted.cv_claim_evidence += res.filter((r) => r.inserted).length;
      }

      const stale = async (table: string, ids: string[]) =>
        (
          await tx.execute<{ id: string }>(
            sql`select external_id as id from ${sql.identifier(table)}
                where is_synthetic and external_id is not null
                  and not (external_id = any(${sql.param(ids)}::text[]))`,
          )
        ).rows.map((r) => r.id);
      const notInCsv = {
        cv_documents: await stale("cv_documents", profiles.map((p) => p.externalId!)),
        cv_claims: await stale("cv_claims", claims.map((c) => c.externalId!)),
        cv_claim_evidence: await stale("cv_claim_evidence", evidence.map((e) => e.externalId!)),
      };

      await tx.insert(auditLogsTable).values({
        actorType,
        action: "synthetic_cv.import",
        entityType: "ingestion_run",
        entityId: run.id,
        metadata: {
          fingerprint,
          inserted,
          rows: { profiles: profiles.length, claims: claims.length, evidence: evidence.length, reviewCases: reviewCases.size },
          notInCsv: Object.fromEntries(Object.entries(notInCsv).map(([k, v]) => [k, v.length])),
        },
      });
      return { inserted, notInCsv };
    });

    await db
      .update(ingestionRunsTable)
      .set({
        status: "succeeded",
        recordsInserted: Object.values(outcome.inserted).reduce((a, b) => a + b, 0),
        details: JSON.stringify({ fingerprint, inserted: outcome.inserted }),
        finishedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, run.id));

    return {
      runId: run.id,
      fingerprint,
      rows: {
        cv_documents: profiles.length,
        cv_claims: claims.length,
        cv_claim_evidence: evidence.length,
        review_cases: reviewCases.size,
      },
      inserted: outcome.inserted,
      notInCsv: outcome.notInCsv,
    };
  } catch (err) {
    await markFailed(err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export interface SyntheticCvStatus {
  rows: { cv_documents: number; cv_claims: number; cv_claim_evidence: number };
  importedFingerprint: string | null;
}

export async function syntheticCvStatus(): Promise<SyntheticCvStatus> {
  const count = async (table: string) =>
    (
      await db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.identifier(table)} where is_synthetic and external_id is not null`,
      )
    ).rows[0]?.n ?? 0;
  const [last] = await db
    .select({ details: ingestionRunsTable.details })
    .from(ingestionRunsTable)
    .where(and(eq(ingestionRunsTable.runType, SYNTHETIC_CV_RUN_TYPE), eq(ingestionRunsTable.status, "succeeded")))
    .orderBy(sql`${ingestionRunsTable.startedAt} desc`)
    .limit(1);
  let importedFingerprint: string | null = null;
  try {
    importedFingerprint = last?.details ? (JSON.parse(last.details).fingerprint ?? null) : null;
  } catch {
    importedFingerprint = null;
  }
  return {
    rows: {
      cv_documents: await count("cv_documents"),
      cv_claims: await count("cv_claims"),
      cv_claim_evidence: await count("cv_claim_evidence"),
    },
    importedFingerprint,
  };
}

export type SyntheticCvSyncOutcome =
  | { action: "up_to_date"; status: SyntheticCvStatus }
  | { action: "imported"; status: SyntheticCvStatus; import: SyntheticCvImportResult }
  | { action: "skipped"; reason: string };

const LOCK_KEY = "workspace.synthetic_cv_import";

/**
 * Imports only when the database is behind the CSVs (different fingerprint or
 * missing rows). Needs the catalogue (occupations, skills) imported first.
 * Safe to call from several processes at once (advisory lock).
 */
export async function syncSyntheticCvs(
  options: { dir?: string; actorType?: string } = {},
): Promise<SyntheticCvSyncOutcome> {
  const dir = options.dir ?? resolveSyntheticAddonDir();
  const fingerprint = syntheticCvFingerprint(dir);
  const csvRows = syntheticCvCsvRowCounts(dir);
  const upToDate = (s: SyntheticCvStatus) =>
    s.importedFingerprint === fingerprint &&
    (Object.keys(csvRows) as (keyof typeof csvRows)[]).every((t) => s.rows[t] >= csvRows[t]);

  const before = await syntheticCvStatus();
  if (upToDate(before)) return { action: "up_to_date", status: before };

  const [occ] = await db.select({ n: sql<number>`count(*)::int` }).from(occupationsTable);
  if (!occ?.n) return { action: "skipped", reason: "the career catalogue has not been imported yet" };

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) return { action: "skipped", reason: "another process is importing the synthetic CVs" };
    try {
      const current = await syntheticCvStatus();
      if (upToDate(current)) return { action: "up_to_date", status: current };
      const result = await importSyntheticCvs({ dir, actorType: options.actorType });
      return { action: "imported", status: await syntheticCvStatus(), import: result };
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
