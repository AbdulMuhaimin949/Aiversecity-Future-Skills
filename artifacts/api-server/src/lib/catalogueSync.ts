import { syncCatalogue, syncSyntheticCvs, syncSyntheticLearning } from "@workspace/catalogue";
import { DATA_DIR } from "./data";
import { logger } from "./logger";

/**
 * Brings the connected database's career catalogue in line with the bundled
 * pipeline CSVs. Enabled in the published app via CATALOGUE_SYNC_ON_START, so
 * the production database gets the same idempotent import as development
 * (which the workspace cannot reach directly).
 *
 * Data only: it never creates tables or extensions (Publish applies the
 * schema). It runs in the background, so a database problem is logged and
 * does not stop the API, which serves the catalogue from the CSVs.
 */
export async function syncCatalogueOnStartup(): Promise<void> {
  try {
    const outcome = await syncCatalogue({ dataDir: DATA_DIR, actorType: "api-startup-sync" });
    const { status } = outcome;
    const report = {
      action: outcome.action,
      pgvector: status.pgvector,
      tables: `${status.presentTables}/${status.expectedTables}`,
      rows: status.rows,
    };

    if (status.pgvector === null) {
      logger.warn(report, "Catalogue sync: pgvector extension is missing in this database");
    }
    if (outcome.action === "skipped") {
      logger.warn({ ...report, reason: outcome.reason }, "Catalogue sync skipped");
    } else if (outcome.action === "imported") {
      logger.info(
        { ...report, runId: outcome.import.runId, result: outcome.import.result },
        "Catalogue sync imported the pipeline catalogue",
      );
    } else {
      logger.info(report, "Catalogue sync: already up to date");
    }
  } catch (err) {
    logger.error({ err }, "Catalogue sync failed; the catalogue tables were left unchanged");
  }
  await syncSyntheticCvsOnStartup();
  await syncSyntheticLearningOnStartup();
}

/**
 * Imports the fictional demo CVs (knowledge/synthetic-addon) used by the CV
 * review demo, after the catalogue they reference. Same change-gated, data-only
 * rules as the catalogue; reviewer decisions and appeals are never touched.
 */
async function syncSyntheticCvsOnStartup(): Promise<void> {
  try {
    const outcome = await syncSyntheticCvs({ actorType: "api-startup-sync" });
    if (outcome.action === "skipped") {
      logger.warn({ reason: outcome.reason }, "Synthetic CV sync skipped");
    } else if (outcome.action === "imported") {
      logger.info({ rows: outcome.status.rows, inserted: outcome.import.inserted }, "Synthetic CV sync imported the demo CVs");
    } else {
      logger.info({ rows: outcome.status.rows }, "Synthetic CV sync: already up to date");
    }
  } catch (err) {
    logger.error({ err }, "Synthetic CV sync failed; the CV tables were left unchanged");
  }
}

/**
 * Imports the fictional practice labs and demand-trend scenarios
 * (knowledge/synthetic-addon) into their own synthetic_* tables, after the
 * catalogue they reference. Same change-gated, data-only rules.
 */
async function syncSyntheticLearningOnStartup(): Promise<void> {
  try {
    const outcome = await syncSyntheticLearning({ actorType: "api-startup-sync" });
    if (outcome.action === "skipped") {
      logger.warn({ reason: outcome.reason }, "Synthetic learning/trend sync skipped");
    } else if (outcome.action === "imported") {
      logger.info({ rows: outcome.status.rows, inserted: outcome.import.inserted }, "Synthetic learning/trend sync imported the fictional data");
    } else {
      logger.info({ rows: outcome.status.rows }, "Synthetic learning/trend sync: already up to date");
    }
  } catch (err) {
    logger.error({ err }, "Synthetic learning/trend sync failed; the synthetic tables were left unchanged");
  }
}
