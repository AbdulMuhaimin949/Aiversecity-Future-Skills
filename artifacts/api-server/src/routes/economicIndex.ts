import { Router, type IRouter } from "express";
import { anthropicEconomicIndexService } from "../lib/anthropicEconIndex";

const router: IRouter = Router();

router.get("/economic-index", (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const occupationTitle = typeof req.query.occupationTitle === "string" ? req.query.occupationTitle : undefined;

    const data = anthropicEconomicIndexService.getIndicators({ category, occupationTitle });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve Anthropic Economic Index data" });
  }
});

export default router;

