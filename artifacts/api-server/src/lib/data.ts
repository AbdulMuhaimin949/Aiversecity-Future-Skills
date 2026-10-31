import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { logger } from "./logger";

/**
 * Loads the Bronze/Silver/Gold tables produced by `pipeline/run_pipeline.py`
 * into memory once at startup. The pipeline output is the single source of
 * truth; this module only indexes it.
 */

type Row = Record<string, string>;

function resolveDataDir(): string {
  const candidates = [
    process.env["PIPELINE_DATA_DIR"],
    // dist/index.mjs -> ../../../pipeline/data (works in dev and production)
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../pipeline/data"),
    path.resolve(process.cwd(), "pipeline/data"),
    path.resolve(process.cwd(), "../../pipeline/data"),
  ].filter((p): p is string => Boolean(p));
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "gold"))) return dir;
  }
  throw new Error(
    `Pipeline data directory not found. Run "python pipeline/run_pipeline.py". Tried: ${candidates.join(", ")}`,
  );
}

export const DATA_DIR = resolveDataDir();

function readCsv(rel: string): Row[] {
  const file = path.join(DATA_DIR, rel);
  return parse(fs.readFileSync(file, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as Row[];
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const splitPipe = (v: string | undefined): string[] =>
  (v ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

export interface Source {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  publicationDate: string;
  retrievalDate: string;
  licenceNotes: string;
  verificationStatus: string;
}

export interface Occupation {
  id: string;
  title: string;
  mascoCode: string;
  sector: string;
  careerLevel: string;
  description: string;
  minEducation: string;
  minExperienceYears: number;
  mycolStatus: string;
  sourceId: string;
}

export interface SkillRow {
  id: string;
  name: string;
  category: string;
  skillType: string;
  synonyms: string[];
  sourceId: string;
}

export interface OccSkill {
  occupationId: string;
  skillId: string;
  importance: "Required" | "Preferred";
  requiredProficiency: number;
}

export interface Sdg {
  goalNumber: number;
  goalTitle: string;
  targetCode: string;
  rationale: string;
}

export interface Forecast {
  occupationId: string;
  skillId: string;
  cutoffDate: string;
  targetDate: string;
  rolling3q: number;
  ridge: number;
  moderate: number;
  fast: number;
  lower90: number;
  upper90: number;
  aiExposure: number;
  aiAugmentation: number;
  assumptions: string;
}

export interface TrendObs {
  date: string;
  occupationId: string;
  value: number;
  sourceId: string;
  evidenceStatus: string;
}

export interface Resource {
  resourceId: string;
  title: string;
  provider: string;
  url: string;
  deliveryMode: string;
  estimatedHours: number;
  cost: number;
  currency: string;
  level: string;
  targetSkillIds: string[];
  sourceId: string;
  verificationStatus: string;
}

export interface PathwayStepRow {
  occupationId: string;
  order: number;
  resourceId: string;
  skillId: string;
  hours: number;
  sdgGoal: number;
  sdgTarget: string;
}

export interface CvRow {
  profileId: string;
  personaSegment: string;
  state: string;
  education: string;
  fieldOfStudy: string;
  yearsExperience: number;
  currentRoleId: string;
  interestSectors: string[];
  weeklyHours: number;
}

export interface ProfileSkillRow {
  profileId: string;
  skillId: string;
  term: string;
  proficiency: number;
  confidence: number;
}

/** Official UN SDG goal titles (sdgs.un.org/goals). */
export const SDG_TITLES: Record<number, string> = {
  1: "No Poverty",
  2: "Zero Hunger",
  3: "Good Health and Well-being",
  4: "Quality Education",
  5: "Gender Equality",
  6: "Clean Water and Sanitation",
  7: "Affordable and Clean Energy",
  8: "Decent Work and Economic Growth",
  9: "Industry, Innovation and Infrastructure",
  10: "Reduced Inequalities",
  11: "Sustainable Cities and Communities",
  12: "Responsible Consumption and Production",
  13: "Climate Action",
  14: "Life Below Water",
  15: "Life on Land",
  16: "Peace, Justice and Strong Institutions",
  17: "Partnerships for the Goals",
};

function load() {
  const sources: Source[] = readCsv("bronze/source_catalogue.csv").map((r) => ({
    id: r["source_id"]!,
    name: r["source_name"]!,
    url: r["source_url"]!,
    sourceType: r["source_type"]!,
    publicationDate: r["publication_date"]!,
    retrievalDate: r["retrieval_date"]!,
    licenceNotes: r["licence_or_usage_notes"]!,
    verificationStatus: r["verification_status"]!,
  }));

  const occupations: Occupation[] = readCsv("silver/occupations.csv").map((r) => ({
    id: r["occupation_id"]!,
    title: r["canonical_title"]!,
    mascoCode: r["masco_2020_code"]!,
    sector: r["industry_sector"]!,
    careerLevel: r["career_level"]!,
    description: r["role_description"]!,
    minEducation: r["min_education_level"]!,
    minExperienceYears: num(r["min_experience_years"]),
    mycolStatus: r["mycol_critical_status"]!,
    sourceId: r["source_id"]!,
  }));

  const skills: SkillRow[] = readCsv("silver/skills.csv").map((r) => ({
    id: r["skill_id"]!,
    // The taxonomy generator pads variant skills with a numeric index, e.g.
    // "Applied dbt Analytics Engineering (142)". Names stay unique without it.
    name: r["canonical_name"]!.replace(/\s*\(\d+\)$/, ""),
    category: r["skill_category"]!,
    skillType: r["skill_type"]!,
    synonyms: splitPipe(r["synonyms_pipe_delimited"]),
    sourceId: r["source_id"]!,
  }));

  const occSkills: OccSkill[] = readCsv("silver/occupation_skills.csv").map((r) => ({
    occupationId: r["occupation_id"]!,
    skillId: r["skill_id"]!,
    importance: r["importance_level"] === "Required" ? "Required" : "Preferred",
    requiredProficiency: num(r["required_proficiency"]) || 1,
  }));

  const toSdg = (r: Row): Sdg => {
    const goalNumber = num(r["sdg_goal_number"]);
    return {
      goalNumber,
      goalTitle: r["sdg_goal_title"] || SDG_TITLES[goalNumber] || `SDG ${goalNumber}`,
      targetCode: r["sdg_target_code"]!,
      rationale: r["evidence_rationale"]!,
    };
  };
  const occSdgs = new Map<string, Sdg[]>();
  for (const r of readCsv("gold/occupation_sdgs.csv")) {
    const list = occSdgs.get(r["occupation_id"]!) ?? [];
    list.push(toSdg(r));
    occSdgs.set(r["occupation_id"]!, list);
  }
  const skillSdgs = new Map<string, Sdg[]>();
  for (const r of readCsv("gold/skill_sdgs.csv")) {
    const list = skillSdgs.get(r["skill_id"]!) ?? [];
    list.push(toSdg(r));
    skillSdgs.set(r["skill_id"]!, list);
  }

  const forecasts = new Map<string, Forecast>();
  for (const r of readCsv("gold/forecast_features_scenarios.csv")) {
    forecasts.set(r["occupation_id"]!, {
      occupationId: r["occupation_id"]!,
      skillId: r["skill_id"]!,
      cutoffDate: r["feature_cutoff_date"]!,
      targetDate: r["forecast_target_date"]!,
      rolling3q: num(r["rolling_3q_avg"]),
      ridge: num(r["ridge_ar_pred"]),
      moderate: num(r["moderate_disruption_scenario_val"]),
      fast: num(r["fast_disruption_scenario_val"]),
      lower90: num(r["uncertainty_lower_90"]),
      upper90: num(r["uncertainty_upper_90"]),
      aiExposure: num(r["ai_exposure_index"]),
      aiAugmentation: num(r["ai_augmentation_potential"]),
      assumptions: r["scenario_assumptions"]!,
    });
  }

  const trendByOcc = new Map<string, TrendObs[]>();
  let trendCount = 0;
  for (const r of readCsv("gold/trend_observations.csv")) {
    trendCount++;
    const obs: TrendObs = {
      date: r["observation_date"]!,
      occupationId: r["occupation_id"]!,
      value: num(r["demand_measure"]),
      sourceId: r["source_id"]!,
      evidenceStatus: r["evidence_status"]!,
    };
    const list = trendByOcc.get(obs.occupationId) ?? [];
    list.push(obs);
    trendByOcc.set(obs.occupationId, list);
  }
  for (const list of trendByOcc.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const resources: Resource[] = readCsv("gold/learning_resources.csv").map((r) => ({
    resourceId: r["resource_id"]!,
    title: r["course_title"]!,
    provider: r["provider_name"]!,
    url: r["provider_url"]!,
    deliveryMode: r["delivery_mode"]!,
    estimatedHours: num(r["estimated_hours"]),
    cost: num(r["cost_amount"]),
    currency: r["currency"]!,
    level: r["prerequisite_level"]!,
    targetSkillIds: splitPipe(r["target_skill_ids"]),
    sourceId: r["source_id"]!,
    verificationStatus: r["verification_status"]!,
  }));

  const pathwaySteps: PathwayStepRow[] = readCsv("gold/pathway_steps.csv").map((r) => ({
    occupationId: r["occupation_id"]!,
    order: num(r["step_order"]),
    resourceId: r["resource_id"]!,
    skillId: r["expected_skill_outcome_id"]!,
    hours: num(r["estimated_completion_hours"]),
    sdgGoal: num(r["sdg_goal_number"]),
    sdgTarget: r["sdg_target_code"]!,
  }));

  const cvs: CvRow[] = readCsv("silver/synthetic_cvs.csv").map((r) => ({
    profileId: r["profile_id"]!,
    personaSegment: r["persona_segment"]!,
    state: r["state_malaysia"]!,
    education: r["highest_education"]!,
    fieldOfStudy: r["field_of_study"]!,
    yearsExperience: num(r["years_experience"]),
    currentRoleId: r["current_or_last_role_id"]!,
    interestSectors: [...new Set(splitPipe(r["target_interest_sectors"]))],
    weeklyHours: num(r["max_weekly_learning_hours"]),
  }));

  const profileSkills = new Map<string, ProfileSkillRow[]>();
  for (const r of readCsv("gold/profile_skills.csv")) {
    const row: ProfileSkillRow = {
      profileId: r["profile_id"]!,
      skillId: r["skill_id"]!,
      term: r["extracted_surface_term"]!,
      proficiency: num(r["estimated_proficiency"]),
      confidence: num(r["extraction_confidence"]),
    };
    const list = profileSkills.get(row.profileId) ?? [];
    list.push(row);
    profileSkills.set(row.profileId, list);
  }

  const report = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "gold/evaluation_metrics_report.json"), "utf-8"),
  ) as Record<string, Record<string, unknown>>;

  return {
    sources,
    sourceById: new Map(sources.map((s) => [s.id, s])),
    occupations,
    occupationById: new Map(occupations.map((o) => [o.id, o])),
    skills,
    skillById: new Map(skills.map((s) => [s.id, s])),
    occSkills,
    occSkillsByOcc: groupBy(occSkills, (s) => s.occupationId),
    occSdgs,
    skillSdgs,
    forecasts,
    trendByOcc,
    trendCount,
    resources,
    resourceById: new Map(resources.map((r) => [r.resourceId, r])),
    pathwaySteps,
    pathwayStepsByOcc: groupBy(pathwaySteps, (s) => s.occupationId),
    cvs,
    profileSkills,
    report,
  };
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = map.get(k) ?? [];
    list.push(it);
    map.set(k, list);
  }
  return map;
}

export const data = load();

logger.info(
  {
    dataDir: DATA_DIR,
    occupations: data.occupations.length,
    skills: data.skills.length,
    trendObservations: data.trendCount,
  },
  "Pipeline data loaded",
);
