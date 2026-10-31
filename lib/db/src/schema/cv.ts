import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { occupationsTable, skillsTable } from "./catalogue";
import { createdAt, updatedAt } from "./common";
import { userProfilesTable, usersTable } from "./users";

export const cvDocumentStatusEnum = pgEnum("cv_document_status", [
  "uploaded",
  "scanned",
  "reviewed",
  "deleted",
]);

/**
 * Metadata about an uploaded CV. The file itself is not stored in the
 * database; `storage_key` points to object storage once that is added.
 *
 * Fictional demo CVs from knowledge/synthetic-addon are stored here too, with
 * `is_synthetic = true`, their dataset id in `external_id` and the fictional
 * CV text inline (they have no file). They belong to a system user, not to a
 * real person.
 */
export const cvDocumentsTable = pgTable(
  "cv_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => userProfilesTable.id, {
      onDelete: "set null",
    }),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    pageCount: integer("page_count"),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key"),
    status: cvDocumentStatusEnum("status").notNull().default("uploaded"),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    /** Dataset id of a synthetic CV (e.g. SYN_PROFILE_0001). */
    externalId: text("external_id"),
    /** Fictional candidate name (synthetic CVs only). */
    candidateName: text("candidate_name"),
    /** Plain CV text (synthetic CVs only; real CV files stay in object storage). */
    cvText: text("cv_text"),
    targetOccupationId: text("target_occupation_id").references(
      () => occupationsTable.occupationId,
      { onUpdate: "cascade" },
    ),
    /** Other dataset attributes (state, education, years, provenance). */
    fixtureAttributes: jsonb("fixture_attributes")
      .$type<Record<string, string | number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    retentionExpiresAt: timestamp("retention_expires_at", {
      withTimezone: true,
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cv_documents_user_idx").on(t.userId, t.createdAt),
    index("cv_documents_sha_idx").on(t.sha256),
    uniqueIndex("cv_documents_external_id_unique").on(t.externalId),
    index("cv_documents_synthetic_idx").on(t.isSynthetic, t.externalId),
    check(
      "cv_documents_synthetic_fields",
      sql`not ${t.isSynthetic} or (${t.externalId} is not null and ${t.candidateName} is not null and ${t.cvText} is not null)`,
    ),
    check(
      "cv_documents_byte_size_range",
      sql`${t.byteSize} > 0 and ${t.byteSize} <= 5242880`,
    ),
    check(
      "cv_documents_page_count_positive",
      sql`${t.pageCount} is null or ${t.pageCount} > 0`,
    ),
  ],
);

export const cvClaimTypeEnum = pgEnum("cv_claim_type", [
  "skill",
  "education",
  "experience",
  "industry",
  "other",
  "certification",
]);

export const extractionMethodEnum = pgEnum("cv_extraction_method", [
  "rule_based",
  "ai_model",
  "manual",
  /** Claim shipped with the synthetic dataset (not extracted by this app). */
  "synthetic_fixture",
]);

/**
 * Human verification outcome. The last three mirror the reviewer decisions
 * EVIDENCE_SUFFICIENT / REQUEST_MORE_EVIDENCE / ESCALATED. A decision is
 * always made by a person; AI never sets these.
 */
export const cvClaimStatusEnum = pgEnum("cv_claim_status", [
  "pending_review",
  "accepted",
  "rejected",
  "evidence_sufficient",
  "more_evidence_requested",
  "escalated",
]);

/** A single statement extracted from a CV (e.g. "has Python, level 3"). */
export const cvClaimsTable = pgTable(
  "cv_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvDocumentId: uuid("cv_document_id")
      .notNull()
      .references(() => cvDocumentsTable.id, { onDelete: "cascade" }),
    claimType: cvClaimTypeEnum("claim_type").notNull(),
    skillId: text("skill_id").references(() => skillsTable.skillId, {
      onUpdate: "cascade",
    }),
    claimedValue: text("claimed_value").notNull(),
    proficiency: smallint("proficiency"),
    extractionMethod: extractionMethodEnum("extraction_method").notNull(),
    /** Model name when extraction_method = ai_model. */
    extractionModel: text("extraction_model"),
    confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }),
    status: cvClaimStatusEnum("status").notNull().default("pending_review"),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    /** Dataset id of a synthetic claim (e.g. SYN_CLAIM_00001). */
    externalId: text("external_id"),
    /** Dataset review-case id when the claim is one of the curated review cases. */
    reviewCaseId: text("review_case_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cv_claims_document_idx").on(t.cvDocumentId),
    uniqueIndex("cv_claims_external_id_unique").on(t.externalId),
    uniqueIndex("cv_claims_review_case_unique").on(t.reviewCaseId),
    check(
      "cv_claims_fixture_has_external_id",
      sql`(${t.extractionMethod} = 'synthetic_fixture') = (${t.externalId} is not null)`,
    ),
    check(
      "cv_claims_fixture_is_synthetic",
      sql`${t.extractionMethod} <> 'synthetic_fixture' or ${t.isSynthetic}`,
    ),
    index("cv_claims_skill_idx").on(t.skillId),
    index("cv_claims_status_idx").on(t.status),
    check(
      "cv_claims_skill_requires_skill_id",
      sql`(${t.claimType} = 'skill') = (${t.skillId} is not null)`,
    ),
    check(
      "cv_claims_proficiency_range",
      sql`${t.proficiency} is null or ${t.proficiency} between 1 and 5`,
    ),
    check(
      "cv_claims_confidence_range",
      sql`${t.confidence} is null or ${t.confidence} between 0 and 1`,
    ),
  ],
);

export const cvEvidenceKindEnum = pgEnum("cv_evidence_kind", [
  /** Verbatim text from the CV itself. */
  "cv_quote",
  /** Fictional placeholder metadata from the synthetic dataset. Not a document. */
  "simulated_document_metadata",
]);

/**
 * Evidence for a claim: either verbatim CV text (`cv_quote`) or, for the
 * synthetic dataset, fictional placeholder metadata that must never be shown
 * or treated as a real, externally verified credential (enforced below).
 */
export const cvClaimEvidenceTable = pgTable(
  "cv_claim_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => cvClaimsTable.id, { onDelete: "cascade" }),
    kind: cvEvidenceKindEnum("kind").notNull().default("cv_quote"),
    /** Verbatim CV text (required for cv_quote). */
    quote: text("quote"),
    pageNumber: integer("page_number"),
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    /** Dataset id of synthetic evidence (e.g. SYN_EVIDENCE_00001). */
    externalId: text("external_id"),
    documentTitle: text("document_title"),
    issuerName: text("issuer_name"),
    description: text("description"),
    /** Confirmed by the issuing institution. Always false for synthetic evidence. */
    verifiedExternal: boolean("verified_external").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("cv_claim_evidence_claim_idx").on(t.claimId),
    uniqueIndex("cv_claim_evidence_external_id_unique").on(t.externalId),
    check(
      "cv_claim_evidence_quote_not_blank",
      sql`${t.quote} is null or length(btrim(${t.quote})) > 0`,
    ),
    check(
      "cv_claim_evidence_kind_fields",
      sql`(${t.kind} = 'cv_quote' and ${t.quote} is not null)
        or (${t.kind} = 'simulated_document_metadata' and ${t.documentTitle} is not null and ${t.isSynthetic})`,
    ),
    check(
      "cv_claim_evidence_synthetic_never_verified",
      sql`not (${t.isSynthetic} and ${t.verifiedExternal})`,
    ),
    check(
      "cv_claim_evidence_page_positive",
      sql`${t.pageNumber} is null or ${t.pageNumber} > 0`,
    ),
    check(
      "cv_claim_evidence_char_range",
      sql`(${t.charStart} is null and ${t.charEnd} is null)
        or (${t.charStart} >= 0 and ${t.charEnd} >= ${t.charStart})`,
    ),
  ],
);

export const insertCvDocumentSchema = createInsertSchema(cvDocumentsTable).omit(
  { id: true, createdAt: true, updatedAt: true },
);
export type InsertCvDocument = z.infer<typeof insertCvDocumentSchema>;
export type CvDocument = typeof cvDocumentsTable.$inferSelect;

export const insertCvClaimSchema = createInsertSchema(cvClaimsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCvClaim = z.infer<typeof insertCvClaimSchema>;
export type CvClaim = typeof cvClaimsTable.$inferSelect;

export const insertCvClaimEvidenceSchema = createInsertSchema(
  cvClaimEvidenceTable,
).omit({ id: true, createdAt: true });
export type InsertCvClaimEvidence = z.infer<typeof insertCvClaimEvidenceSchema>;
export type CvClaimEvidence = typeof cvClaimEvidenceTable.$inferSelect;
