import { Router, type IRouter } from "express";
import {
  GetRadarQueryParams,
  GetRadarResponse,
  CompareScenariosResponse,
  ExtractSkillsBody,
  ExtractSkillsResponse,
  MatchRolesBody,
  MatchRolesResponse,
  BuildPathwayBody,
  BuildPathwayResponse,
  ScanCvBody,
  ScanCvResponse,
} from "@workspace/api-zod";
import { data } from "../lib/data";
import {
  forecastDates,
  roleTrends,
  skillTrends,
  SCENARIOS,
  SCENARIO_META,
  SHARED_DISCLAIMER,
} from "../lib/scenarios";
import { FORMULA, matchRoles } from "../lib/matching";
import { buildPathway } from "../lib/pathway";
import { extractSkills, EXTRACTION_METHOD, EXTRACTION_NOTE } from "../lib/extractor";
import { CvScanError, pdfToText, scanCv } from "../lib/cvScanner";

const router: IRouter = Router();

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);

router.get("/radar", (req, res) => {
  const parsed = GetRadarQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "scenario must be baseline, moderate or fast" });
    return;
  }
  const scenario = parsed.data.scenario ?? "baseline";
  const roles = [...roleTrends(scenario)].sort((a, b) => b.changePct - a.changePct);
  const trendSourceIds = new Set<string>(["SRC_MASCO_2020"]);
  for (const r of roles) for (const id of r.sourceIds) trendSourceIds.add(id);
  const sources = [...trendSourceIds]
    .map((id) => data.sourceById.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      date: s.publicationDate,
      verificationStatus: s.verificationStatus,
    }));
  res.json(
    GetRadarResponse.parse({
      scenario,
      scenarioLabel: SCENARIO_META[scenario].label,
      ...forecastDates(),
      assumptions: `${SCENARIO_META[scenario].assumptions} ${SHARED_DISCLAIMER}`,
      roles,
      skills: skillTrends(scenario),
      sources,
    }),
  );
});

router.get("/scenarios/compare", (_req, res) => {
  const sectors = [...new Set(data.occupations.map((o) => o.sector))];
  const bySector = (s: (typeof SCENARIOS)[number], sector: string) =>
    avg(roleTrends(s).filter((r) => r.sector === sector).map((r) => r.changePct));
  res.json(
    CompareScenariosResponse.parse({
      scenarios: SCENARIOS.map((s) => ({
        scenario: s,
        label: SCENARIO_META[s].label,
        assumptions: SCENARIO_META[s].assumptions,
        averageChangePct: avg(roleTrends(s).map((r) => r.changePct)),
      })),
      sectors: sectors.map((sector) => ({
        sector,
        baselineChangePct: bySector("baseline", sector),
        moderateChangePct: bySector("moderate", sector),
        fastChangePct: bySector("fast", sector),
      })),
    }),
  );
});

router.post("/profile/extract", (req, res) => {
  const parsed = ExtractSkillsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide CV text (1-20000 characters)." });
    return;
  }
  res.json(
    ExtractSkillsResponse.parse({
      skills: extractSkills(parsed.data.text),
      method: EXTRACTION_METHOD,
      note: EXTRACTION_NOTE,
    }),
  );
});

router.post("/profile/scan-cv", async (req, res) => {
  const parsed = ScanCvBody.safeParse(req.body);
  if (!parsed.success || (!parsed.data.fileBase64 && !parsed.data.text)) {
    res.status(400).json({ error: "Upload a PDF CV (max 5 MB) or paste CV text." });
    return;
  }
  const { fileBase64, fileName, text } = parsed.data;
  try {
    let cvText = text ?? "";
    let pageCount: number | null = null;
    if (fileBase64) {
      const pdf = await pdfToText(Buffer.from(fileBase64, "base64"));
      cvText = pdf.text;
      pageCount = pdf.pageCount;
    }
    const result = await scanCv({ text: cvText, fileName: fileBase64 ? (fileName ?? "cv.pdf") : null, pageCount }, req.log);
    res.json(ScanCvResponse.parse(result));
  } catch (err) {
    if (err instanceof CvScanError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "CV scan failed");
    res.status(500).json({ error: "The CV could not be scanned. Please try again or paste the text instead." });
  }
});

router.post("/matches", (req, res) => {
  const parsed = MatchRolesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    return;
  }
  const p = parsed.data;
  res.json(
    MatchRolesResponse.parse({
      scenario: p.scenario,
      formula: FORMULA,
      matches: matchRoles(
        {
          skills: p.skills,
          educationLevel: p.educationLevel,
          yearsExperience: p.yearsExperience,
          interestSectors: p.interestSectors,
          weeklyLearningHours: p.weeklyLearningHours,
          scenario: p.scenario,
        },
        p.limit ?? 10,
      ),
      disclaimer:
        "Match scores rank roles against your stated skills using a published formula. They are a starting point for your own decision and a conversation with a career adviser — not a hiring decision or a guarantee.",
    }),
  );
});

router.post("/pathway", (req, res) => {
  const parsed = BuildPathwayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    return;
  }
  const p = parsed.data;
  const pathway = buildPathway(p.occupationId, p.skills, p.weeklyLearningHours);
  if (!pathway) {
    res.status(404).json({ error: `Occupation ${p.occupationId} not found` });
    return;
  }
  res.json(BuildPathwayResponse.parse(pathway));
});

export default router;
