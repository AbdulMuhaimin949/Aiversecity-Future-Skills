/**
 * Read-only report for the database DATABASE_URL points to: pgvector version,
 * schema tables present vs. declared, catalogue row counts and the last import.
 *
 * Run: pnpm --filter @workspace/scripts run db:catalogue-status
 */
import { pool } from "@workspace/db";
import { catalogueDatabaseStatus } from "@workspace/catalogue";

async function main() {
  const status = await catalogueDatabaseStatus();
  console.log(`pgvector: ${status.pgvector ?? "MISSING"}`);
  console.log(`tables:   ${status.presentTables}/${status.expectedTables}`);
  if (status.missingTables.length > 0) {
    console.log(`missing:  ${status.missingTables.join(", ")}`);
  }
  console.table(status.rows);
  console.log(
    status.lastImport
      ? `last import: ${status.lastImport.status} at ${status.lastImport.finishedAt ?? "(not finished)"}`
      : "last import: none",
  );
  if (status.pgvector === null || status.missingTables.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
