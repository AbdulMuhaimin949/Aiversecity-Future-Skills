import { data, SDG_TITLES, type Resource, type Sdg } from "./data";
import { gapsFor, profileMap, type ProfileSkill } from "./matching";

const LEVEL_RANK: Record<string, number> = { Foundation: 0, Intermediate: 1, Advanced: 2 };

export const PATHWAY_DISCLAIMER =
  "This plan is a starting point to discuss with a career adviser, not a decision. Hours are catalogue estimates. Resources marked SYNTHETIC_CURRICULUM_PLACEHOLDER are reference modules, not real courses. Skills with no matching resource are listed as uncovered rather than invented.";

const catalogueNote = () =>
  ` The current catalogue holds ${data.resources.length} curated resources, so many gaps will need a course found with your adviser or on e-LATiH directly.`;

function skillRef(id: string) {
  const s = data.skillById.get(id);
  return { skillId: id, name: s?.name ?? id, category: s?.category ?? "" };
}

function sdgFor(goal: number, target: string, fallback: Sdg): Sdg {
  if (!goal) return fallback;
  const fromOcc = [...data.occSdgs.values()].flat().find((s) => s.goalNumber === goal && s.targetCode === target);
  return (
    fromOcc ?? {
      goalNumber: goal,
      goalTitle: SDG_TITLES[goal] ?? `SDG ${goal}`,
      targetCode: target,
      rationale: `Supports UN SDG ${goal} target ${target}.`,
    }
  );
}

export function buildPathway(occupationId: string, skills: ProfileSkill[], weeklyHours: number) {
  const occ = data.occupationById.get(occupationId);
  if (!occ) return null;
  const occSkills = data.occSkillsByOcc.get(occ.id) ?? [];
  const have = profileMap(skills);
  const gaps = gapsFor(occSkills, have);
  const gapIds = new Set(gaps.map((g) => g.skillId));
  const requiredProf = new Map(occSkills.map((s) => [s.skillId, s.requiredProficiency]));
  const occSdgs = data.occSdgs.get(occ.id) ?? [];
  const primarySdg: Sdg = occSdgs[0] ?? {
    goalNumber: 8,
    goalTitle: SDG_TITLES[8]!,
    targetCode: "8.5",
    rationale: "Decent work and productive employment.",
  };
  const holds = (skillId: string) => (have.get(skillId) ?? 0) >= (requiredProf.get(skillId) ?? 3);

  type Draft = { resource: Resource; targetIds: string[]; hours: number; sdg: Sdg; curated: boolean; order: number };
  const drafts: Draft[] = [];
  const used = new Set<string>();

  // 1) Curated pathway steps from the Gold pathway table. Only keep a step when
  //    the resource's own catalogue targets actually include the expected
  //    outcome skill for this role — otherwise the link is not evidenced.
  const curated = [...(data.pathwayStepsByOcc.get(occ.id) ?? [])].sort((a, b) => a.order - b.order);
  for (const st of curated) {
    const res = data.resourceById.get(st.resourceId);
    if (!res || used.has(res.resourceId)) continue;
    if (!res.targetSkillIds.includes(st.skillId) || !requiredProf.has(st.skillId)) continue;
    used.add(res.resourceId);
    const targetIds = [...new Set([st.skillId, ...res.targetSkillIds.filter((id) => gapIds.has(id))])];
    drafts.push({
      resource: res,
      targetIds,
      hours: st.hours || res.estimatedHours,
      sdg: sdgFor(st.sdgGoal, st.sdgTarget, primarySdg),
      curated: true,
      order: st.order,
    });
  }

  // 2) Extra catalogue resources for gaps the curated steps do not cover.
  const covered = () => new Set(drafts.flatMap((d) => d.targetIds));
  for (const g of gaps) {
    if (covered().has(g.skillId)) continue;
    const candidates = data.resources
      .filter((r) => !used.has(r.resourceId) && r.targetSkillIds.includes(g.skillId))
      .sort(
        (a, b) =>
          a.cost - b.cost ||
          (LEVEL_RANK[a.level] ?? 1) - (LEVEL_RANK[b.level] ?? 1) ||
          a.estimatedHours - b.estimatedHours,
      );
    const res = candidates[0];
    if (!res) continue;
    used.add(res.resourceId);
    const targetIds = res.targetSkillIds.filter((id) => gapIds.has(id));
    const skillSdg = data.skillSdgs.get(g.skillId)?.[0];
    drafts.push({
      resource: res,
      targetIds: targetIds.length ? targetIds : [g.skillId],
      hours: res.estimatedHours,
      sdg: skillSdg ?? primarySdg,
      curated: false,
      order: 100 + (LEVEL_RANK[res.level] ?? 1),
    });
  }

  drafts.sort(
    (a, b) =>
      (LEVEL_RANK[a.resource.level] ?? 1) - (LEVEL_RANK[b.resource.level] ?? 1) || a.order - b.order,
  );

  const hoursPerWeek = Math.max(weeklyHours, 1);
  let elapsedHours = 0;
  let totalHours = 0;
  const steps = drafts.map((d, i) => {
    const alreadyCovered = d.targetIds.every(holds);
    const startWeek = Math.floor(elapsedHours / hoursPerWeek) + 1;
    if (!alreadyCovered) {
      elapsedHours += d.hours;
      totalHours += d.hours;
    }
    const endWeek = alreadyCovered ? startWeek : Math.max(startWeek, Math.ceil(elapsedHours / hoursPerWeek));
    return {
      order: i + 1,
      resource: {
        resourceId: d.resource.resourceId,
        title: d.resource.title,
        provider: d.resource.provider,
        url: d.resource.url,
        deliveryMode: d.resource.deliveryMode,
        estimatedHours: d.resource.estimatedHours,
        cost: d.resource.cost,
        currency: d.resource.currency,
        level: d.resource.level,
        sourceId: d.resource.sourceId,
        verificationStatus: d.resource.verificationStatus,
      },
      targetSkills: d.targetIds.map(skillRef),
      hours: d.hours,
      alreadyCovered,
      sdg: d.sdg,
      startWeek,
      endWeek,
    };
  });

  const coveredIds = covered();
  const uncoveredGaps = gaps.filter((g) => !coveredIds.has(g.skillId)).map((g) => skillRef(g.skillId));

  const sdgSeen = new Set<string>();
  const sdgContribution: Sdg[] = [];
  for (const s of [...occSdgs, ...steps.map((s) => s.sdg), ...gaps.flatMap((g) => data.skillSdgs.get(g.skillId) ?? [])]) {
    const key = `${s.goalNumber}-${s.targetCode}`;
    if (sdgSeen.has(key)) continue;
    sdgSeen.add(key);
    sdgContribution.push(s);
  }

  const readiness =
    occSkills.length === 0
      ? 0
      : (100 *
          occSkills.reduce(
            (acc, s) => acc + Math.min(1, (have.get(s.skillId) ?? 0) / s.requiredProficiency),
            0,
          )) /
        occSkills.length;

  return {
    occupationId: occ.id,
    title: occ.title,
    sector: occ.sector,
    currentScore: Math.round(readiness * 10) / 10,
    totalHours: Math.round(totalHours * 10) / 10,
    estimatedWeeks: Math.ceil(totalHours / hoursPerWeek),
    weeklyLearningHours: weeklyHours,
    steps,
    uncoveredGaps,
    sdgContribution,
    disclaimer: PATHWAY_DISCLAIMER + catalogueNote(),
  };
}
