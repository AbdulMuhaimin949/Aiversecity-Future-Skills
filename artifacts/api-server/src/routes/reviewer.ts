/**
 * Reviewer side of the CV review demo. Requires a Clerk sign-in AND the
 * `reviewer` or `admin` role. AI output is shown for context only; every status change
 * here is a human decision with a written rationale.
 */
import { Router, type IRouter, type Response } from "express";
import {
  DecideClaimBody,
  DecideClaimResponse,
  GetReviewerCvResponse,
  GetReviewerMeResponse,
  GetReviewQueueQueryParams,
  GetReviewQueueResponse,
  ResolveAppealBody,
  ResolveAppealResponse,
} from "@workspace/api-zod";
import { ConflictError, NotFoundError, decideClaim, resolveAppeal } from "../lib/cvReview/actions";
import { currentUser, requireReviewer } from "../lib/cvReview/auth";
import { reviewQueue, reviewerClaim, reviewerCvDetail } from "../lib/cvReview/views";

const router: IRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendKnownError(res: Response, err: unknown): boolean {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  return false;
}

router.get("/reviewer/me", async (req, res) => {
  const user = await currentUser(req);
  res.json(
    GetReviewerMeResponse.parse({
      signedIn: Boolean(user),
      isReviewer: user?.isReviewer ?? false,
      isAdmin: user?.isAdmin ?? false,
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
    }),
  );
});

router.get("/reviewer/queue", async (req, res) => {
  if (!(await requireReviewer(req, res))) return;
  const q = GetReviewQueueQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  res.json(
    GetReviewQueueResponse.parse(
      await reviewQueue({ filter: q.data.filter ?? "pending", search: q.data.search, page: q.data.page ?? 1 }),
    ),
  );
});

router.get("/reviewer/cvs/:cvId", async (req, res) => {
  if (!(await requireReviewer(req, res))) return;
  const cvId = req.params["cvId"]!;
  const detail = UUID.test(cvId) ? await reviewerCvDetail(cvId) : null;
  if (!detail) {
    res.status(404).json({ error: "CV not found" });
    return;
  }
  res.json(GetReviewerCvResponse.parse(detail));
});

router.post("/reviewer/claims/:claimId/decisions", async (req, res) => {
  const reviewer = await requireReviewer(req, res);
  if (!reviewer) return;
  const body = DecideClaimBody.safeParse(req.body);
  const rationale = body.success ? body.data.rationale.trim() : "";
  if (!body.success || rationale.length < 10) {
    res.status(400).json({ error: "Choose a decision and write a rationale of 10–2000 characters." });
    return;
  }
  const claimId = req.params["claimId"]!;
  if (!UUID.test(claimId)) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  try {
    await decideClaim(reviewer.id, claimId, body.data.decision, rationale);
  } catch (err) {
    if (sendKnownError(res, err)) return;
    throw err;
  }
  res.json(DecideClaimResponse.parse(await reviewerClaim(claimId)));
});

router.post("/reviewer/appeals/:appealId/resolve", async (req, res) => {
  const reviewer = await requireReviewer(req, res);
  if (!reviewer) return;
  const body = ResolveAppealBody.safeParse(req.body);
  const rationale = body.success ? body.data.rationale.trim() : "";
  if (!body.success || rationale.length < 10) {
    res.status(400).json({ error: "Choose upheld or rejected and write a rationale of 10–2000 characters." });
    return;
  }
  if (body.data.outcome === "upheld" && !body.data.newDecision) {
    res.status(400).json({ error: "Choose the new decision when upholding an appeal." });
    return;
  }
  const appealId = req.params["appealId"]!;
  if (!UUID.test(appealId)) {
    res.status(404).json({ error: "Appeal not found" });
    return;
  }
  let claimId: string;
  try {
    claimId = await resolveAppeal(reviewer.id, appealId, body.data.outcome, rationale, body.data.newDecision);
  } catch (err) {
    if (sendKnownError(res, err)) return;
    throw err;
  }
  res.json(ResolveAppealResponse.parse(await reviewerClaim(claimId)));
});

export default router;
