import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { createdAt, updatedAt } from "./common";
import { knowledgeChunksTable } from "./knowledge";
import { languagesTable, usersTable } from "./users";

export const chatSessionStatusEnum = pgEnum("chat_session_status", [
  "active",
  "closed",
  "deleted",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
  "system",
]);

/** Gemini assistant conversations (the chatbot itself is not built yet). */
export const chatSessionsTable = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title"),
    language: text("language")
      .notNull()
      .default("ms")
      .references(() => languagesTable.code, { onUpdate: "cascade" }),
    /** Gemini model used for replies, e.g. gemini-2.5-flash. */
    modelName: text("model_name"),
    status: chatSessionStatusEnum("status").notNull().default("active"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("chat_sessions_user_idx").on(t.userId, t.lastMessageAt)],
);

export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessionsTable.id, { onDelete: "cascade" }),
    role: chatMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    language: text("language").references(() => languagesTable.code, {
      onUpdate: "cascade",
    }),
    modelName: text("model_name"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: createdAt(),
  },
  (t) => [
    index("chat_messages_session_idx").on(t.sessionId, t.createdAt),
    check(
      "chat_messages_tokens_nonnegative",
      sql`coalesce(${t.promptTokens}, 0) >= 0 and coalesce(${t.completionTokens}, 0) >= 0`,
    ),
  ],
);

/** Which knowledge chunks grounded an assistant reply. */
export const chatMessageCitationsTable = pgTable(
  "chat_message_citations",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessagesTable.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => knowledgeChunksTable.id, { onDelete: "restrict" }),
    rank: integer("rank").notNull(),
    relevanceScore: real("relevance_score"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.chunkId] }),
    index("chat_message_citations_chunk_idx").on(t.chunkId),
    check("chat_message_citations_rank_positive", sql`${t.rank} >= 1`),
  ],
);

export const insertChatSessionSchema = createInsertSchema(
  chatSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessionsTable.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(
  chatMessagesTable,
).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;

export const insertChatMessageCitationSchema = createInsertSchema(
  chatMessageCitationsTable,
).omit({ createdAt: true });
export type InsertChatMessageCitation = z.infer<
  typeof insertChatMessageCitationSchema
>;
export type ChatMessageCitation = typeof chatMessageCitationsTable.$inferSelect;
