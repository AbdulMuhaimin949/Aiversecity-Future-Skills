/**
 * Knowledge-base admin: add documents (stored as pending), approve / reject
 * them with notes, and generate embeddings for approved documents so the AI
 * Mentor can retrieve them. Requires a Clerk sign-in AND the `admin` role.
 */
import { Router, type IRouter, type Response } from "express";
import {
  CreateKnowledgeDocumentBody,
  CreateKnowledgeDocumentResponse,
  DecideKnowledgeDocumentBody,
  DecideKnowledgeDocumentResponse,
  DecideKnowledgeSourceBody,
  DecideKnowledgeSourceResponse,
  ApproveSyntheticKnowledgeDocumentsBody,
  ApproveSyntheticKnowledgeDocumentsResponse,
  EmbedKnowledgeDocumentResponse,
  EmbedKnowledgeSourceResponse,
  GetKnowledgeDocumentResponse,
  GetKnowledgeOverviewResponse,
  ListKnowledgeDocumentsQueryParams,
  ListKnowledgeDocumentsResponse,
  TryKnowledgeDocumentQuestionBody,
  TryKnowledgeDocumentQuestionResponse,
} from "@workspace/api-zod";
import {
  approvePendingSyntheticRagDocuments,
  decideDocuments,
  decideSource,
  embedQuery,
  ensureEmbeddingModel,
  getGeminiApiKey,
  normaliseText,
  retrieveChunks,
  SyntheticBulkApprovalConflictError,
  type EmbedResult,
} from "@workspace/rag";
import { requireAdmin } from "../lib/cvReview/auth";
import { ConflictError, NotFoundError, createDocument, runEmbedding } from "../lib/knowledgeAdmin/actions";
import { documentDetail, knowledgeOverview, knowledgeSource, listDocuments } from "../lib/knowledgeAdmin/views";

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

/** 502 when Gemini embedded nothing at all; partial results are returned as 200 with errors. */
function sendEmbedResult(res: Response, result: EmbedResult, parse: (r: EmbedResult) => unknown) {
  if (result.embedded === 0 && result.errors.length > 0) {
    const reason = result.errors[0]!.replace(/^embedding batch \d+ \(\d+ chunks\): /, "");
    res.status(502).json({ error: `No chunk was embedded. ${reason}` });
    return;
  }
  res.json(parse(result));
}

router.get("/admin/knowledge", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  res.json(GetKnowledgeOverviewResponse.parse(await knowledgeOverview()));
});

router.get("/admin/knowledge/documents", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const q = ListKnowledgeDocumentsQueryParams.safeParse(req.query);
  if (!q.success || (q.data.sourceId && !UUID.test(q.data.sourceId))) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  res.json(
    ListKnowledgeDocumentsResponse.parse(
      await listDocuments({
        status: q.data.status ?? "all",
        sourceId: q.data.sourceId || undefined,
        search: q.data.search?.trim() || undefined,
        page: q.data.page ?? 1,
      }),
    ),
  );
});

router.post("/admin/knowledge/documents", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = CreateKnowledgeDocumentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Give a title (3–200 characters), a language and the document text (50–100,000 characters)." });
    return;
  }
  const title = body.data.title.trim().replace(/\s+/g, " ");
  const text = normaliseText(body.data.text);
  const url = body.data.url?.trim() || null;
  const sourceId = body.data.sourceId?.trim() || null;
  if (title.length < 3 || text.length < 50) {
    res.status(400).json({ error: "The title needs at least 3 characters and the text at least 50." });
    return;
  }
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    res.status(400).json({ error: "The link must start with http:// or https://." });
    return;
  }
  if (sourceId && !UUID.test(sourceId)) {
    res.status(404).json({ error: "Knowledge source not found." });
    return;
  }
  let id: string;
  try {
    id = await createDocument(admin.id, sourceId, {
      title,
      url,
      language: body.data.language,
      mimeType: "text/markdown",
      dataOrigin: body.data.dataOrigin,
      publishedAt: null,
      text,
    });
  } catch (err) {
    if (sendKnownError(res, err)) return;
    throw err;
  }
  res.status(201).json(CreateKnowledgeDocumentResponse.parse(await documentDetail(id)));
});

router.get("/admin/knowledge/documents/:documentId", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const id = req.params["documentId"]!;
  const detail = UUID.test(id) ? await documentDetail(id) : null;
  if (!detail) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(GetKnowledgeDocumentResponse.parse(detail));
});

/**
 * Admin retrieval probe: embeds the question and performs vector search only.
 * It deliberately does not call Gemini text generation, so no reply-generation
 * credits are used. The shared retrieval function only returns approved chunks.
 */
router.post("/admin/knowledge/documents/:documentId/try-question", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const id = req.params["documentId"]!;
  if (!UUID.test(id)) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const detail = await documentDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const body = TryKnowledgeDocumentQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a question between 3 and 1000 characters." });
    return;
  }
  const question = body.data.question.trim();
  if (question.length < 3 || question.length > 1000) {
    res.status(400).json({ error: "Enter a question between 3 and 1000 characters." });
    return;
  }
  if (!getGeminiApiKey()) {
    res.status(503).json({ error: "GEMINI_API_KEY is not configured, so retrieval cannot embed the question." });
    return;
  }
  try {
    const modelId = await ensureEmbeddingModel();
    const vector = await embedQuery(question);
    const chunks = await retrieveChunks(vector, { modelId, topK: 6 });
    res.json(TryKnowledgeDocumentQuestionResponse.parse({
      documentRetrievable: detail.retrievable,
      results: chunks.map((chunk) => ({
        ...chunk,
        isCurrentDocument: chunk.documentId === id,
      })),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retrieval failed.";
    res.status(502).json({ error: `Could not retrieve matching chunks. ${message}` });
  }
});

router.post("/admin/knowledge/documents/:documentId/decisions", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = DecideKnowledgeDocumentBody.safeParse(req.body);
  const notes = body.success ? body.data.notes.trim() : "";
  if (!body.success || notes.length < 10) {
    res.status(400).json({ error: "Choose a decision and write notes of 10–2000 characters." });
    return;
  }
  const id = req.params["documentId"]!;
  if (!UUID.test(id) || !(await documentDetail(id))) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await decideDocuments({ reviewerUserId: admin.id, documentIds: [id], decision: body.data.decision, notes, via: "admin-ui" });
  res.json(DecideKnowledgeDocumentResponse.parse(await documentDetail(id)));
});

router.post("/admin/knowledge/documents/:documentId/embed", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = req.params["documentId"]!;
  const detail = UUID.test(id) ? await documentDetail(id) : null;
  if (!detail) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const doc = detail.document;
  if (doc.approvalStatus !== "approved") {
    res.status(409).json({ error: "Only approved documents can be embedded. Approve it first." });
    return;
  }
  if (doc.sourceStatus !== "approved") {
    res.status(409).json({ error: `The source "${doc.sourceName}" is ${doc.sourceStatus}. Approve the source before embedding its documents.` });
    return;
  }
  if (!getGeminiApiKey()) {
    res.status(503).json({ error: "GEMINI_API_KEY is not configured, so embeddings cannot be generated." });
    return;
  }
  let result: EmbedResult;
  try {
    result = await runEmbedding({ adminUserId: admin.id, key: `doc:${id}`, sourceId: doc.sourceId, scope: { documentIds: [id] } });
  } catch (err) {
    if (sendKnownError(res, err)) return;
    throw err;
  }
  sendEmbedResult(res, result, (r) => EmbedKnowledgeDocumentResponse.parse(r));
});

router.post("/admin/knowledge/sources/:sourceId/decisions", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = DecideKnowledgeSourceBody.safeParse(req.body);
  const notes = body.success ? body.data.notes.trim() : "";
  if (!body.success || notes.length < 10) {
    res.status(400).json({ error: "Choose a decision and write notes of 10–2000 characters." });
    return;
  }
  const id = req.params["sourceId"]!;
  const r = UUID.test(id)
    ? await decideSource({ reviewerUserId: admin.id, sourceId: id, decision: body.data.decision, notes, via: "admin-ui" })
    : { found: false };
  if (!r.found) {
    res.status(404).json({ error: "Knowledge source not found." });
    return;
  }
  res.json(DecideKnowledgeSourceResponse.parse(await knowledgeSource(id)));
});

router.post("/admin/knowledge/sources/:sourceId/bulk-approve-documents", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const body = ApproveSyntheticKnowledgeDocumentsBody.safeParse(req.body);
  const notes = body.success ? body.data.notes.trim() : "";
  if (!body.success || notes.length < 10) {
    res.status(400).json({ error: "Enter the displayed pending count and review notes of 10–2000 characters." });
    return;
  }
  const id = req.params["sourceId"]!;
  if (!UUID.test(id)) {
    res.status(404).json({ error: "Knowledge source not found." });
    return;
  }
  try {
    const result = await approvePendingSyntheticRagDocuments({
      sourceId: id,
      reviewerUserId: admin.id,
      expectedPendingCount: body.data.expectedPendingCount,
      notes,
    });
    if (!result.found) {
      res.status(404).json({ error: "Knowledge source not found." });
      return;
    }
    const source = await knowledgeSource(id);
    if (!source) {
      res.status(404).json({ error: "Knowledge source not found." });
      return;
    }
    res.json(ApproveSyntheticKnowledgeDocumentsResponse.parse({ approvedCount: result.approved, source }));
  } catch (err) {
    if (err instanceof SyntheticBulkApprovalConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/admin/knowledge/sources/:sourceId/embed", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const id = req.params["sourceId"]!;
  const source = UUID.test(id) ? await knowledgeSource(id) : null;
  if (!source) {
    res.status(404).json({ error: "Knowledge source not found." });
    return;
  }
  if (source.approvalStatus !== "approved") {
    res.status(409).json({ error: `This source is ${source.approvalStatus}. Approve it before embedding its documents.` });
    return;
  }
  if (!getGeminiApiKey()) {
    res.status(503).json({ error: "GEMINI_API_KEY is not configured, so embeddings cannot be generated." });
    return;
  }
  let result: EmbedResult;
  try {
    result = await runEmbedding({ adminUserId: admin.id, key: `source:${id}`, sourceId: id, scope: { sourceId: id } });
  } catch (err) {
    if (sendKnownError(res, err)) return;
    throw err;
  }
  sendEmbedResult(res, result, (r) => EmbedKnowledgeSourceResponse.parse(r));
});

export default router;
