import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { occupationsTable, skillsTable } from "./catalogue";
import { createdAt, updatedAt } from "./common";

/**
 * Fictional hackathon fixtures from knowledge/synthetic-addon that have no
 * real-world counterpart. They live in their own tables so they can never be
 * mixed into the pipeline's demand forecasts or the HRD Corp e-LATiH course
 * catalogue (which the API serves from the pipeline CSVs, not from here).
 * Every row is synthetic, enforced by checks; ids are the dataset ids so
 * re-imports are idempotent.
 */

/** synthetic_learning_resources.csv: fictional practice labs, not actual courses. */
export const syntheticLearningResourcesTable = pgTable(
  "synthetic_learning_resources",
  {
    resourceId: text("resource_id").primaryKey(),
    title: text("title").notNull(),
    providerName: text("provider_name").notNull(),
    providerUrl: text("provider_url"),
    deliveryMode: text("delivery_mode").notNull(),
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2, mode: "number" }).notNull(),
    costAmount: numeric("cost_amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    prerequisiteLevel: text("prerequisite_level").notNull(),
    availabilityStatus: text("availability_status").notNull(),
    /** Dataset id of the fictional generator (e.g. SYN_AIVERSECITY_V1), not a data_sources row. */
    datasetId: text("dataset_id").notNull(),
    isSynthetic: boolean("is_synthetic").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("synthetic_learning_resources_is_synthetic", sql`${t.isSynthetic}`),
    check(
      "synthetic_learning_resources_not_a_course",
      sql`${t.availabilityStatus} = 'NOT_AN_ACTUAL_COURSE'`,
    ),
    check("synthetic_learning_resources_hours", sql`${t.estimatedHours} > 0`),
    check("synthetic_learning_resources_cost", sql`${t.costAmount} >= 0`),
  ],
);

/** Skills a fictional practice lab targets (target_skill_ids). */
export const syntheticLearningResourceSkillsTable = pgTable(
  "synthetic_learning_resource_skills",
  {
    resourceId: text("resource_id").notNull(),
    skillId: text("skill_id").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ name: "synthetic_learning_resource_skills_pk", columns: [t.resourceId, t.skillId] }),
    // Explicit names: generated ones exceed 63 chars and cause push drift.
    foreignKey({
      name: "syn_lrn_skills_resource_fk",
      columns: [t.resourceId],
      foreignColumns: [syntheticLearningResourcesTable.resourceId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "syn_lrn_skills_skill_fk",
      columns: [t.skillId],
      foreignColumns: [skillsTable.skillId],
    }).onUpdate("cascade"),
    index("synthetic_learning_resource_skills_skill_idx").on(t.skillId),
  ],
);

/** synthetic_trend_scenarios.csv: a fictional quarterly demand index per occupation. */
export const syntheticTrendScenariosTable = pgTable(
  "synthetic_trend_scenarios",
  {
    observationId: text("observation_id").primaryKey(),
    occupationId: text("occupation_id").notNull(),
    /** Calendar quarter, e.g. 2025Q1. */
    quarter: text("quarter").notNull(),
    scenarioIndex: numeric("scenario_index", { precision: 8, scale: 2, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    geography: text("geography").notNull(),
    disclaimer: text("disclaimer").notNull(),
    datasetId: text("dataset_id").notNull(),
    isSynthetic: boolean("is_synthetic").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "syn_trend_occupation_fk",
      columns: [t.occupationId],
      foreignColumns: [occupationsTable.occupationId],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("synthetic_trend_scenarios_occ_quarter_unique").on(t.occupationId, t.quarter),
    check("synthetic_trend_scenarios_is_synthetic", sql`${t.isSynthetic}`),
    check("synthetic_trend_scenarios_unit", sql`${t.unit} = 'FICTIONAL_DEMAND_INDEX'`),
    check("synthetic_trend_scenarios_quarter", sql`${t.quarter} ~ '^[0-9]{4}Q[1-4]$'`),
  ],
);

export type SyntheticLearningResource = typeof syntheticLearningResourcesTable.$inferSelect;
export type InsertSyntheticLearningResource = typeof syntheticLearningResourcesTable.$inferInsert;
export type InsertSyntheticLearningResourceSkill = typeof syntheticLearningResourceSkillsTable.$inferInsert;
export type SyntheticTrendScenario = typeof syntheticTrendScenariosTable.$inferSelect;
export type InsertSyntheticTrendScenario = typeof syntheticTrendScenariosTable.$inferInsert;
