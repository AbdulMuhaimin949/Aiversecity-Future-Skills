/**
 * Fictional demo data from the synthetic add-on: practice labs and a
 * quarterly demand-index scenario per role. Kept on separate endpoints so it is
 * never mixed into real forecasts or the e-LATiH course catalogue.
 */
import { Router, type IRouter } from "express";
import {
  GetSyntheticTrendScenarioParams,
  GetSyntheticTrendScenarioResponse,
  ListSyntheticLearningResourcesQueryParams,
  ListSyntheticLearningResourcesResponse,
} from "@workspace/api-zod";
import { syntheticLabsForSkills, syntheticTrendScenario } from "../lib/synthetic/views";

const router: IRouter = Router();

const ID = /^[A-Z]{3}_\d{1,6}$/;
const MAX_SKILLS = 100;

router.get("/synthetic/occupations/:occupationId/trend-scenario", async (req, res) => {
  const p = GetSyntheticTrendScenarioParams.safeParse(req.params);
  const scenario = p.success && ID.test(p.data.occupationId) ? await syntheticTrendScenario(p.data.occupationId) : null;
  if (!scenario) {
    res.status(404).json({ error: "Occupation not found" });
    return;
  }
  res.json(GetSyntheticTrendScenarioResponse.parse(scenario));
});

router.get("/synthetic/learning-resources", async (req, res) => {
  const q = ListSyntheticLearningResourcesQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "skillIds is required (comma-separated skill ids)" });
    return;
  }
  const ids = [...new Set(q.data.skillIds.split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length > MAX_SKILLS || ids.some((id) => !ID.test(id))) {
    res.status(400).json({ error: `skillIds must be up to ${MAX_SKILLS} ids like SKL_0001` });
    return;
  }
  res.json(ListSyntheticLearningResourcesResponse.parse(await syntheticLabsForSkills(ids)));
});

export default router;
