/**
 * Applicant side of the CV review demo (fictional CVs only). Reads are open;
 * extraction and appeals need the guest token, which identifies the applicant
 * without sign-in.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ExtractDemoCvClaimsResponse,
  GetCvReviewStatusResponse,
  GetDemoCvResponse,
  ListDemoCvsQueryParams,
  ListDemoCvsResponse,
  SubmitClaimAppealBody,
  SubmitClaimAppealResponse,
} from "@workspace/api-zod";
import { getChatModelName } from "@workspace/rag";
import { findGuestUserId, findOrCreateGuestUserId, guestSubject } from "../lib/assistant/guest";
import { takeAppealSlot, takeCvExtractionSlot, takeGuestCreationSlot } from "../lib/assistant/rateLimit";
import { ConflictError, NotFoundError, submitAppeal } from "../lib/cvReview/actions";
import { ExtractionFailedError, ExtractionUnavailableError, extractClaims, extractionAvailable } from "../lib/cvReview/extract";
import { applicantCvDetail, cvReviewStats, listDemoCvs } from "../lib/cvReview/views";

const router: IRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_TOKEN = { error: "A guest token (Authorization: Bearer <token>) is required." };

async function optionalGuest(req: Request): Promise<string | null> {
  const subject = guestSubject(req);
  return subject ? findGuestUserId(subject) : null;
}

/** The caller's guest user, created on first write. Sends 401/429 and returns null on failure. */
async function guestForWrite(req: Request, res: Response): Promise<string | null> {
  const subject = guestSubject(req);
  if (!subject) {
    res.status(401).json(NO_TOKEN);
    return null;
  }
  const existing = await findGuestUserId(subject);
  if (existing) return existing;
  const wait = takeGuestCreationSlot(req.ip ?? "unknown");
  if (wait) {
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({ error: `Too many new visitors from this network. Try again in ${Math.ceil(wait / 60)} minute(s).` });
    return null;
  }
  return findOrCreateGuestUserId(subject, "en");
}

function tooMany(res: Response, wait: number, what: string) {
  res.setHeader("Retry-After", String(wait));
  res.status(429).json({ error: `Too many ${what}. Try again in ${Math.ceil(wait / 60)} minute(s).` });
}

router.get("/cv-review/status", async (_req, res) => {
  const stats = await cvReviewStats();
  res.json(
    GetCvReviewStatusResponse.parse({
      aiExtractionAvailable: extractionAvailable(),
      extractionModel: getChatModelName(),
      ...stats,
    }),
  );
});

router.get("/cv-review/demo-cvs", async (req, res) => {
  const q = ListDemoCvsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  // z.coerce.boolean() treats "false" as true, so read the flag literally.
  const reviewCasesOnly = req.query["reviewCasesOnly"] === "true";
  res.json(ListDemoCvsResponse.parse(await listDemoCvs({ search: q.data.search, reviewCasesOnly, page: q.data.page ?? 1 })));
});

router.get("/cv-review/demo-cvs/:cvId", async (req, res) => {
  const cvId = req.params["cvId"]!;
  const detail = UUID.test(cvId) ? await applicantCvDetail(cvId, await optionalGuest(req)) : null;
  if (!detail) {
    res.status(404).json({ error: "Demo CV not found" });
    return;
  }
  res.json(GetDemoCvResponse.parse(detail));
});

router.post("/cv-review/demo-cvs/:cvId/extract", async (req, res) => {
  const cvId = req.params["cvId"]!;
  const existing = UUID.test(cvId) ? await applicantCvDetail(cvId, null) : null;
  if (!existing) {
    res.status(404).json({ error: "Demo CV not found" });
    return;
  }
  if (!extractionAvailable()) {
    res.status(503).json({ error: "AI extraction is not configured (no Gemini API key)." });
    return;
  }
  const userId = await guestForWrite(req, res);
  if (!userId) return;
  if (!existing.cv.aiExtracted) {
    const wait = takeCvExtractionSlot(userId);
    if (wait) return tooMany(res, wait, "AI extractions");
    try {
      await extractClaims(cvId, existing.cv.cvText, userId);
    } catch (err) {
      if (err instanceof ExtractionUnavailableError) {
        res.status(503).json({ error: err.message });
        return;
      }
      if (err instanceof ExtractionFailedError) {
        req.log.warn({ err: err.message, cvId }, "CV claim extraction failed");
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
  res.json(ExtractDemoCvClaimsResponse.parse(await applicantCvDetail(cvId, userId)));
});

router.post("/cv-review/claims/:claimId/appeals", async (req, res) => {
  const claimId = req.params["claimId"]!;
  const body = SubmitClaimAppealBody.safeParse(req.body);
  const reason = body.success ? body.data.reason.trim() : "";
  if (!body.success || reason.length < 10) {
    res.status(400).json({ error: "Explain your appeal in 10–2000 characters; language must be ms, zh-CN or en." });
    return;
  }
  if (!UUID.test(claimId)) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  const userId = await guestForWrite(req, res);
  if (!userId) return;
  const wait = takeAppealSlot(userId);
  if (wait) return tooMany(res, wait, "appeals");
  try {
    const appeal = await submitAppeal(userId, claimId, reason, body.data.language ?? "en");
    res.status(201).json(
      SubmitClaimAppealResponse.parse({
        id: appeal.id,
        claimId,
        reason: appeal.reason,
        language: appeal.language,
        status: appeal.status,
        resolution: appeal.resolution,
        submittedAt: appeal.submittedAt,
        resolvedAt: appeal.resolvedAt,
      }),
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
