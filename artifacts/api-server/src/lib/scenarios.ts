import { data, type Sdg } from "./data";

export type Scenario = "baseline" | "moderate" | "fast";
export type Direction = "RISING" | "STEADY" | "SLOWING";

export const SCENARIOS: Scenario[] = ["baseline", "moderate", "fast"];

/**
 * Scenario model. Projections come straight from the pipeline's forecast
 * table (Ridge AR baseline + conditional moderate/fast augmentation
 * multipliers). On top of that we apply an explicit displacement adjustment
 * so that faster disruption hurts roles whose AI exposure is high but whose
 * augmentation potential is low:
 *
 *   projected = V_s * (1 - lambda_s * exposure * (1 - augmentation))
 *
 * and the 90% band is widened by a scenario factor because faster change
 * means less certainty.
 */
const fcMetrics = (data.report["demand_forecasting_chronological_test_metrics"] ?? {}) as Record<string, unknown>;
const mae = (k: string) => (typeof fcMetrics[k] === "number" ? (fcMetrics[k] as number).toFixed(2) : "n/a");

export const SCENARIO_META: Record<
  Scenario,
  { label: string; friendlyName: string; lambda: number; bandWidening: number; assumptions: string }
> = {
  baseline: {
    label: "Low Impact",
    friendlyName: "Low Impact",
    lambda: 0,
    bandWidening: 1,
    assumptions:
      `Ridge autoregressive forecast (ridge_ar_v1.0) trained chronologically on 2021-Q4 to 2024-Q4 quarterly demand indices, 4 quarters ahead. No extra AI shock is applied. Test MAE ${mae("ridge_autoregressive_mae")} index points vs ${mae("persistence_baseline_mae")} for the naive persistence baseline.`,
  },
  moderate: {
    label: "Moderate Impact",
    friendlyName: "Moderate Impact",
    lambda: 0.15,
    bandWidening: 1.25,
    assumptions:
      "Pipeline moderate scenario (+6% x net AI augmentation synergy on the Ridge forecast), then a displacement adjustment of 0.15 x AI exposure x (1 - augmentation potential). 90% band widened by 25%. Exposure levels for non-technology sectors follow the relative ordering in ILO Working Paper 96 (2023); the numbers are assumptions.",
  },
  fast: {
    label: "High Impact",
    friendlyName: "High Impact",
    lambda: 0.4,
    bandWidening: 1.6,
    assumptions:
      "Pipeline fast scenario (+14% x net AI augmentation synergy, incl. green-digital transition), then a stronger displacement adjustment of 0.40 x AI exposure x (1 - augmentation potential). 90% band widened by 60%.",
  },
};

export const SHARED_DISCLAIMER =
  "All projections are estimates from simulated, MyCOL-anchored quarterly demand indices (normalised vacancy index, base 100). They are conditional scenarios, not predictions of any individual's future, and should be read together with the 90% uncertainty range.";

export interface RoleTrendCalc {
  occupationId: string;
  title: string;
  sector: string;
  careerLevel: string;
  currentIndex: number;
  projectedIndex: number;
  lower90: number;
  upper90: number;
  changePct: number;
  direction: Direction;
  aiExposure: number;
  aiAugmentation: number;
  mycolStatus: string;
  primarySdg: Sdg;
  evidenceStatus: string;
  sourceIds: string[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function directionsByTertile<T extends { changePct: number }>(items: T[]): Map<T, Direction> {
  const sorted = [...items].sort((a, b) => b.changePct - a.changePct);
  const n = sorted.length;
  const map = new Map<T, Direction>();
  sorted.forEach((it, i) => {
    map.set(it, i < n / 3 ? "RISING" : i < (2 * n) / 3 ? "STEADY" : "SLOWING");
  });
  return map;
}

const cache = new Map<Scenario, RoleTrendCalc[]>();

export function roleTrends(scenario: Scenario): RoleTrendCalc[] {
  const hit = cache.get(scenario);
  if (hit) return hit;
  const meta = SCENARIO_META[scenario];
  const rows: Omit<RoleTrendCalc, "direction">[] = [];

  for (const occ of data.occupations) {
    const f = data.forecasts.get(occ.id);
    if (!f) continue;
    const history = data.trendByOcc.get(occ.id) ?? [];
    const last = history[history.length - 1];
    const current = last ? last.value : f.rolling3q;
    const raw = scenario === "baseline" ? f.ridge : scenario === "moderate" ? f.moderate : f.fast;
    const displacement = f.aiExposure * (1 - f.aiAugmentation);
    const projected = raw * (1 - meta.lambda * displacement);
    const ratio = projected / f.ridge;
    const halfWidth = ((f.upper90 - f.lower90) / 2) * ratio * meta.bandWidening;
    const centre = ((f.upper90 + f.lower90) / 2) * ratio;
    const sdgs = data.occSdgs.get(occ.id) ?? [];
    const sourceIds = [
      ...new Set([
        occ.sourceId,
        ...history.map((h) => h.sourceId),
        "SRC_ESCO_V121",
        "SRC_UN_SDG",
        "SRC_ILO_GENAI_2023",
      ]),
    ];
    rows.push({
      occupationId: occ.id,
      title: occ.title,
      sector: occ.sector,
      careerLevel: occ.careerLevel,
      currentIndex: round(current),
      projectedIndex: round(projected),
      lower90: round(centre - halfWidth),
      upper90: round(centre + halfWidth),
      changePct: round((projected / current - 1) * 100),
      aiExposure: f.aiExposure,
      aiAugmentation: f.aiAugmentation,
      mycolStatus: occ.mycolStatus,
      primarySdg: sdgs[0] ?? {
        goalNumber: 8,
        goalTitle: "Decent Work and Economic Growth",
        targetCode: "8.5",
        rationale: "Default employment link.",
      },
      evidenceStatus: last?.evidenceStatus ?? "SYNTHETIC_SIMULATION",
      sourceIds,
    });
  }

  const dirs = directionsByTertile(rows);
  const result: RoleTrendCalc[] = rows.map((r) => ({ ...r, direction: dirs.get(r)! }));
  cache.set(scenario, result);
  return result;
}

export type AiResilience = "RESILIENT" | "EXPOSED";

export interface SkillResilienceCalc {
  aiResilience: AiResilience;
  resilienceScore: number;
  avgExposure: number;
  avgAugmentation: number;
}

export interface SkillTrendCalc extends SkillResilienceCalc {
  skillId: string;
  name: string;
  category: string;
  changePct: number;
  direction: Direction;
  roleCount: number;
}

const resilienceCache = new Map<Scenario, Map<string, SkillResilienceCalc>>();

/**
 * Per-skill AI resilience, derived only from the exposure and augmentation
 * values of the roles that require the skill (Required weight 1, Preferred 0.5,
 * as in skillTrends). With displacement = exposure x (1 - augmentation):
 *
 *   resilienceScore = mean(augmentation) - (lambda_s / lambda_moderate) x mean(displacement)
 *
 * so the scenario's own displacement weight (lambda) sets how strongly exposure
 * is penalised: not at all in baseline (augmentation potential only), once in
 * moderate and about 2.7 times in fast. Skills are then split at the median of the whole
 * taxonomy: the upper half is "RESILIENT", the lower half "EXPOSED". The
 * cut-off is therefore relative, not an absolute threshold. This describes the
 * roles a skill appears in, not any specific task.
 */
export function skillResilience(scenario: Scenario): Map<string, SkillResilienceCalc> {
  const hit = resilienceCache.get(scenario);
  if (hit) return hit;
  const lambda = SCENARIO_META[scenario].lambda;
  const acc = new Map<string, { exp: number; aug: number; disp: number; n: number }>();
  for (const os of data.occSkills) {
    const f = data.forecasts.get(os.occupationId);
    if (!f) continue;
    const w = os.importance === "Required" ? 1 : 0.5;
    const a = acc.get(os.skillId) ?? { exp: 0, aug: 0, disp: 0, n: 0 };
    a.exp += f.aiExposure * w;
    a.aug += f.aiAugmentation * w;
    a.disp += f.aiExposure * (1 - f.aiAugmentation) * w;
    a.n += w;
    acc.set(os.skillId, a);
  }
  const rows = [...acc.entries()]
    .filter(([, a]) => a.n > 0)
    .map(([skillId, a]) => ({
      skillId,
      avgExposure: a.exp / a.n,
      avgAugmentation: a.aug / a.n,
      score: a.aug / a.n - (lambda / SCENARIO_META.moderate.lambda) * (a.disp / a.n),
    }));
  const ranked = [...rows].sort((x, y) => y.score - x.score || x.skillId.localeCompare(y.skillId));
  const out = new Map<string, SkillResilienceCalc>();
  ranked.forEach((r, i) => {
    out.set(r.skillId, {
      aiResilience: i < ranked.length / 2 ? "RESILIENT" : "EXPOSED",
      resilienceScore: round(r.score, 3),
      avgExposure: round(r.avgExposure, 3),
      avgAugmentation: round(r.avgAugmentation, 3),
    });
  });
  resilienceCache.set(scenario, out);
  return out;
}

const NO_RESILIENCE: SkillResilienceCalc = { aiResilience: "EXPOSED", resilienceScore: 0, avgExposure: 0, avgAugmentation: 0 };
export const resilienceFor = (scenario: Scenario, skillId: string): SkillResilienceCalc =>
  skillResilience(scenario).get(skillId) ?? NO_RESILIENCE;

/** Skill demand = average projected change of the roles that require it. */
export function skillTrends(scenario: Scenario): SkillTrendCalc[] {
  const byOcc = new Map(roleTrends(scenario).map((r) => [r.occupationId, r]));
  const acc = new Map<string, { sum: number; n: number; required: number }>();
  for (const os of data.occSkills) {
    const t = byOcc.get(os.occupationId);
    if (!t) continue;
    const a = acc.get(os.skillId) ?? { sum: 0, n: 0, required: 0 };
    const w = os.importance === "Required" ? 1 : 0.5;
    a.sum += t.changePct * w;
    a.n += w;
    if (os.importance === "Required") a.required++;
    acc.set(os.skillId, a);
  }
  const res = skillResilience(scenario);
  const rows: Omit<SkillTrendCalc, "direction">[] = [];
  for (const [skillId, a] of acc) {
    const s = data.skillById.get(skillId);
    if (!s || a.n === 0) continue;
    rows.push({
      skillId,
      name: s.name,
      category: s.category,
      changePct: round(a.sum / a.n),
      roleCount: a.required,
      ...(res.get(skillId) ?? NO_RESILIENCE),
    });
  }
  const dirs = directionsByTertile(rows);
  return rows
    .map((r) => ({ ...r, direction: dirs.get(r)! }))
    .sort((a, b) => b.changePct - a.changePct);
}

export function forecastDates() {
  const f = data.forecasts.values().next().value;
  return { asOfDate: f?.cutoffDate ?? "", forecastTargetDate: f?.targetDate ?? "" };
}

export function isScenario(v: unknown): v is Scenario {
  return v === "baseline" || v === "moderate" || v === "fast";
}
