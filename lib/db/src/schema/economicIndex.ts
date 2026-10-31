import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./common";
import { occupationsTable } from "./catalogue";

/**
 * Anthropic Economic Index task-level AI usage indicators.
 * Mapped to CTRL CV occupations without altering deterministic matching scores.
 */
export const anthropicEconomicIndexTable = pgTable(
  "anthropic_economic_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: text("release_id").notNull(),
    measurementPeriod: text("measurement_period").notNull(),
    occupationCategory: text("occupation_category").notNull(),
    occupationId: text("occupation_id").references(
      () => occupationsTable.occupationId,
      { onUpdate: "cascade", onDelete: "set null" },
    ),
    taskName: text("task_name").notNull(),
    taskDescription: text("task_description"),
    aiUsageIntensity: numeric("ai_usage_intensity", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    augmentationShare: numeric("augmentation_share", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    automationShare: numeric("automation_share", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    confidenceLevel: text("confidence_level").notNull().default("HIGH"),
    methodologyUrl: text("methodology_url")
      .notNull()
      .default("https://www.anthropic.com/economic-index"),
    datasetUrl: text("dataset_url")
      .notNull()
      .default("https://huggingface.co/datasets/Anthropic/EconomicIndex"),
    mcpEndpoint: text("mcp_endpoint")
      .notNull()
      .default("https://econ-index.mcp.claude.com/mcp"),
    retrievalTimestamp: timestamp("retrieval_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("anthropic_econ_release_idx").on(t.releaseId),
    index("anthropic_econ_occupation_idx").on(t.occupationId),
    index("anthropic_econ_category_idx").on(t.occupationCategory),
  ],
);

