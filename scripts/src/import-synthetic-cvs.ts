/**
 * Imports the fictional demo CVs, their claims, placeholder evidence and
 * review-case markers from knowledge/synthetic-addon into cv_documents,
 * cv_claims and cv_claim_evidence (see lib/catalogue/src/syntheticCv.ts).
 *
 * Run: pnpm --filter @workspace/scripts run db:import-synthetic-cvs
 *      ... -- --if-changed   only import when the CSVs differ from the last
 *                            successful import or rows are missing
 *
 * Needs the catalogue first (db:import-catalogue). Re-running is safe:
 * reviewer decisions and appeals are kept. synthetic_claim_test_oracle.csv is
 * never read. The published API runs the same change-gated import at startup.
 */
import { pool } from "@workspace/db";
import { importSyntheticCvs, syncSyntheticCvs, syntheticCvStatus, type SyntheticCvImportResult } from "@workspace/catalogue";

function printImport(r: SyntheticCvImportResult) {
  console.log("\nSynthetic CV import succeeded (all rows labelled synthetic):");
  console.table({ rows: r.rows, inserted: { ...r.inserted, review_cases: "-" } });
  for (const [table, ids] of Object.entries(r.notInCsv)) {
    if (ids.length > 0) console.warn(`${table}: ${ids.length} row(s) no longer in the CSVs (kept): ${ids.slice(0, 10).join(", ")}`);
  }
}

async function main() {
  if (process.argv.includes("--if-changed")) {
    const outcome = await syncSyntheticCvs();
    if (outcome.action === "imported") printImport(outcome.import);
    else if (outcome.action === "up_to_date") console.log("Synthetic CVs already up to date; nothing imported.");
    else {
      console.error(`Import skipped: ${outcome.reason}`);
      process.exitCode = 1;
    }
  } else {
    printImport(await importSyntheticCvs());
  }
  console.log("\nIn the database:");
  console.table((await syntheticCvStatus()).rows);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
