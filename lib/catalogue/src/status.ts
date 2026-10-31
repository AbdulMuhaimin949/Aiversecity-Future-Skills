import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@workspace/db/schema";
import { db } from "@workspace/db";
import { CATALOGUE_RUN_TYPE, type CatalogueTable } from "./import";

const CATALOGUE_TABLES: CatalogueTable[] = [
  "data_sources",
  "occupations",
  "skills",
  "occupation_skills",
];

/** Every table declared in the Drizzle schema (the source of truth for what should exist). */
export const SCHEMA_TABLE_NAMES: string[] = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableName(table))
  .sort();

export interface CatalogueDatabaseStatus {
  /** Installed pgvector version, or null when the extension is missing. */
  pgvector: string | null;
  expectedTables: number;
  presentTables: number;
  missingTables: string[];
  /** Row counts of the catalogue tables (null when the table is missing). */
  rows: Record<CatalogueTable, number | null>;
  /** Most recent catalogue import run, whatever its outcome. */
  lastImport: { status: string; finishedAt: string | null } | null;
  /** CSV fingerprint of the most recent successful import. */
  importedFingerprint: string | null;
}

/** Read-only snapshot of extension, schema and catalogue state in the connected database. */
export async function catalogueDatabaseStatus(): Promise<CatalogueDatabaseStatus> {
  const ext = await db.execute<{ extversion: string }>(
    sql`select extversion from pg_extension where extname = 'vector'`,
  );
  const present = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const presentNames = new Set(present.rows.map((r) => r.table_name));
  const missingTables = SCHEMA_TABLE_NAMES.filter((t) => !presentNames.has(t));

  const rows = {} as Record<CatalogueTable, number | null>;
  for (const table of CATALOGUE_TABLES) {
    if (!presentNames.has(table)) {
      rows[table] = null;
      continue;
    }
    const res = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)}`,
    );
    rows[table] = res.rows[0]?.n ?? 0;
  }

  let lastImport: CatalogueDatabaseStatus["lastImport"] = null;
  let importedFingerprint: string | null = null;
  if (presentNames.has("ingestion_runs")) {
    const res = await db.execute<{
      status: string;
      finished_at: Date | string | null;
    }>(
      sql`select status, finished_at from ingestion_runs
          where run_type = ${CATALOGUE_RUN_TYPE}
          order by started_at desc limit 1`,
    );
    const run = res.rows[0];
    if (run) {
      lastImport = {
        status: run.status,
        finishedAt: run.finished_at ? new Date(run.finished_at).toISOString() : null,
      };
    }
    const ok = await db.execute<{ details: string | null }>(
      sql`select details from ingestion_runs
          where run_type = ${CATALOGUE_RUN_TYPE} and status = 'succeeded'
          order by started_at desc limit 1`,
    );
    importedFingerprint = fingerprintOf(ok.rows[0]?.details ?? null);
  }

  return {
    pgvector: ext.rows[0]?.extversion ?? null,
    expectedTables: SCHEMA_TABLE_NAMES.length,
    presentTables: SCHEMA_TABLE_NAMES.length - missingTables.length,
    missingTables,
    rows,
    lastImport,
    importedFingerprint,
  };
}

function fingerprintOf(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { fingerprint?: unknown };
    return typeof parsed.fingerprint === "string" ? parsed.fingerprint : null;
  } catch {
    return null;
  }
}
