import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateChatSessionBody,
  CreateChatSessionResponse,
  DeleteChatSessionParams,
  GetAssistantStatusResponse,
  GetChatSessionParams,
  GetChatSessionResponse,
  ListChatSessionsResponse,
  SendChatMessageBody,
  SendChatMessageParams,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { DeepSeekError, DeepSeekInputLimitError, GeminiError } from "@workspace/rag";
import { findGuestUserId, findOrCreateGuestUserId, guestSubject } from "../lib/assistant/guest";
import {
  answerQuestion,
  AssistantUnavailableError,
  assistantStatus,
  countActiveSessions,
  createSession,
  findEmptySession,
  reuseSession,
  deleteSession,
  getOwnedSession,
  listSessions,
  sessionDetail,
} from "../lib/assistant/chat";
import { MAX_SESSIONS_PER_GUEST, takeQuestionSlot, takeSessionSlot } from "../lib/assistant/rateLimit";

const router: IRouter = Router();

const UNAUTHORISED = { error: "A guest token (Authorization: Bearer <token>) is required." };

/** Resolves the caller's guest user id, or sends 401/404 and returns null. */
async function requireGuest(req: Request, res: Response): Promise<string | null> {
  const subject = guestSubject(req);
  if (!subject) {
    res.status(401).json(UNAUTHORISED);
    return null;
  }
  const userId = await findGuestUserId(subject);
  if (!userId) {
    res.status(404).json({ error: "Chat session not found" });
    return null;
  }
  return userId;
}

router.get("/assistant/status", async (_req, res) => {
  res.json(GetAssistantStatusResponse.parse(await assistantStatus()));
});

router.get("/assistant/sessions", async (req, res) => {
  const subject = guestSubject(req);
  if (!subject) {
    res.status(401).json(UNAUTHORISED);
    return;
  }
  const userId = await findGuestUserId(subject);
  res.json(ListChatSessionsResponse.parse(userId ? await listSessions(userId) : []));
});

router.post("/assistant/sessions", async (req, res) => {
  const subject = guestSubject(req);
  if (!subject) {
    res.status(401).json(UNAUTHORISED);
    return;
  }
  const body = CreateChatSessionBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "language must be ms, zh-CN or en" });
    return;
  }
  const language = body.data.language ?? "ms";

  // An untouched session is reused instead of creating another row.
  const existingUserId = await findGuestUserId(subject);
  if (existingUserId) {
    const empty = await findEmptySession(existingUserId);
    if (empty) {
      res.status(201).json(CreateChatSessionResponse.parse(await reuseSession(empty, language)));
      return;
    }
    if ((await countActiveSessions(existingUserId)) >= MAX_SESSIONS_PER_GUEST) {
      res.status(429).json({ error: `You have ${MAX_SESSIONS_PER_GUEST} conversations. Delete one before starting another.` });
      return;
    }
  }
  const wait = takeSessionSlot(req.ip ?? "unknown");
  if (wait) {
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({ error: `Too many new conversations. Try again in ${Math.ceil(wait / 60)} minute(s).` });
    return;
  }
  const userId = existingUserId ?? (await findOrCreateGuestUserId(subject, language));
  res.status(201).json(CreateChatSessionResponse.parse(await createSession(userId, language)));
});

router.get("/assistant/sessions/:sessionId", async (req, res) => {
  const params = GetChatSessionParams.parse(req.params);
  const userId = await requireGuest(req, res);
  if (!userId) return;
  const session = await getOwnedSession(userId, params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }
  res.json(GetChatSessionResponse.parse(await sessionDetail(session)));
});

router.delete("/assistant/sessions/:sessionId", async (req, res) => {
  const params = DeleteChatSessionParams.parse(req.params);
  const userId = await requireGuest(req, res);
  if (!userId) return;
  const session = await getOwnedSession(userId, params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }
  await deleteSession(session.id);
  res.status(204).end();
});

router.post("/assistant/sessions/:sessionId/messages", async (req, res) => {
  const params = SendChatMessageParams.parse(req.params);
  const body = SendChatMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "content must be 1–2000 characters; language must be ms, zh-CN or en" });
    return;
  }
  const question = body.data.content.trim();
  if (!question) {
    res.status(400).json({ error: "content must not be blank" });
    return;
  }
  const userId = await requireGuest(req, res);
  if (!userId) return;
  const session = await getOwnedSession(userId, params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Chat session not found" });
    return;
  }
  const status = await assistantStatus();
  if (!status.chatReady) {
    res.status(503).json({ error: "No approved knowledge is searchable yet, so the assistant cannot answer. An admin must approve the knowledge documents first." });
    return;
  }
  const wait = takeQuestionSlot(userId);
  if (wait) {
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({ error: `Too many questions. Try again in ${Math.ceil(wait / 60)} minute(s).` });
    return;
  }
  const language = body.data.language ?? (session.language as "ms" | "zh-CN" | "en");
  try {
    const exchange = await answerQuestion(session, question, language);
    res.json(SendChatMessageResponse.parse(exchange));
  } catch (err) {
    if (err instanceof AssistantUnavailableError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof DeepSeekInputLimitError) {
      res.status(413).json({ error: err.message });
      return;
    }
    if (err instanceof DeepSeekError) {
      const status = err.status === 402 ? 402 : err.status === 429 ? 503 : err.status === 401 || err.status === 403 ? 503 : 502;
      const error =
        err.status === 402
          ? "DeepSeek reports insufficient account balance. Nothing was saved; check the account balance before retrying."
          : err.status === 401 || err.status === 403
            ? "DeepSeek rejected its API key. Nothing was saved; check the server secret."
            : err.status === 429
              ? "DeepSeek is rate-limiting requests. Nothing was saved; please try again later."
              : "DeepSeek did not answer. Nothing was saved; please try again.";
      req.log.error({ status: err.status }, "DeepSeek call failed");
      res.status(status).json({ error });
      return;
    }
    if (err instanceof GeminiError) {
      req.log.error({ status: err.status }, "Gemini embedding call failed");
      res.status(502).json({ error: "Approved knowledge could not be searched. Nothing was saved; please try again." });
      return;
    }
    throw err;
  }
});

export default router;
