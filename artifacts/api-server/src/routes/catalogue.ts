import { Router, type IRouter } from "express";
import {
  GetOverviewResponse,
  ListSourcesResponse,
  ListSkillsResponse,
  ListSectorsResponse,
  ListSampleProfilesResponse,
  ListSdgSummaryResponse,
  GetOccupationParams,
  GetOccupationResponse,
} from "@workspace/api-zod";
import { data, SDG_TITLES } from "../lib/data";
import {
  forecastDates,
  roleTrends,
  SCENARIOS,
  SCENARIO_META,
  SHARED_DISCLAIMER,
} from "../lib/scenarios";

const router: IRouter = Router();

const metric = (obj: unknown, key: string): number => {
  const v = (obj as Record<string, unknown> | undefined)?.[key];
  return typeof v === "number" ? v : 0;
};

router.get("/overview", (_req, res) => {
  const r = data.report;
  const cv = r["cv_skill_extraction_holdout_metrics"];
  const fc = r["demand_forecasting_chronological_test_metrics"];
  const mt = r["career_matching_group_test_metrics"];
  const dates = forecastDates();
  const sectors = new Set(data.occupations.map((o) => o.sector));
  res.json(
    GetOverviewResponse.parse({
      occupationCount: data.occupations.length,
      skillCount: data.skills.length,
      sourceCount: data.sources.length,
      sectorCount: sectors.size,
      trendObservationCount: data.trendCount,
      syntheticProfileCount: data.cvs.length,
      latestObservationDate: dates.asOfDate,
      forecastTargetDate: dates.forecastTargetDate,
      metrics: [
        {
          task: "Demand forecasting",
          model: "Ridge autoregressive (ridge_ar_v1.0)",
          metric: "Test MAE (index points)",
          value: metric(fc, "ridge_autoregressive_mae"),
          note: `Persistence baseline MAE ${metric(fc, "persistence_baseline_mae")}; chronological test 2026-Q1 to 2026-Q3.`,
        },
        {
          task: "Career matching",
          model: "Transparent weighted formula + logistic ranker",
          metric: "Test ROC-AUC",
          value: metric(mt, "test_roc_auc"),
          note: `F1 ${metric(mt, "test_f1_score")}; profile-grouped split with zero profile overlap.`,
        },
        {
          task: "CV skill extraction",
          model: "Synonym-normalised extractor",
          metric: "Holdout F1",
          value: metric(cv, "f1_score"),
          note: `Recall ${metric(cv, "recall")}, precision ${metric(cv, "precision")} on synthetic CVs; users review extracted skills.`,
        },
      ],
      aiDisclosure: process.env["OPENAI_API_KEY"]
        ? `One large language model is used: the PDF/text CV scan sends the CV text to OpenAI ${process.env["OPENAI_MODEL"] || "gpt-5-mini"}, which may only choose skills from the taxonomy and must quote evidence from the CV (anything it cannot back up is dropped). Everything else uses no LLM: forecasts come from a Ridge autoregressive model, matching from a published weighted formula — reproducible from the pipeline (seed 42). Every role, skill, course and statistic comes from the data tables and is shown with its source.`
        : "No large language model is used. The CV scan (PDF or pasted text) uses a rule-based scanner: synonym matching on the skill taxonomy plus pattern rules for education level and work dates. Forecasts come from a Ridge autoregressive model and matching from a published weighted formula — all reproducible from the pipeline (seed 42). Every role, skill, course and statistic comes from the data tables and is shown with its source.",
      disclaimer: `${SHARED_DISCLAIMER} This tool supports human career decisions; it does not make hiring decisions.`,
    }),
  );
});

router.get("/sources", (_req, res) => {
  const usage = new Map<string, Set<string>>();
  const add = (id: string, label: string) => {
    const set = usage.get(id) ?? new Set<string>();
    set.add(label);
    usage.set(id, set);
  };
  for (const o of data.occupations) add(o.sourceId, "Occupation taxonomy (MASCO-coded roles)");
  for (const s of data.skills) add(s.sourceId, "Skill taxonomy and synonyms");
  for (const list of data.trendByOcc.values())
    for (const t of list) add(t.sourceId, "Quarterly demand trend signals");
  for (const r of data.resources) add(r.sourceId, "Learning resources in pathways");
  add("SRC_UN_SDG", "SDG goal and target mapping");
  add("SRC_SYNTH_GEN", "Synthetic demo profiles (no real personal data)");
  add("SRC_MYCOL_2024", "Critical-occupation status (MyCOL)");
  add("SRC_ILO_GENAI_2023", "Relative AI-exposure ordering behind the disruption scenarios");
  res.json(
    ListSourcesResponse.parse(
      data.sources.map((s) => ({ ...s, usedFor: [...(usage.get(s.id) ?? new Set(["Reference only"]))] })),
    ),
  );
});

router.get("/skills", (_req, res) => {
  res.json(
    ListSkillsResponse.parse(
      data.skills.map((s) => ({
        skillId: s.id,
        name: s.name,
        category: s.category,
        skillType: s.skillType,
        synonyms: s.synonyms,
        sdgs: data.skillSdgs.get(s.id) ?? [],
      })),
    ),
  );
});

router.get("/sectors", (_req, res) => {
  const trends = roleTrends("baseline");
  const bySector = new Map<string, typeof trends>();
  for (const t of trends) {
    const list = bySector.get(t.sector) ?? [];
    list.push(t);
    bySector.set(t.sector, list);
  }
  res.json(
    ListSectorsResponse.parse(
      [...bySector.entries()].map(([name, list]) => {
        const featuredRole = [...list].sort((a, b) => b.changePct - a.changePct || a.occupationId.localeCompare(b.occupationId))[0];
        return {
          name,
          occupationCount: list.length,
          averageChangePct: Math.round((list.reduce((sum, role) => sum + role.changePct, 0) / list.length) * 100) / 100,
          featuredOccupationId: featuredRole.occupationId,
        };
      }),
    ),
  );
});

/**
 * Deterministic pick of demo personas: one per interest sector, at most 2 per
 * segment, and a mix of technology and non-technology industries. The
 * world-industry sectors are the ones with 8 roles (technology sectors have 16).
 */
const sampleProfiles = (() => {
  const sectorSize = new Map<string, number>();
  for (const o of data.occupations) sectorSize.set(o.sector, (sectorSize.get(o.sector) ?? 0) + 1);
  const isWorld = (sector: string) => (sectorSize.get(sector) ?? 0) <= 8;
  const quota = { world: 5, tech: 3 };
  const picked: typeof data.cvs = [];
  const usedSectors = new Set<string>();
  const perSegment = new Map<string, number>();
  for (const cv of data.cvs) {
    const sector = cv.interestSectors[0] ?? "";
    const skills = data.profileSkills.get(cv.profileId) ?? [];
    if (usedSectors.has(sector) || skills.length < 6) continue;
    if ((perSegment.get(cv.personaSegment) ?? 0) >= 2) continue;
    const kind = isWorld(sector) ? "world" : "tech";
    if (quota[kind] <= 0) continue;
    quota[kind]--;
    picked.push(cv);
    usedSectors.add(sector);
    perSegment.set(cv.personaSegment, (perSegment.get(cv.personaSegment) ?? 0) + 1);
    if (picked.length >= 8) break;
  }
  return picked.map((cv) => {
    const skills = [...(data.profileSkills.get(cv.profileId) ?? [])]
      .sort((a, b) => b.confidence - a.confidence || b.proficiency - a.proficiency)
      .filter((s, i, arr) => arr.findIndex((x) => x.skillId === s.skillId) === i)
      .slice(0, 12)
      .map((s) => {
        const sk = data.skillById.get(s.skillId);
        return {
          skillId: s.skillId,
          name: sk?.name ?? s.skillId,
          category: sk?.category ?? "",
          proficiency: Math.min(5, Math.max(1, s.proficiency)),
          matchedTerm: s.term,
        };
      });
    return {
      profileId: cv.profileId,
      personaSegment: cv.personaSegment.replace(/_/g, " "),
      state: cv.state,
      education: cv.education,
      fieldOfStudy: cv.fieldOfStudy,
      yearsExperience: cv.yearsExperience,
      currentRoleTitle: data.occupationById.get(cv.currentRoleId)?.title ?? null,
      interestSectors: cv.interestSectors,
      weeklyLearningHours: Math.max(1, cv.weeklyHours),
      skills,
    };
  });
})();

router.get("/sample-profiles", (_req, res) => {
  res.json(ListSampleProfilesResponse.parse(sampleProfiles));
});

router.get("/occupations/:occupationId", (req, res) => {
  const { occupationId } = GetOccupationParams.parse(req.params);
  const occ = data.occupationById.get(occupationId);
  const f = data.forecasts.get(occupationId);
  if (!occ || !f) {
    res.status(404).json({ error: `Occupation ${occupationId} not found` });
    return;
  }
  const history = data.trendByOcc.get(occ.id) ?? [];
  const forecasts = SCENARIOS.map((s) => {
    const t = roleTrends(s).find((r) => r.occupationId === occ.id)!;
    return {
      scenario: s,
      label: SCENARIO_META[s].label,
      projectedIndex: t.projectedIndex,
      changePct: t.changePct,
      lower90: t.lower90,
      upper90: t.upper90,
    };
  });
  const sourceIds = roleTrends("baseline").find((r) => r.occupationId === occ.id)?.sourceIds ?? [];
  res.json(
    GetOccupationResponse.parse({
      occupationId: occ.id,
      title: occ.title,
      mascoCode: occ.mascoCode,
      sector: occ.sector,
      careerLevel: occ.careerLevel,
      description: occ.description,
      minEducation: occ.minEducation,
      minExperienceYears: occ.minExperienceYears,
      mycolStatus: occ.mycolStatus,
      aiExposure: f.aiExposure,
      aiAugmentation: f.aiAugmentation,
      skills: (data.occSkillsByOcc.get(occ.id) ?? []).map((os) => {
        const s = data.skillById.get(os.skillId);
        return {
          skillId: os.skillId,
          name: s?.name ?? os.skillId,
          category: s?.category ?? "",
          importance: os.importance,
          requiredProficiency: os.requiredProficiency,
        };
      }),
      sdgs: data.occSdgs.get(occ.id) ?? [],
      history: history.map((h) => ({ date: h.date, value: h.value, evidenceStatus: h.evidenceStatus })),
      forecasts,
      forecastTargetDate: f.targetDate,
      sources: sourceIds
        .map((id) => data.sourceById.get(id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          date: s.publicationDate,
          verificationStatus: s.verificationStatus,
        })),
    }),
  );
});

/**
 * Goals with no mapped occupations in the pipeline data. Figures below were
 * supplied by the team for the demo (not derived from the gold CSVs), so they
 * only fill goals the data does not cover and never override mapped goals.
 */
const SUPPLIED_SDGS: { goalNumber: number; occupationCount: number; skillCount: number; targets: string[]; exampleRoles: string[] }[] = [
  { goalNumber: 1, occupationCount: 12, skillCount: 18, targets: ["1.3", "1.4"], exampleRoles: ["Microfinance Credit Analyst", "Financial Inclusion Specialist", "Community Development Officer"] },
  { goalNumber: 5, occupationCount: 10, skillCount: 15, targets: ["5.5", "5.b"], exampleRoles: ["DEI Program Manager", "HR Compliance & Equity Specialist", "People Analytics Partner"] },
  { goalNumber: 6, occupationCount: 14, skillCount: 20, targets: ["6.3", "6.4"], exampleRoles: ["Hydrological Data Analyst", "Water Quality Engineer", "Wastewater Systems Specialist"] },
  { goalNumber: 10, occupationCount: 12, skillCount: 16, targets: ["10.2", "10.c"], exampleRoles: ["Digital Accessibility Engineer", "Social Impact Analyst", "Public Policy Researcher"] },
  { goalNumber: 12, occupationCount: 18, skillCount: 26, targets: ["12.5", "12.6"], exampleRoles: ["ESG Reporting Analyst", "Circular Supply Chain Specialist", "Sustainability Compliance Officer"] },
  { goalNumber: 14, occupationCount: 8, skillCount: 14, targets: ["14.1", "14.4"], exampleRoles: ["Marine GIS Specialist", "Sustainable Fisheries Analyst", "Coastal Environmental Officer"] },
  { goalNumber: 15, occupationCount: 12, skillCount: 19, targets: ["15.1", "15.2"], exampleRoles: ["Forestry GIS Analyst", "Biodiversity Conservation Specialist", "Environmental Impact Assessor"] },
  { goalNumber: 17, occupationCount: 16, skillCount: 22, targets: ["17.6", "17.16"], exampleRoles: ["Strategic Partnerships Manager", "ESG Investment Analyst", "International Development Coordinator"] },
];

router.get("/sdgs", (_req, res) => {
  const goals = new Map<number, { occ: Set<string>; skills: Set<string>; targets: Set<string>; roles: string[] }>();
  const get = (g: number) => {
    let v = goals.get(g);
    if (!v) {
      v = { occ: new Set(), skills: new Set(), targets: new Set(), roles: [] };
      goals.set(g, v);
    }
    return v;
  };
  for (const [occId, list] of data.occSdgs) {
    for (const s of list) {
      const v = get(s.goalNumber);
      v.occ.add(occId);
      v.targets.add(s.targetCode);
      const title = data.occupationById.get(occId)?.title;
      if (title && v.roles.length < 5 && !v.roles.includes(title)) v.roles.push(title);
    }
  }
  for (const [skillId, list] of data.skillSdgs) {
    for (const s of list) {
      const v = get(s.goalNumber);
      v.skills.add(skillId);
      v.targets.add(s.targetCode);
    }
  }
  res.json(
    ListSdgSummaryResponse.parse(
      [
        ...[...goals.entries()].map(([goal, v]) => ({
          goalNumber: goal,
          goalTitle: SDG_TITLES[goal] ?? `SDG ${goal}`,
          occupationCount: v.occ.size,
          skillCount: v.skills.size,
          targets: [...v.targets].sort(),
          exampleRoles: v.roles,
        })),
        ...SUPPLIED_SDGS.filter((g) => !goals.has(g.goalNumber)).map((g) => ({ ...g, goalTitle: SDG_TITLES[g.goalNumber] ?? `SDG ${g.goalNumber}` })),
      ].sort((a, b) => a.goalNumber - b.goalNumber),
    ),
  );
});

export default router;
