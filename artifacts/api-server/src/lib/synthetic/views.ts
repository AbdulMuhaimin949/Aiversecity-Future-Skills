/**
 * Read-only views of the fictional practice labs and demand-trend scenarios
 * (knowledge/synthetic-addon, imported into the synthetic_* tables or loaded from CSV).
 * They are served on their own endpoints and never merged into the pipeline's e-LATiH
 * pathway steps or demand forecasts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  occupationsTable,
  skillsTable,
  syntheticLearningResourceSkillsTable,
  syntheticLearningResourcesTable,
  syntheticTrendScenariosTable,
} from "@workspace/db";
import { data } from "../data";
import { logger } from "../logger";

export const SYNTHETIC_LABS_DISCLAIMER =
  "Fictional practice labs from the CTRL CV synthetic hackathon dataset. They are not actual courses, not part of the HRD Corp e-LATiH catalogue, and not counted in your pathway hours.";

const DEFAULT_TREND = {
  unit: "FICTIONAL_DEMAND_INDEX",
  geography: "MALAYSIA_FICTIONAL_SCENARIO",
  disclaimer: "Not a real employment statistic or forecast",
};

const LEVEL_ORDER: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

function findSyntheticFile(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), "knowledge/synthetic-addon", name),
    path.resolve(process.cwd(), "../../knowledge/synthetic-addon", name),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../knowledge/synthetic-addon", name),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../knowledge/synthetic-addon", name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function syntheticTrendScenarioFromCsv(occupationId: string) {
  const file = findSyntheticFile("synthetic_trend_scenarios.csv");
  if (!file) return null;
  const content = fs.readFileSync(file, "utf-8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, bom: true }) as Array<{
    observation_id: string;
    occupation_id: string;
    quarter: string;
    scenario_index: string;
    unit: string;
    geography: string;
    is_synthetic: string;
    source_id: string;
    disclaimer: string;
  }>;
  const matches = rows.filter((r) => r.occupation_id === occupationId);
  if (matches.length === 0) return null;
  const first = matches[0];
  return {
    occupationId,
    isSynthetic: true as const,
    unit: first?.unit ?? DEFAULT_TREND.unit,
    geography: first?.geography ?? DEFAULT_TREND.geography,
    disclaimer: first?.disclaimer ?? DEFAULT_TREND.disclaimer,
    datasetId: first?.source_id ?? "",
    points: matches.map((r) => ({
      observationId: r.observation_id,
      quarter: r.quarter,
      index: Number(r.scenario_index) || 0,
    })),
  };
}

function syntheticLabsFromCsv(skillIds: string[]) {
  if (skillIds.length === 0) return { disclaimer: SYNTHETIC_LABS_DISCLAIMER, resources: [] };
  const file = findSyntheticFile("synthetic_learning_resources.csv");
  if (!file) return { disclaimer: SYNTHETIC_LABS_DISCLAIMER, resources: [] };
  const content = fs.readFileSync(file, "utf-8");
  const rows = parse(content, { columns: true, skip_empty_lines: true, bom: true }) as Array<{
    resource_id: string;
    course_title: string;
    provider_name: string;
    provider_url: string;
    delivery_mode: string;
    estimated_hours: string;
    cost_amount: string;
    currency: string;
    prerequisite_level: string;
    target_skill_ids: string;
    is_synthetic: string;
    availability_status: string;
    source_id: string;
  }>;

  const targetSet = new Set(skillIds);
  const matching = rows.filter((r) => {
    const sids = (r.target_skill_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    return sids.some((id) => targetSet.has(id));
  });

  const skillRank = new Map(skillIds.map((id, i) => [id, i]));
  const rank = (sids: string[]) =>
    Math.min(...sids.map((id) => skillRank.get(id) ?? Infinity));

  matching.sort((a, b) => {
    const sidsA = (a.target_skill_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    const sidsB = (b.target_skill_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    return (
      rank(sidsA) - rank(sidsB) ||
      (LEVEL_ORDER[a.prerequisite_level] ?? 9) - (LEVEL_ORDER[b.prerequisite_level] ?? 9) ||
      a.resource_id.localeCompare(b.resource_id)
    );
  });

  return {
    disclaimer: SYNTHETIC_LABS_DISCLAIMER,
    resources: matching.map((r) => {
      const sids = (r.target_skill_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
      return {
        resourceId: r.resource_id,
        title: r.course_title,
        provider: r.provider_name,
        deliveryMode: r.delivery_mode,
        estimatedHours: Number(r.estimated_hours) || 0,
        cost: Number(r.cost_amount) || 0,
        currency: r.currency || "MYR",
        level: r.prerequisite_level,
        availabilityStatus: r.availability_status,
        datasetId: r.source_id,
        isSynthetic: true as const,
        targetSkills: sids.map((sid) => ({
          skillId: sid,
          name: data.skillById.get(sid)?.name ?? sid,
        })),
      };
    }),
  };
}

/** Null when the occupation is not in the database catalogue. */
export async function syntheticTrendScenario(occupationId: string) {
  try {
    const [occ] = await db
      .select({ id: occupationsTable.occupationId })
      .from(occupationsTable)
      .where(eq(occupationsTable.occupationId, occupationId));
    if (!occ) return null;
    const rows = await db
      .select()
      .from(syntheticTrendScenariosTable)
      .where(eq(syntheticTrendScenariosTable.occupationId, occupationId))
      .orderBy(asc(syntheticTrendScenariosTable.quarter));
    const first = rows[0];
    return {
      occupationId,
      isSynthetic: true as const,
      unit: first?.unit ?? DEFAULT_TREND.unit,
      geography: first?.geography ?? DEFAULT_TREND.geography,
      disclaimer: first?.disclaimer ?? DEFAULT_TREND.disclaimer,
      datasetId: first?.datasetId ?? "",
      points: rows.map((r) => ({ observationId: r.observationId, quarter: r.quarter, index: r.scenarioIndex })),
    };
  } catch (err) {
    logger.debug({ err }, "Database unavailable for syntheticTrendScenario, falling back to CSV");
    return syntheticTrendScenarioFromCsv(occupationId);
  }
}

export async function syntheticLabsForSkills(skillIds: string[]) {
  if (skillIds.length === 0) return { disclaimer: SYNTHETIC_LABS_DISCLAIMER, resources: [] };
  try {
    const matching = await db
      .selectDistinct({ id: syntheticLearningResourceSkillsTable.resourceId })
      .from(syntheticLearningResourceSkillsTable)
      .where(inArray(syntheticLearningResourceSkillsTable.skillId, skillIds));
    const ids = matching.map((m) => m.id);
    if (ids.length === 0) return { disclaimer: SYNTHETIC_LABS_DISCLAIMER, resources: [] };

    const [resources, links] = await Promise.all([
      db.select().from(syntheticLearningResourcesTable).where(inArray(syntheticLearningResourcesTable.resourceId, ids)),
      db
        .select({
          resourceId: syntheticLearningResourceSkillsTable.resourceId,
          skillId: syntheticLearningResourceSkillsTable.skillId,
          name: skillsTable.canonicalName,
          position: syntheticLearningResourceSkillsTable.position,
        })
        .from(syntheticLearningResourceSkillsTable)
        .innerJoin(skillsTable, eq(skillsTable.skillId, syntheticLearningResourceSkillsTable.skillId))
        .where(inArray(syntheticLearningResourceSkillsTable.resourceId, ids))
        .orderBy(asc(syntheticLearningResourceSkillsTable.position)),
    ]);
    const skillsByResource = new Map<string, { skillId: string; name: string }[]>();
    for (const l of links) {
      const list = skillsByResource.get(l.resourceId) ?? [];
      list.push({ skillId: l.skillId, name: l.name });
      skillsByResource.set(l.resourceId, list);
    }
    // Order by the requested skill order, then level, then id.
    const skillRank = new Map(skillIds.map((id, i) => [id, i]));
    const rank = (id: string) =>
      Math.min(...(skillsByResource.get(id) ?? []).map((s) => skillRank.get(s.skillId) ?? Infinity));
    resources.sort(
      (a, b) =>
        rank(a.resourceId) - rank(b.resourceId) ||
        (LEVEL_ORDER[a.prerequisiteLevel] ?? 9) - (LEVEL_ORDER[b.prerequisiteLevel] ?? 9) ||
        a.resourceId.localeCompare(b.resourceId),
    );
    return {
      disclaimer: SYNTHETIC_LABS_DISCLAIMER,
      resources: resources.map((r) => ({
        resourceId: r.resourceId,
        title: r.title,
        provider: r.providerName,
        deliveryMode: r.deliveryMode,
        estimatedHours: r.estimatedHours,
        cost: r.costAmount,
        currency: r.currency,
        level: r.prerequisiteLevel,
        availabilityStatus: r.availabilityStatus,
        datasetId: r.datasetId,
        isSynthetic: true as const,
        targetSkills: skillsByResource.get(r.resourceId) ?? [],
      })),
    };
  } catch (err) {
    logger.debug({ err }, "Database unavailable for syntheticLabsForSkills, falling back to CSV");
    return syntheticLabsFromCsv(skillIds);
  }
}
