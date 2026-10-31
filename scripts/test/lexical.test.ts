/**
 * Free retrieval test: no Gemini or DeepSeek calls. Approval is simulated inside
 * a transaction that is always rolled back, so real approval state is untouched.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { db, pool, knowledgeDocumentsTable, knowledgeSourcesTable } from "@workspace/db";
import { buildLexicalQuery, retrieveLexical } from "@workspace/rag";

const QUESTIONS = [
  "Apakah kemahiran untuk Data Analyst?",
  "What skills are needed for Data Analyst?",
  "成为数据分析师需要哪些技能？",
];

class Rollback extends Error {}

test("glossary maps ms/zh/en questions to the same English role phrase", () => {
  for (const q of QUESTIONS) {
    const query = buildLexicalQuery(q);
    assert.equal(query.phraseQuery, "(data <-> analyst)", q);
  }
});

test("pending documents are never retrieved; approved ones are, with citations data", async () => {
  for (const q of QUESTIONS) assert.deepEqual(await retrieveLexical(q), [], `pending leaked for: ${q}`);

  let approvedResults: Record<string, Awaited<ReturnType<typeof retrieveLexical>>> = {};
  let excludedTitle = "";
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.update(knowledgeSourcesTable).set({ approvalStatus: "approved" }).where(eq(knowledgeSourcesTable.name, "Aiversecity synthetic knowledge add-on"));
      await tx.update(knowledgeDocumentsTable).set({ approvalStatus: "approved" });
      // Keep one Data Analyst document pending to prove it is filtered out.
      const [held] = await tx
        .update(knowledgeDocumentsTable)
        .set({ approvalStatus: "pending" })
        .where(and(like(knowledgeDocumentsTable.title, "Junior Data Analyst — Role Overview%")))
        .returning({ title: knowledgeDocumentsTable.title });
      excludedTitle = held!.title;
      for (const q of QUESTIONS) approvedResults[q] = await retrieveLexical(q, { executor: tx });
      throw new Rollback();
    }),
    Rollback,
  );
  for (const q of QUESTIONS) {
    const rows = approvedResults[q]!;
    assert.ok(rows.length > 0, `no results for: ${q}`);
    assert.ok(rows.every((r) => /data analyst/i.test(r.documentTitle)), `off-topic result for: ${q}`);
    assert.ok(rows.every((r) => r.documentTitle !== excludedTitle), `pending doc returned for: ${q}`);
    assert.ok(rows.every((r) => r.documentId && r.chunkId && r.sourceName), `missing citation fields for: ${q}`);
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(QUESTIONS.map((q) => [q, approvedResults[q]!.map((r) => r.documentTitle)])),
      null,
      1,
    ),
  );
  // Rolled back: still nothing approved.
  assert.deepEqual(await retrieveLexical(QUESTIONS[1]!), []);
});

test.after(() => pool.end());
