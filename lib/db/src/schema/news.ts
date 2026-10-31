import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./common";

/**
 * Cached NewsData.io articles relevant to Malaysian students and fresh graduates.
 * Deduplicated by articleId / originalUrl to respect API quota and prevent duplicates.
 */
export const newsArticlesTable = pgTable(
  "news_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: text("article_id").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    publisher: text("publisher").notNull(),
    originalUrl: text("original_url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    country: text("country").notNull().default("malaysia"),
    language: text("language").notNull().default("en"),
    category: text("category").notNull().default("career"),
    topic: text("topic").notNull().default("Graduate Employment"),
    mentionedSkills: jsonb("mentioned_skills").$type<string[]>().default([]),
    isGraduateUpdate: boolean("is_graduate_update").notNull().default(false),
    relevanceScore: numeric("relevance_score", {
      precision: 4,
      scale: 2,
      mode: "number",
    }),
    sourceProvenance: text("source_provenance")
      .notNull()
      .default("NEWSDATA_IO_LIVE"),
    validationStatus: text("validation_status")
      .notNull()
      .default("VERIFIED_LIVE"),
    isMalaysiaRelevant: boolean("is_malaysia_relevant").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("news_articles_published_at_idx").on(t.publishedAt),
    index("news_articles_topic_idx").on(t.topic),
    index("news_articles_country_idx").on(t.country),
  ],
);
