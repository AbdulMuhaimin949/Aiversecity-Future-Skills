/**
 * Imports the fictional practice labs and demand-trend scenarios from
 * knowledge/synthetic-addon:
 *   synthetic_learning_resources.csv -> synthetic_learning_resources (+ _skills)
 *   synthetic_trend_scenarios.csv    -> synthetic_trend_scenarios
 *
 * Rules:
 * - These are fictional fixtures. They go into their own tables and are never
 *   merged into the pipeline's e-LATiH course catalogue or demand forecasts.
 *   Rows must say so themselves (is_synthetic, NOT_AN_ACTUAL_COURSE,
 *   FICTIONAL_DEMAND_INDEX); anything that looks like a real e-LATiH / HRD
 *   Corp course is rejected.
 * - Every occupation and skill id must exist in the imported catalogue.
 * - Idempotent: rows are upserted by dataset id and the table contents are made
 *   to match the CSVs exactly (rows no longer in the CSVs are removed; no user
 *   data references these tables).
 * - Everything is validated before anything is written; any problem aborts.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  ingestionRunsTable,
  occupationsTable,
  pool,
  skillsTable,
  syntheticLearningResourceSkillsTable,
  syntheticLearningResourcesTable,
  syntheticTrendScenariosTable,
  type InsertSyntheticLearningResource,
  type InsertSyntheticLearningResourceSkill,
  type InsertSyntheticTrendScenario,
} from "@workspace/db";
import { lineOf, readCsvFile, Validator } from "./import";
import { resolveSyntheticAddonDir } from "./syntheticCv";

export const SYNTHETIC_LEARNING_RUN_TYPE = "synthetic_learning_trends_import";

export const SYNTHETIC_LEARNING_FILES = [
  "synthetic_learning_resources.csv",
  "synthetic_trend_scenarios.csv",
] as const;

const CHUNK_SIZE = 500;
const REAL_PROVIDER = /e-?latih|hrd\s*corp|hrdcorp/i;

type Row = Record<string, string>;
type Table = "synthetic_learning_resources" | "synthetic_learning_resource_skills" | "synthetic_trend_scenarios";

export function syntheticLearningFingerprint(dir: string): string {
  const hash = createHash("sha256");
  for (const name of SYNTHETIC_LEARNING_FILES) {
    hash.update(name).update("\0").update(fs.readFileSync(path.join(dir, name))).update("\0");
  }
  return hash.digest("hex");
}

function requireTrue(v: Validator, row: Row, line: number, col: string) {
  if (!v.bool(row, line, col)) v.fail(line, `"${col}" must be true: every add-on row is synthetic`);
}

const splitIds = (raw: string) =>
  raw
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function buildResources(rows: Row[], v: Validator, skillIds: Set<string>) {
  const seen = new Set<string>();
  const resources: InsertSyntheticLearningResource[] = [];
  const links: InsertSyntheticLearningResourceSkill[] = [];
  rows.forEach((r, i) => {
    const line = lineOf(i);
    const resourceId = v.required(r, line, "resource_id");
    v.unique(line, "resource_id", resourceId, seen);
    if (resourceId && !/^SYN_LRN_\d+$/.test(resourceId)) v.fail(line, `"resource_id" = "${resourceId}" is not a SYN_LRN id`);
    requireTrue(v, r, line, "is_synthetic");
    v.oneOf(r, line, "availability_status", ["NOT_AN_ACTUAL_COURSE"]);
    const providerName = v.required(r, line, "provider_name");
    const providerUrl = v.optional(r, "provider_url");
    if (REAL_PROVIDER.test(providerName) || (providerUrl && REAL_PROVIDER.test(providerUrl))) {
      v.fail(line, "looks like a real e-LATiH / HRD Corp course; fictional labs must not be mixed with that catalogue");
    }
    const ids = splitIds(v.required(r, line, "target_skill_ids"));
    if (ids.length === 0) v.fail(line, `"target_skill_ids" lists no skills`);
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) v.fail(line, `"target_skill_ids" repeats a skill`);
    unique.forEach((skillId, position) => {
      v.reference(line, "target_skill_ids", skillId, skillIds, "skills (run db:import-catalogue first)");
      links.push({ resourceId, skillId, position });
    });
    resources.push({
      resourceId,
      title: v.required(r, line, "course_title"),
      providerName,
      providerUrl,
      deliveryMode: v.required(r, line, "delivery_mode"),
      estimatedHours: v.decimal(r, line, "estimated_hours", 0.01, 1000),
      costAmount: v.decimal(r, line, "cost_amount", 0, 1_000_000),
      currency: v.required(r, line, "currency"),
      prerequisiteLevel: v.required(r, line, "prerequisite_level"),
      availabilityStatus: "NOT_AN_ACTUAL_COURSE",
      datasetId: v.required(r, line, "source_id"),
      isSynthetic: true,
    });
  });
  return { resources, links };
}

function buildTrends(rows: Row[], v: Validator, occupationIds: Set<string>): InsertSyntheticTrendScenario[] {
  const seen = new Set<string>();
  const seenPair = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const observationId = v.required(r, line, "observation_id");
    v.unique(line, "observation_id", observationId, seen);
    requireTrue(v, r, line, "is_synthetic");
    const occupationId = v.required(r, line, "occupation_id");
    v.reference(line, "occupation_id", occupationId, occupationIds, "occupations (run db:import-catalogue first)");
    const quarter = v.required(r, line, "quarter");
    if (quarter && !/^\d{4}Q[1-4]$/.test(quarter)) v.fail(line, `"quarter" = "${quarter}" is not like 2025Q1`);
    v.unique(line, "occupation_id + quarter", `${occupationId} ${quarter}`, seenPair);
    v.oneOf(r, line, "unit", ["FICTIONAL_DEMAND_INDEX"]);
    const geography = v.required(r, line, "geography");
    if (geography && !/FICTIONAL/i.test(geography)) v.fail(line, `"geography" = "${geography}" must be marked fictional`);
    return {
      observationId,
      occupationId,
      quarter,
      scenarioIndex: v.decimal(r, line, "scenario_index", 0, 100_000),
      unit: "FICTIONAL_DEMAND_INDEX",
      geography,
      disclaimer: v.required(r, line, "disclaimer"),
      datasetId: v.required(r, line, "source_id"),
      isSynthetic: true,
    };
  });
}

export interface SyntheticLearningImportResult {
  runId: string;
  fingerprint: string;
  rows: Record<Table, number>;
  inserted: Record<Table, number>;
  /** Rows removed because they are no longer in the CSVs. */
  removed: Record<Table, number>;
}

/** Validates and imports both files. Throws (after recording a failed run) on any problem. */
export async function importSyntheticLearning(
  options: { dir?: string; actorType?: string } = {},
): Promise<SyntheticLearningImportResult> {
  const dir = options.dir ?? resolveSyntheticAddonDir();
  const actorType = options.actorType ?? "import-script";
  const fingerprint = syntheticLearningFingerprint(dir);

  const occupationIds = new Set(
    (await db.select({ id: occupationsTable.occupationId }).from(occupationsTable)).map((r) => r.id),
  );
  const skillIds = new Set((await db.select({ id: skillsTable.skillId }).from(skillsTable)).map((r) => r.id));

  const resourceV = new Validator("synthetic_learning_resources.csv");
  const { resources, links } = buildResources(
    readCsvFile(path.join(dir, "synthetic_learning_resources.csv")),
    resourceV,
    skillIds,
  );
  const trendV = new Validator("synthetic_trend_scenarios.csv");
  const trends = buildTrends(readCsvFile(path.join(dir, "synthetic_trend_scenarios.csv")), trendV, occupationIds);
  const errors = [...resourceV.errors, ...trendV.errors];

  const [run] = await db
    .insert(ingestionRunsTable)
    .values({ runType: SYNTHETIC_LEARNING_RUN_TYPE, status: "running", recordsSeen: resources.length + trends.length })
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
      `Synthetic learning/trend import aborted, nothing was written. ${errors.length} problem(s):\n  ${errors.slice(0, 25).join("\n  ")}${more}`,
    );
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const inserted: Record<Table, number> = {
        synthetic_learning_resources: 0,
        synthetic_learning_resource_skills: 0,
        synthetic_trend_scenarios: 0,
      };
      const removed = { ...inserted };
      const resourceIds = resources.map((r) => r.resourceId);
      const observationIds = trends.map((t) => t.observationId);

      // Remove rows that left the CSVs first so the (occupation, quarter) key can be reused.
      removed.synthetic_trend_scenarios = (
        await tx
          .delete(syntheticTrendScenariosTable)
          .where(observationIds.length ? notInArray(syntheticTrendScenariosTable.observationId, observationIds) : sql`true`)
          .returning({ id: syntheticTrendScenariosTable.observationId })
      ).length;
      removed.synthetic_learning_resources = (
        await tx
          .delete(syntheticLearningResourcesTable)
          .where(resourceIds.length ? notInArray(syntheticLearningResourcesTable.resourceId, resourceIds) : sql`true`)
          .returning({ id: syntheticLearningResourcesTable.resourceId })
      ).length;

      for (let i = 0; i < resources.length; i += CHUNK_SIZE) {
        const res = await tx
          .insert(syntheticLearningResourcesTable)
          .values(resources.slice(i, i + CHUNK_SIZE))
          .onConflictDoUpdate({
            target: syntheticLearningResourcesTable.resourceId,
            set: {
              title: sql`excluded.title`,
              providerName: sql`excluded.provider_name`,
              providerUrl: sql`excluded.provider_url`,
              deliveryMode: sql`excluded.delivery_mode`,
              estimatedHours: sql`excluded.estimated_hours`,
              costAmount: sql`excluded.cost_amount`,
              currency: sql`excluded.currency`,
              prerequisiteLevel: sql`excluded.prerequisite_level`,
              availabilityStatus: sql`excluded.availability_status`,
              datasetId: sql`excluded.dataset_id`,
            },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        inserted.synthetic_learning_resources += res.filter((r) => r.inserted).length;
      }

      // Skill links are replaced wholesale for the imported resources.
      const before = await tx.select({ n: sql<number>`count(*)::int` }).from(syntheticLearningResourceSkillsTable);
      if (resourceIds.length) {
        await tx
          .delete(syntheticLearningResourceSkillsTable)
          .where(inArray(syntheticLearningResourceSkillsTable.resourceId, resourceIds));
      }
      for (let i = 0; i < links.length; i += CHUNK_SIZE) {
        await tx.insert(syntheticLearningResourceSkillsTable).values(links.slice(i, i + CHUNK_SIZE));
      }
      inserted.synthetic_learning_resource_skills = Math.max(0, links.length - (before[0]?.n ?? 0));

      for (let i = 0; i < trends.length; i += CHUNK_SIZE) {
        const res = await tx
          .insert(syntheticTrendScenariosTable)
          .values(trends.slice(i, i + CHUNK_SIZE))
          .onConflictDoUpdate({
            target: syntheticTrendScenariosTable.observationId,
            set: {
              occupationId: sql`excluded.occupation_id`,
              quarter: sql`excluded.quarter`,
              scenarioIndex: sql`excluded.scenario_index`,
              unit: sql`excluded.unit`,
              geography: sql`excluded.geography`,
              disclaimer: sql`excluded.disclaimer`,
              datasetId: sql`excluded.dataset_id`,
            },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        inserted.synthetic_trend_scenarios += res.filter((r) => r.inserted).length;
      }

      await tx.insert(auditLogsTable).values({
        actorType,
        action: "synthetic_learning.import",
        entityType: "ingestion_run",
        entityId: run.id,
        metadata: {
          fingerprint,
          inserted,
          removed,
          rows: { resources: resources.length, resourceSkills: links.length, trends: trends.length },
        },
      });
      return { inserted, removed };
    });

    await db
      .update(ingestionRunsTable)
      .set({
        status: "succeeded",
        recordsInserted: Object.values(outcome.inserted).reduce((a, b) => a + b, 0),
        details: JSON.stringify({ fingerprint, inserted: outcome.inserted, removed: outcome.removed }),
        finishedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, run.id));

    return {
      runId: run.id,
      fingerprint,
      rows: {
        synthetic_learning_resources: resources.length,
        synthetic_learning_resource_skills: links.length,
        synthetic_trend_scenarios: trends.length,
      },
      inserted: outcome.inserted,
      removed: outcome.removed,
    };
  } catch (err) {
    await markFailed(err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export interface SyntheticLearningStatus {
  rows: Record<Table, number>;
  importedFingerprint: string | null;
}

export async function syntheticLearningStatus(): Promise<SyntheticLearningStatus> {
  const count = async (table: Table) =>
    (await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)}`)).rows[0]?.n ?? 0;
  const [last] = await db
    .select({ details: ingestionRunsTable.details })
    .from(ingestionRunsTable)
    .where(and(eq(ingestionRunsTable.runType, SYNTHETIC_LEARNING_RUN_TYPE), eq(ingestionRunsTable.status, "succeeded")))
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
      synthetic_learning_resources: await count("synthetic_learning_resources"),
      synthetic_learning_resource_skills: await count("synthetic_learning_resource_skills"),
      synthetic_trend_scenarios: await count("synthetic_trend_scenarios"),
    },
    importedFingerprint,
  };
}

export type SyntheticLearningSyncOutcome =
  | { action: "up_to_date"; status: SyntheticLearningStatus }
  | { action: "imported"; status: SyntheticLearningStatus; import: SyntheticLearningImportResult }
  | { action: "skipped"; reason: string };

const LOCK_KEY = "workspace.synthetic_learning_import";

/**
 * Imports only when the last successful import used different CSV contents or
 * rows are missing. Needs the catalogue (occupations, skills) imported first.
 * Safe to call from several processes at once (advisory lock).
 */
export async function syncSyntheticLearning(
  options: { dir?: string; actorType?: string } = {},
): Promise<SyntheticLearningSyncOutcome> {
  const dir = options.dir ?? resolveSyntheticAddonDir();
  const fingerprint = syntheticLearningFingerprint(dir);
  const csvRows = {
    synthetic_learning_resources: readCsvFile(path.join(dir, "synthetic_learning_resources.csv")).length,
    synthetic_trend_scenarios: readCsvFile(path.join(dir, "synthetic_trend_scenarios.csv")).length,
  };
  const upToDate = (s: SyntheticLearningStatus) =>
    s.importedFingerprint === fingerprint &&
    s.rows.synthetic_learning_resources === csvRows.synthetic_learning_resources &&
    s.rows.synthetic_trend_scenarios === csvRows.synthetic_trend_scenarios;

  const before = await syntheticLearningStatus();
  if (upToDate(before)) return { action: "up_to_date", status: before };

  const [occ] = await db.select({ n: sql<number>`count(*)::int` }).from(occupationsTable);
  if (!occ?.n) return { action: "skipped", reason: "the career catalogue has not been imported yet" };

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("select pg_try_advisory_lock(hashtext($1)) as locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) return { action: "skipped", reason: "another process is importing the synthetic learning data" };
    try {
      const current = await syntheticLearningStatus();
      if (upToDate(current)) return { action: "up_to_date", status: current };
      const result = await importSyntheticLearning({ dir, actorType: options.actorType });
      return { action: "imported", status: await syntheticLearningStatus(), import: result };
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
