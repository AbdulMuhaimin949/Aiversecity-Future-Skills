import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogueRouter from "./catalogue";
import insightsRouter from "./insights";
import assistantRouter from "./assistant";
import cvReviewRouter from "./cvReview";
import reviewerRouter from "./reviewer";
import knowledgeAdminRouter from "./knowledgeAdmin";
import syntheticRouter from "./synthetic";
import guideRouter from "./guide";
import newsRouter from "./news";
import economicIndexRouter from "./economicIndex";

const router: IRouter = Router();

router.use(guideRouter);
router.use(newsRouter);
router.use(economicIndexRouter);
router.use(healthRouter);
router.use(catalogueRouter);
router.use(insightsRouter);
router.use(assistantRouter);
router.use(cvReviewRouter);
router.use(reviewerRouter);
router.use(knowledgeAdminRouter);
router.use(syntheticRouter);

export default router;
