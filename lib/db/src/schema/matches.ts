import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { occupationsTable } from "./catalogue";
import { userProfilesTable } from "./users";

export const scenarioEnum = pgEnum("disruption_scenario", [
  "baseline",
  "moderate",
  "fast",
]);

const score = (name: string) =>
  numeric(name, { precision: 6, scale: 4, mode: "number" });

/**
 * A saved career match for one profile, occupation and scenario.
 * Scores are estimates produced by the documented matching formula;
 * `method_version` records which formula version produced them.
 */
export const careerMatchResultsTable = pgTable(
  "career_match_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    occupationId: text("occupation_id")
      .notNull()
      .references(() => occupationsTable.occupationId, {
        onUpdate: "cascade",
      }),
    scenario: scenarioEnum("scenario").notNull().default("baseline"),
    /** Overall match score, 0–100. */
    matchScore: numeric("match_score", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    skillOverlapScore: score("skill_overlap_score"),
    proficiencyScore: score("proficiency_score"),
    readinessScore: score("readiness_score"),
    motivationScore: score("motivation_score"),
    /** Gaps, matched skills and other explanation shown to the applicant. */
    explanation: jsonb("explanation")
      .notNull()
      .default(sql`'{}'::jsonb`),
    methodVersion: text("method_version").notNull(),
    isEstimate: boolean("is_estimate").notNull().default(true),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("career_match_results_profile_idx").on(
      t.profileId,
      t.scenario,
      t.matchScore.desc(),
    ),
    index("career_match_results_occupation_idx").on(t.occupationId),
    check(
      "career_match_results_score_range",
      sql`${t.matchScore} between 0 and 100`,
    ),
    check(
      "career_match_results_components_range",
      sql`coalesce(${t.skillOverlapScore}, 0) between 0 and 1
        and coalesce(${t.proficiencyScore}, 0) between 0 and 1
        and coalesce(${t.readinessScore}, 0) between 0 and 1
        and coalesce(${t.motivationScore}, 0) between 0 and 1`,
    ),
  ],
);

export const insertCareerMatchResultSchema = createInsertSchema(
  careerMatchResultsTable,
).omit({ id: true, computedAt: true });
export type InsertCareerMatchResult = z.infer<
  typeof insertCareerMatchResultSchema
>;
export type CareerMatchResult = typeof careerMatchResultsTable.$inferSelect;
