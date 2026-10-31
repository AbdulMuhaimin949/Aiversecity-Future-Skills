import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { createdAt, updatedAt } from "./common";
import { cvClaimsTable } from "./cv";
import { careerMatchResultsTable } from "./matches";
import { languagesTable, usersTable } from "./users";

export const appealStatusEnum = pgEnum("appeal_status", [
  "submitted",
  "under_review",
  "upheld",
  "rejected",
  "withdrawn",
]);

/** An applicant challenging a CV claim decision or a career match result. */
export const appealsTable = pgTable(
  "appeals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantUserId: uuid("applicant_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    cvClaimId: uuid("cv_claim_id").references(() => cvClaimsTable.id, {
      onDelete: "set null",
    }),
    careerMatchResultId: uuid("career_match_result_id").references(
      () => careerMatchResultsTable.id,
      { onDelete: "set null" },
    ),
    reason: text("reason").notNull(),
    language: text("language")
      .notNull()
      .default("ms")
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    status: appealStatusEnum("status").notNull().default("submitted"),
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appeals_applicant_idx").on(t.applicantUserId, t.submittedAt),
    index("appeals_status_idx").on(t.status),
    // One open appeal per applicant and claim.
    uniqueIndex("appeals_one_open_per_claim")
      .on(t.applicantUserId, t.cvClaimId)
      .where(sql`${t.status} in ('submitted', 'under_review') and ${t.cvClaimId} is not null`),
    check("appeals_reason_not_blank", sql`length(btrim(${t.reason})) > 0`),
    check(
      "appeals_resolved_consistent",
      sql`(${t.status} in ('upheld', 'rejected')) = (${t.resolvedAt} is not null)`,
    ),
    check(
      "appeals_resolved_after_submitted",
      sql`${t.resolvedAt} is null or ${t.resolvedAt} >= ${t.submittedAt}`,
    ),
  ],
);

/**
 * CV claims use evidence_sufficient / request_more_evidence / escalated.
 * Appeals use approved (appeal upheld) / rejected (decision stands).
 */
export const reviewDecisionEnum = pgEnum("review_decision", [
  "approved",
  "rejected",
  "needs_changes",
  "escalated",
  "evidence_sufficient",
  "request_more_evidence",
]);

/**
 * A human reviewer's decision on exactly one subject: a CV claim, a career
 * match result or an appeal.
 */
export const reviewDecisionsTable = pgTable(
  "review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    cvClaimId: uuid("cv_claim_id").references(() => cvClaimsTable.id, {
      onDelete: "cascade",
    }),
    // FK declared below with a short name (the default exceeds 63 chars).
    careerMatchResultId: uuid("career_match_result_id"),
    appealId: uuid("appeal_id").references(() => appealsTable.id, {
      onDelete: "cascade",
    }),
    decision: reviewDecisionEnum("decision").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "review_decisions_match_fk",
      columns: [t.careerMatchResultId],
      foreignColumns: [careerMatchResultsTable.id],
    }).onDelete("cascade"),
    index("review_decisions_reviewer_idx").on(t.reviewerUserId, t.createdAt),
    index("review_decisions_cv_claim_idx").on(t.cvClaimId),
    index("review_decisions_match_idx").on(t.careerMatchResultId),
    index("review_decisions_appeal_idx").on(t.appealId),
    check(
      "review_decisions_exactly_one_subject",
      sql`num_nonnulls(${t.cvClaimId}, ${t.careerMatchResultId}, ${t.appealId}) = 1`,
    ),
    check(
      "review_decisions_rationale_not_blank",
      sql`length(btrim(${t.rationale})) > 0`,
    ),
  ],
);

/** Append-only record of who did what. Entity IDs are stored as text. */
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /** e.g. "system", "user", "import-script". */
    actorType: text("actor_type").notNull().default("user"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const insertAppealSchema = createInsertSchema(appealsTable).omit({
  id: true,
  submittedAt: true,
  updatedAt: true,
});
export type InsertAppeal = z.infer<typeof insertAppealSchema>;
export type Appeal = typeof appealsTable.$inferSelect;

export const insertReviewDecisionSchema = createInsertSchema(
  reviewDecisionsTable,
).omit({ id: true, createdAt: true });
export type InsertReviewDecision = z.infer<typeof insertReviewDecisionSchema>;
export type ReviewDecision = typeof reviewDecisionsTable.$inferSelect;

// `id` is GENERATED ALWAYS, so drizzle-zod already leaves it out.
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
