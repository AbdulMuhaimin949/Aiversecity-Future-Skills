/**
 * Grounded chat: retrieve approved chunks, ask Gemini to answer only from
 * them, and store the question, the answer and the chunks it cited.
 */
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  chatMessageCitationsTable,
  chatMessagesTable,
  chatSessionsTable,
  db,
  knowledgeChunksTable,
  knowledgeDocumentsTable,
  knowledgeSourcesTable,
  dataSourcesTable,
  type ChatMessage,
  type ChatSession,
  type LanguageCode,
} from "@workspace/db";
import {
  DeepSeekError,
  LEXICAL_RETRIEVAL_METHOD,
  generateReply,
  getActiveEmbeddingModelId,
  getChatModelName,
  getDeepSeekAvailability,
  getGeminiApiKey,
  knowledgeStats,
  retrieveLexical,
  type ChatTurn,
  type RetrievedChunk,
} from "@workspace/rag";
import { searchOnlyAnswer, uncitedFallback, DEFAULT_FOLLOW_UPS, excerpt, extractCitations, NO_SOURCE_REPLY, questionWithSources, splitFollowUps, systemInstruction } from "./prompt";

export const SUPPORTED: LanguageCode[] = ["ms", "zh-CN", "en"];
const HISTORY_MESSAGES = 6;

export class AssistantUnavailableError extends Error {}

export async function assistantStatus() {
  const llm = await getDeepSeekAvailability();
  const geminiConfigured = getGeminiApiKey() !== null;
  const modelId = await getActiveEmbeddingModelId();
  const stats = await knowledgeStats(modelId);
  const retrievalReady = stats.approvedChunks > 0;
  const embeddingReady = geminiConfigured && modelId !== null && stats.embeddedChunks > 0;
  const llmReady = llm.available;
  const chatReady = retrievalReady;
  return {
    ready: chatReady,
    retrievalReady,
    embeddingReady,
    llmReady,
    chatReady,
    mode: llmReady && retrievalReady ? ("ai" as const) : retrievalReady ? ("search_only" as const) : ("unavailable" as const),
    retrievalMethod: `${LEXICAL_RETRIEVAL_METHOD} (lexical keyword search, not vector semantic search)`,
    llmUnavailableReason: llm.available ? null : llm.reason,
    deepseekConfigured: llm.configured,
    geminiConfigured,
    chatModel: getChatModelName(),
    embeddingModel: modelId,
    approvedDocuments: stats.approvedDocuments,
    approvedChunks: stats.approvedChunks,
    embeddedChunks: stats.embeddedChunks,
    languages: SUPPORTED,
  };
}

export function toSessionDto(s: ChatSession) {
  return {
    id: s.id,
    title: s.title,
    language: s.language as LanguageCode,
    modelName: s.modelName,
    createdAt: s.createdAt,
    lastMessageAt: s.lastMessageAt,
  };
}

export type CitationDto = {
  rank: number;
  chunkId: string;
  relevanceScore: number | null;
  documentTitle: string;
  documentUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  excerpt: string;
};

function toMessageDto(m: ChatMessage, citations: CitationDto[]) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    language: m.language,
    modelName: m.modelName,
    createdAt: m.createdAt,
    citations,
  };
}

export async function listSessions(userId: string) {
  const rows = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.userId, userId), ne(chatSessionsTable.status, "deleted")))
    .orderBy(desc(chatSessionsTable.lastMessageAt), desc(chatSessionsTable.createdAt))
    .limit(50);
  return rows.map(toSessionDto);
}

export async function createSession(userId: string, language: LanguageCode) {
  const [row] = await db.insert(chatSessionsTable).values({ userId, language }).returning();
  return toSessionDto(row!);
}

/** The guest's newest session that has no messages yet, if any. */
export async function findEmptySession(userId: string): Promise<ChatSession | null> {
  const [row] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.userId, userId), ne(chatSessionsTable.status, "deleted"), isNull(chatSessionsTable.lastMessageAt)))
    .orderBy(desc(chatSessionsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function reuseSession(session: ChatSession, language: LanguageCode) {
  const [row] = await db.update(chatSessionsTable).set({ language }).where(eq(chatSessionsTable.id, session.id)).returning();
  return toSessionDto(row!);
}

export async function countActiveSessions(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.userId, userId), ne(chatSessionsTable.status, "deleted")));
  return row?.n ?? 0;
}

export async function getOwnedSession(userId: string, sessionId: string): Promise<ChatSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const [row] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, userId), ne(chatSessionsTable.status, "deleted")));
  return row ?? null;
}

export async function deleteSession(sessionId: string) {
  await db.update(chatSessionsTable).set({ status: "deleted" }).where(eq(chatSessionsTable.id, sessionId));
}

async function citationsFor(messageIds: string[]): Promise<Map<string, CitationDto[]>> {
  const out = new Map<string, CitationDto[]>();
  if (messageIds.length === 0) return out;
  const rows = await db
    .select({
      messageId: chatMessageCitationsTable.messageId,
      rank: chatMessageCitationsTable.rank,
      chunkId: chatMessageCitationsTable.chunkId,
      relevanceScore: chatMessageCitationsTable.relevanceScore,
      content: knowledgeChunksTable.content,
      documentTitle: knowledgeDocumentsTable.title,
      documentUrl: knowledgeDocumentsTable.url,
      sourceName: knowledgeSourcesTable.name,
      sourceBaseUrl: knowledgeSourcesTable.baseUrl,
      dataSourceUrl: dataSourcesTable.sourceUrl,
    })
    .from(chatMessageCitationsTable)
    .innerJoin(knowledgeChunksTable, eq(chatMessageCitationsTable.chunkId, knowledgeChunksTable.id))
    .innerJoin(knowledgeDocumentsTable, eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id))
    .innerJoin(knowledgeSourcesTable, eq(knowledgeDocumentsTable.knowledgeSourceId, knowledgeSourcesTable.id))
    .leftJoin(dataSourcesTable, eq(knowledgeSourcesTable.dataSourceId, dataSourcesTable.sourceId))
    .where(inArray(chatMessageCitationsTable.messageId, messageIds))
    .orderBy(asc(chatMessageCitationsTable.rank));
  for (const r of rows) {
    const list = out.get(r.messageId) ?? [];
    list.push({
      rank: r.rank,
      chunkId: r.chunkId,
      relevanceScore: r.relevanceScore,
      documentTitle: r.documentTitle,
      documentUrl: r.documentUrl,
      sourceName: r.sourceName,
      sourceUrl: r.sourceBaseUrl ?? r.dataSourceUrl ?? null,
      excerpt: excerpt(r.content),
    });
    out.set(r.messageId, list);
  }
  return out;
}

export async function sessionDetail(session: ChatSession) {
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, session.id))
    .orderBy(asc(chatMessagesTable.createdAt));
  const cites = await citationsFor(messages.filter((m) => m.role === "assistant").map((m) => m.id));
  return {
    session: toSessionDto(session),
    messages: messages.map((m) => toMessageDto(m, cites.get(m.id) ?? [])),
  };
}

export async function answerQuestion(session: ChatSession, question: string, language: LanguageCode) {

  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, session.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(HISTORY_MESSAGES);
  history.reverse();
  const previousQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? null;

  // Free PostgreSQL full-text retrieval over approved knowledge; no external API call.
  let chunks = await retrieveLexical(question);
  if (chunks.length === 0 && previousQuestion) chunks = await retrieveLexical(`${previousQuestion} ${question}`);
  const llm = await getDeepSeekAvailability();
  const chatModel = getChatModelName();

  let answer: string;
  let cited: { chunk: RetrievedChunk; rank: number }[] = [];
  let usage: { promptTokens: number | null; completionTokens: number | null } = { promptTokens: null, completionTokens: null };
  let modelName: string | null = null;
  let followUps: string[] = [];

  if (chunks.length === 0) {
    answer = NO_SOURCE_REPLY[language];
  } else if (!llm.available) {
    answer = searchOnlyAnswer(language, chunks, "no_llm");
    cited = chunks.slice(0, 3).map((chunk, i) => ({ chunk, rank: i + 1 }));
    modelName = "search-only:postgresql-fts";
  } else {
    const turns: ChatTurn[] = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), text: m.content }));
    while (turns.length && turns[0]!.role !== "user") turns.shift();
    turns.push({ role: "user", text: questionWithSources(question, chunks) });
    let reply: Awaited<ReturnType<typeof generateReply>> | null = null;
    try {
      reply = await generateReply({ model: chatModel, systemInstruction: systemInstruction(language), turns });
    } catch (err) {
      if (!(err instanceof DeepSeekError)) throw err;
    }
    if (!reply) {
      answer = searchOnlyAnswer(language, chunks, "llm_failed");
      cited = chunks.slice(0, 3).map((chunk, i) => ({ chunk, rank: i + 1 }));
      modelName = "search-only:postgresql-fts";
    } else {
    const split = splitFollowUps(reply.text);
    followUps = split.followUps;
    const parsed = extractCitations(split.answer, chunks.length);
    if (parsed.ranks.length > 0) {
      answer = parsed.text;
      cited = parsed.ranks.map((rank) => ({ chunk: chunks[rank - 1]!, rank }));
    } else {
      // Fail closed: generated text without a valid source marker is not shown.
      // Point to the most relevant approved sources instead.
      const top = chunks.slice(0, 3);
      answer = uncitedFallback(language, top.map((c, i) => `${c.documentTitle} [${i + 1}]`));
      cited = top.map((chunk, i) => ({ chunk, rank: i + 1 }));
      followUps = [];
    }
    usage = { promptTokens: reply.promptTokens, completionTokens: reply.completionTokens };
    modelName = chatModel;
    }
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    const [userMsg] = await tx
      .insert(chatMessagesTable)
      .values({ sessionId: session.id, role: "user", content: question, language, createdAt: now })
      .returning();
    const [assistantMsg] = await tx
      .insert(chatMessagesTable)
      .values({
        sessionId: session.id,
        role: "assistant",
        content: answer,
        language,
        modelName,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        createdAt: new Date(now.getTime() + 1),
      })
      .returning();
    if (cited.length) {
      await tx.insert(chatMessageCitationsTable).values(
        cited.map(({ chunk, rank }) => ({
          messageId: assistantMsg!.id,
          chunkId: chunk.chunkId,
          rank,
          relevanceScore: chunk.score,
        })),
      );
    }
    const [updated] = await tx
      .update(chatSessionsTable)
      .set({
        language,
        lastMessageAt: assistantMsg!.createdAt,
        title: session.title ?? (question.length > 80 ? `${question.slice(0, 79).trimEnd()}…` : question),
        ...(modelName ? { modelName } : {}),
      })
      .where(eq(chatSessionsTable.id, session.id))
      .returning();
    const citations: CitationDto[] = cited.map(({ chunk, rank }) => ({
      rank,
      chunkId: chunk.chunkId,
      relevanceScore: chunk.score,
      documentTitle: chunk.documentTitle,
      documentUrl: chunk.documentUrl,
      sourceName: chunk.sourceName,
      sourceUrl: chunk.sourceUrl,
      excerpt: excerpt(chunk.content),
    }));
    return {
      session: toSessionDto(updated!),
      userMessage: toMessageDto(userMsg!, []),
      assistantMessage: toMessageDto(assistantMsg!, citations),
      followUps: followUps.length ? followUps : DEFAULT_FOLLOW_UPS[language],
    };
  });
}
