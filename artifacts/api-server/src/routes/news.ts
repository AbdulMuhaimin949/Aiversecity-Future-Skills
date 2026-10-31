import { Router, type IRouter } from "express";
import { newsDataService } from "../lib/newsdata.js";

const router: IRouter = Router();

router.get("/news", async (req, res) => {
  try {
    const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
    const region =
      req.query.region === "Malaysia" || req.query.region === "Global" || req.query.region === "all"
        ? req.query.region
        : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 18;

    const data = await newsDataService.getArticles({ topic, region, limit });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to retrieve industry news" });
  }
});

router.get("/news/status", (_req, res) => {
  res.json(newsDataService.getSyncMetadata());
});

router.post("/news/refresh", async (req, res) => {
  try {
    const queryIndex = typeof req.body?.queryIndex === "number" ? req.body.queryIndex : 0;
    const pageToken = typeof req.body?.pageToken === "string" ? req.body.pageToken : undefined;
    const data = await newsDataService.forceRefresh({ queryIndex, pageToken });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to refresh news feed" });
  }
});

export default router;
