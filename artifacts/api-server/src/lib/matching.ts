import { data, type Occupation, type OccSkill, type Sdg } from "./data";
import { resilienceFor, roleTrends, SCENARIO_META, type Direction, type Scenario, type SkillResilienceCalc } from "./scenarios";

/**
 * Transparent career match score (see pipeline/ARCHITECTURE_AND_DATA_DICTIONARY.md §2.1):
 *   Score = 100 * (0.45*O + 0.25*A + 0.15*E + 0.15*M)
 */
export const WEIGHTS = {
  skillOverlap: 0.45,
  proficiencyAlignment: 0.25,
  readiness: 0.15,
  interestAndTrend: 0.15,
};

export const FORMULA =
  "Score = 100 x (0.45 x O + 0.25 x A + 0.15 x E + 0.15 x M), where O = 0.75 x share of required skills held + 0.25 x share of preferred skills held; A = average of min(1, your proficiency / required proficiency) over the role's skills; E = 0.3 x (education meets minimum) + 0.2 x min(1, (your years + 1) / (required years + 1)) + 0.5 x seniority fit (years of professional work vs the role's career level: under 1 year fits Entry roles, 3+ years fits Mid roles and up); M = 0.4 x (sector in your interests) + 0.3 x learning feasibility (weekly hours x 26 weeks vs. hours needed to close gaps) + 0.3 x scenario demand (min-max normalised projected change).";

/**
 * Seniority fit: how well the years of professional work match the role's
 * career level. Fresh starters fit Entry roles; 3+ years fits Mid roles and up.
 */
export function seniorityFit(years: number, careerLevel: string): number {
  const band = (cuts: number[], values: number[]) => values[cuts.filter((c) => years >= c).length]!;
  switch (careerLevel) {
    case "Entry":
      return band([1, 3], [1, 0.85, 0.6]);
    case "Mid":
      return band([1, 3, 8], [0.3, 0.7, 1, 0.85]);
    case "Senior":
      return band([1, 3, 5, 8], [0.1, 0.2, 0.55, 0.9, 1]);
    case "Lead":
      return band([3, 5, 8], [0.05, 0.3, 0.6, 1]);
    default:
      return 0.5;
  }
}

const EDU_RANK: Record<string, number> = {
  SPM: 0,
  "Diploma/DKM": 1,
  Diploma: 1,
  Bachelor: 2,
  "Master/PhD": 3,
  Master: 3,
  PhD: 3,
};

export interface ProfileSkill {
  skillId: string;
  proficiency: number;
}

export interface MatchProfile {
  skills: ProfileSkill[];
  educationLevel: string;
  yearsExperience: number;
  interestSectors: string[];
  weeklyLearningHours: number;
  scenario: Scenario;
}

const DEFAULT_HOURS_PER_SKILL = 20;

/** Hours to learn a skill = cheapest per-skill share of a catalogue resource covering it. */
const hoursPerSkill = (() => {
  const map = new Map<string, number>();
  for (const r of data.resources) {
    const per = r.estimatedHours / Math.max(r.targetSkillIds.length, 1);
    for (const s of r.targetSkillIds) {
      const cur = map.get(s);
      if (cur === undefined || per < cur) map.set(s, per);
    }
  }
  return map;
})();

export function skillHours(skillId: string): number {
  return hoursPerSkill.get(skillId) ?? DEFAULT_HOURS_PER_SKILL;
}

export function profileMap(skills: ProfileSkill[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of skills) m.set(s.skillId, Math.max(m.get(s.skillId) ?? 0, s.proficiency));
  return m;
}

export interface GapSkill {
  skillId: string;
  name: string;
  category: string;
  importance: "Required" | "Preferred";
  requiredProficiency: number;
  currentProficiency: number;
}

export type GapSkillWithResilience = GapSkill & SkillResilienceCalc;

export function gapsFor(occSkills: OccSkill[], have: Map<string, number>): GapSkill[] {
  return occSkills
    .filter((os) => (have.get(os.skillId) ?? 0) < os.requiredProficiency)
    .map((os) => {
      const s = data.skillById.get(os.skillId);
      return {
        skillId: os.skillId,
        name: s?.name ?? os.skillId,
        category: s?.category ?? "",
        importance: os.importance,
        requiredProficiency: os.requiredProficiency,
        currentProficiency: have.get(os.skillId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (a.importance === "Required" ? 0 : 1) - (b.importance === "Required" ? 0 : 1) ||
        b.requiredProficiency - b.currentProficiency - (a.requiredProficiency - a.currentProficiency),
    );
}

export function components(occ: Occupation, profile: MatchProfile, demandNorm: number) {
  const occSkills = data.occSkillsByOcc.get(occ.id) ?? [];
  const have = profileMap(profile.skills);
  const req = occSkills.filter((s) => s.importance === "Required");
  const pref = occSkills.filter((s) => s.importance === "Preferred");
  const reqHeld = req.filter((s) => have.has(s.skillId)).length;
  const prefHeld = pref.filter((s) => have.has(s.skillId)).length;

  const O = 0.75 * (reqHeld / Math.max(req.length, 1)) + 0.25 * (prefHeld / Math.max(pref.length, 1));
  const A =
    occSkills.length === 0
      ? 0
      : occSkills.reduce(
          (acc, s) => acc + Math.min(1, (have.get(s.skillId) ?? 0) / s.requiredProficiency),
          0,
        ) / occSkills.length;
  const eduOk = (EDU_RANK[profile.educationLevel] ?? 0) >= (EDU_RANK[occ.minEducation] ?? 0) ? 1 : 0;
  const E =
    0.3 * eduOk +
    0.2 * Math.min(1, (profile.yearsExperience + 1) / (occ.minExperienceYears + 1)) +
    0.5 * seniorityFit(profile.yearsExperience, occ.careerLevel);

  const gaps = gapsFor(occSkills, have);
  const gapHours = gaps.reduce((acc, g) => acc + skillHours(g.skillId), 0);
  const feasibility = gapHours === 0 ? 1 : Math.min(1, (profile.weeklyLearningHours * 26) / gapHours);
  const interest = profile.interestSectors.includes(occ.sector) ? 1 : 0;
  const M = 0.4 * interest + 0.3 * feasibility + 0.3 * demandNorm;

  const score =
    100 *
    (WEIGHTS.skillOverlap * O +
      WEIGHTS.proficiencyAlignment * A +
      WEIGHTS.readiness * E +
      WEIGHTS.interestAndTrend * M);

  return { O, A, E, M, score, gaps, reqHeld, prefHeld, req, pref, interest, gapHours };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface RoleMatchCalc {
  rank: number;
  occupationId: string;
  title: string;
  sector: string;
  careerLevel: string;
  score: number;
  breakdown: {
    skillOverlap: number;
    proficiencyAlignment: number;
    readiness: number;
    interestAndTrend: number;
    weights: typeof WEIGHTS;
  };
  metSkills: ({
    skillId: string;
    name: string;
    category: string;
    importance: OccSkill["importance"];
    currentProficiency: number;
    requiredProficiency: number;
  } & SkillResilienceCalc)[];
  gapSkills: GapSkillWithResilience[];
  demandChangePct: number;
  direction: Direction;
  mycolStatus: string;
  sdgs: Sdg[];
  explanation: string;
  sourceIds: string[];
}

export function matchRoles(profile: MatchProfile, limit: number): RoleMatchCalc[] {
  const trends = roleTrends(profile.scenario);
  const trendByOcc = new Map(trends.map((t) => [t.occupationId, t]));
  const changes = trends.map((t) => t.changePct);
  const min = Math.min(...changes);
  const max = Math.max(...changes);
  const have = profileMap(profile.skills);
  const scenarioLabel = SCENARIO_META[profile.scenario].friendlyName;

  const scored = data.occupations
    .filter((o) => trendByOcc.has(o.id))
    .map((occ) => {
      const t = trendByOcc.get(occ.id)!;
      const demandNorm = max === min ? 0.5 : (t.changePct - min) / (max - min);
      const c = components(occ, profile, demandNorm);
      return { occ, t, c };
    })
    // Roles in the sectors the user toggled come first (score order within each
    // group); without toggled sectors the ranking is purely by score.
    .sort((a, b) => b.c.interest - a.c.interest || b.c.score - a.c.score)
    .slice(0, limit);

  return scored.map(({ occ, t, c }, i) => {
    const occSkills = data.occSkillsByOcc.get(occ.id) ?? [];
    const metSkills = occSkills
      .filter((s) => have.has(s.skillId))
      .map((s) => {
        const sk = data.skillById.get(s.skillId);
        return {
          skillId: s.skillId,
          name: sk?.name ?? s.skillId,
          category: sk?.category ?? "",
          importance: s.importance,
          currentProficiency: have.get(s.skillId) ?? 0,
          requiredProficiency: s.requiredProficiency,
          ...resilienceFor(profile.scenario, s.skillId),
        };
      });
    const topGaps = c.gaps.slice(0, 3).map((g) => g.name).join("; ");
    const sign = t.changePct >= 0 ? "+" : "";
    const explanation = [
      `Skills: ${c.reqHeld}/${c.req.length} required and ${c.prefHeld}/${c.pref.length} preferred on your profile.`,
      `Demand: ${sign}${t.changePct.toFixed(1)}% projected under ${scenarioLabel}; ${c.interest ? "this sector matches your interests." : "this sector is not in your selected interests."}`,
      c.gaps.length
        ? `Next steps: ${c.gaps.length} skill gap${c.gaps.length === 1 ? "" : "s"} · about ${Math.round(c.gapHours)} learning hours${topGaps ? ` · Start with ${topGaps}.` : "."}`
        : "Next steps: 0 skill gaps · about 0 learning hours · all listed skill requirements are met.",
    ].join("\n");
    return {
      rank: i + 1,
      occupationId: occ.id,
      title: occ.title,
      sector: occ.sector,
      careerLevel: occ.careerLevel,
      score: Math.round(c.score * 10) / 10,
      breakdown: {
        skillOverlap: r3(c.O),
        proficiencyAlignment: r3(c.A),
        readiness: r3(c.E),
        interestAndTrend: r3(c.M),
        weights: WEIGHTS,
      },
      metSkills,
      gapSkills: c.gaps.map((g) => ({ ...g, ...resilienceFor(profile.scenario, g.skillId) })),
      demandChangePct: t.changePct,
      direction: t.direction,
      mycolStatus: occ.mycolStatus,
      sdgs: data.occSdgs.get(occ.id) ?? [],
      explanation,
      sourceIds: t.sourceIds,
    };
  });
}
