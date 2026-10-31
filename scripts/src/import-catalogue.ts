/**
 * Imports the career catalogue from the pipeline CSVs into the database that
 * DATABASE_URL points to (validated, idempotent upserts; see
 * lib/catalogue/src/import.ts for the rules).
 *
 * Run: pnpm --filter @workspace/scripts run db:import-catalogue
 *      ... -- --if-changed   only import when the CSVs differ from the last
 *                            successful import or rows are missing
 *
 * The published app runs the same import itself at startup (see the API
 * server's catalogue sync), because the production database is not
 * reachable from the workspace.
 */
import { pool } from "@workspace/db";
import {
  catalogueDatabaseStatus,
  importCatalogue,
  resolveCatalogueDataDir,
  syncCatalogue,
  type CatalogueDatabaseStatus,
  type CatalogueImportResult,
} from "@workspace/catalogue";

function printImport(result: CatalogueImportResult) {
  console.log("\nImport succeeded:");
  console.table(result.result);
  for (const [table, ids] of Object.entries(result.notInCsv)) {
    if (ids.length > 0) {
      console.warn(
        `${table}: ${ids.length} row(s) in the database are no longer in the CSV (kept): ${ids.slice(0, 10).join(", ")}`,
      );
    }
  }
}

function printStatus(status: CatalogueDatabaseStatus) {
  console.log(
    `\npgvector: ${status.pgvector ?? "MISSING"} | tables: ${status.presentTables}/${status.expectedTables}`,
  );
  console.table(status.rows);
}

async function main() {
  const dataDir = resolveCatalogueDataDir();
  console.log(`Reading CSVs from ${dataDir}`);

  if (process.argv.includes("--if-changed")) {
    const outcome = await syncCatalogue({ dataDir });
    if (outcome.action === "imported") printImport(outcome.import);
    else if (outcome.action === "up_to_date") console.log("\nCatalogue already up to date; nothing imported.");
    else {
      console.error(`\nImport skipped: ${outcome.reason}`);
      process.exitCode = 1;
    }
    printStatus(outcome.status);
    return;
  }

  printImport(await importCatalogue({ dataDir }));
  printStatus(await catalogueDatabaseStatus());
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
