// scripts/sync-newsdata-live.mjs
// Phase 14: Controlled live NewsData.io connectivity test & cache hydration (max 2 requests)

import fs from "node:fs";
import { NewsDataService } from "../artifacts/api-server/src/lib/newsdata.ts";

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const service = new NewsDataService();
const metaBefore = service.getSyncMetadata();

if (!metaBefore.keyConfigured) {
  console.log("[LIVE TEST] NEWSDATA_API_KEY not configured. Skipping live request.");
  process.exit(0);
}

console.log("=== PHASE 14: CONTROLLED LIVE NEWSDATA.IO VALIDATION ===");
console.log("1. Executing Query #1 (Malaysia graduate/employment/skills/AI news)...");
await service.forceRefresh({ queryIndex: 0 });

console.log("2. Executing Query #2 (Global future skills / internship / AI automation news)...");
await service.forceRefresh({ queryIndex: 1 });

const payload = await service.getArticles({ limit: 30 });
const metaAfter = payload.syncMeta;

console.log("\n--- LIVE VALIDATION SUMMARY ---");
console.log("Integration Status :", metaAfter.integrationStatus);
console.log("Sync Attempts      :", metaAfter.syncAttempts);
console.log("Successful Syncs   :", metaAfter.successfulSyncs);
console.log("Estimated Credits  :", metaAfter.estimatedCreditsUsed);
console.log("Live Articles      :", metaAfter.liveArticlesCount);
console.log("Baseline Articles  :", metaAfter.cachedBaselineCount);
console.log("Total Stored       :", metaAfter.totalStoredArticles);
console.log("Last Refreshed At  :", metaAfter.lastRefreshedAt);

const liveSample = payload.articles.filter((a) => a.sourceProvenance === "NEWSDATA_IO_LIVE").slice(0, 5);
console.log("\n--- SAMPLE LIVE NEWSDATA.IO ARTICLES ---");
for (const art of liveSample) {
  console.log(`- [${art.region} | ${art.topic}] ${art.title} (${art.publisher}, ${art.publishedAt})`);
  console.log(`  URL: ${art.originalUrl}`);
}

