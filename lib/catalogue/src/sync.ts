import { pool } from "@workspace/db";
import {
  catalogueCsvRowCounts,
  catalogueFingerprint,
  importCatalogue,
  resolveCatalogueDataDir,
  type CatalogueImportResult,
  type CatalogueTable,
} from "./import";
import { catalogueDatabaseStatus, type CatalogueDatabaseStatus } from "./status";

/** Session-level advisory lock key so only one process imports at a time. */
const LOCK_KEY = "workspace.catalogue_import";

export type CatalogueSyncOutcome =
  | { action: "up_to_date"; status: CatalogueDatabaseStatus }
  | { action: "imported"; status: CatalogueDatabaseStatus; import: CatalogueImportResult }
  | { action: "skipped"; reason: string; status: CatalogueDatabaseStatus };

export interface CatalogueSyncOptions {
  dataDir?: string;
  actorType?: string;
}

/**
 * Imports the catalogue only when the database is behind the CSVs: the last
 * successful import used different CSV contents, or a table has fewer rows
 * than its CSV. Never changes the schema; skips when tables are missing.
 * Safe to call from several processes at once (advisory lock).
 */
export async function syncCatalogue(
  options: CatalogueSyncOptions = {},
): Promise<CatalogueSyncOutcome> {
  const dataDir = options.dataDir ?? resolveCatalogueDataDir();

  const before = await catalogueDatabaseStatus();
  if (before.missingTables.length > 0) {
    return {
      action: "skipped",
      reason: `schema not applied: ${before.missingTables.length} table(s) missing (${before.missingTables.join(", ")})`,
      status: before,
    };
  }

  const fingerprint = catalogueFingerprint(dataDir);
  const csvRows = catalogueCsvRowCounts(dataDir);
  if (isUpToDate(before, fingerprint, csvRows)) {
    return { action: "up_to_date", status: before };
  }

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as locked",
      [LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) {
      return { action: "skipped", reason: "another process is importing the catalogue", status: before };
    }
    try {
      // Another process may have finished while we waited for the lock.
      const current = await catalogueDatabaseStatus();
      if (isUpToDate(current, fingerprint, csvRows)) {
        return { action: "up_to_date", status: current };
      }
      const result = await importCatalogue({ dataDir, actorType: options.actorType });
      return { action: "imported", status: await catalogueDatabaseStatus(), import: result };
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

function isUpToDate(
  status: CatalogueDatabaseStatus,
  fingerprint: string,
  csvRows: Record<CatalogueTable, number>,
): boolean {
  if (status.importedFingerprint !== fingerprint) return false;
  return (Object.keys(csvRows) as CatalogueTable[]).every(
    (table) => (status.rows[table] ?? 0) >= csvRows[table],
  );
}
