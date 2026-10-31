/**
 * Imports the fictional practice labs (synthetic_learning_resources.csv) and
 * demand-trend scenarios (synthetic_trend_scenarios.csv) from
 * knowledge/synthetic-addon into their own synthetic_* tables
 * (see lib/catalogue/src/syntheticLearning.ts). They are never mixed into the
 * e-LATiH course catalogue or the pipeline demand forecasts.
 *
 * Run: pnpm --filter @workspace/scripts run db:import-synthetic-learning
 *      ... -- --if-changed   only import when the CSVs differ from the last
 *                            successful import or row counts differ
 *
 * Needs the catalogue first (db:import-catalogue). Re-running is safe. The
 * published API runs the same change-gated import at startup.
 */
import { pool } from "@workspace/db";
import {
  importSyntheticLearning,
  syncSyntheticLearning,
  syntheticLearningStatus,
  type SyntheticLearningImportResult,
} from "@workspace/catalogue";

function printImport(r: SyntheticLearningImportResult) {
  console.log("\nSynthetic learning/trend import succeeded (all rows labelled synthetic):");
  console.table({ rows: r.rows, inserted: r.inserted, removed: r.removed });
}

async function main() {
  if (process.argv.includes("--if-changed")) {
    const outcome = await syncSyntheticLearning();
    if (outcome.action === "imported") printImport(outcome.import);
    else if (outcome.action === "up_to_date") console.log("Synthetic learning/trend data already up to date; nothing imported.");
    else {
      console.error(`Import skipped: ${outcome.reason}`);
      process.exitCode = 1;
    }
  } else {
    printImport(await importSyntheticLearning());
  }
  console.log("\nIn the database:");
  console.table((await syntheticLearningStatus()).rows);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
