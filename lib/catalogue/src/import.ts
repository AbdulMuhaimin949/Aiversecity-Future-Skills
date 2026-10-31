/**
 * Imports the career catalogue from the pipeline CSVs into PostgreSQL:
 *   pipeline/data/bronze/source_catalogue.csv -> data_sources
 *   pipeline/data/silver/occupations.csv      -> occupations
 *   pipeline/data/silver/skills.csv           -> skills
 *   pipeline/data/silver/occupation_skills.csv-> occupation_skills
 * and seeds the reference rows for languages and roles.
 *
 * - Original pipeline IDs are the primary keys, so re-running is idempotent:
 *   rows are upserted, and unchanged rows are left untouched.
 * - Every row is validated (required fields, enums, ranges, references)
 *   before anything is written; any problem aborts the whole import.
 * - Rows are never deleted. Rows in the database that are no longer in the
 *   CSVs are reported so they can be reviewed.
 * - Synthetic CVs, chat content and simulated match results are not imported.
 *
 * Used by the `db:import-catalogue` script (development) and by the API
 * server's production startup sync (see sync.ts).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  auditLogsTable,
  dataSourcesTable,
  db,
  ingestionRunsTable,
  languagesTable,
  occupationSkillsTable,
  occupationsTable,
  pool,
  rolesTable,
  skillsTable,
  type InsertDataSource,
  type InsertOccupation,
  type InsertOccupationSkill,
  type InsertSkill,
} from "@workspace/db";

type Row = Record<string, string>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const CATALOGUE_RUN_TYPE = "catalogue_csv_import";
const CHUNK_SIZE = 500;

const LANGUAGES = [
  { code: "ms", nameEn: "Malay", nativeName: "Bahasa Melayu", isDefault: true },
  { code: "zh-CN", nameEn: "Chinese (Simplified)", nativeName: "简体中文", isDefault: false },
  { code: "en", nameEn: "English", nativeName: "English", isDefault: false },
];

const ROLES = [
  { code: "applicant", name: "Applicant", description: "Builds a skills profile, sees matches and can appeal decisions." },
  { code: "reviewer", name: "Reviewer", description: "Reviews CV claims, match results, knowledge documents and appeals." },
  { code: "admin", name: "Administrator", description: "Manages users, roles, knowledge sources and imports." },
];

// ---------------------------------------------------------------- CSV input

/** Finds pipeline/data from the env override, this file's location or the cwd. */
export function resolveCatalogueDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env["PIPELINE_DATA_DIR"],
    path.resolve(here, "../../../pipeline/data"),
    path.resolve(process.cwd(), "pipeline/data"),
    path.resolve(process.cwd(), "../../pipeline/data"),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, "silver")));
  if (!found) {
    throw new Error(`Pipeline data directory not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

export const CATALOGUE_CSV_FILES = [
  "bronze/source_catalogue.csv",
  "silver/occupations.csv",
  "silver/skills.csv",
  "silver/occupation_skills.csv",
] as const;

/** SHA-256 over the four catalogue CSVs, used to skip imports when nothing changed. */
export function catalogueFingerprint(dataDir: string): string {
  const hash = createHash("sha256");
  for (const rel of CATALOGUE_CSV_FILES) {
    const file = path.join(dataDir, rel);
    if (!fs.existsSync(file)) throw new Error(`Missing CSV: ${file}`);
    hash.update(rel).update("\0").update(fs.readFileSync(file)).update("\0");
  }
  return hash.digest("hex");
}

function readCsv(dataDir: string, rel: string): Row[] {
  return readCsvFile(path.join(dataDir, rel));
}

/** Parses a CSV file with a header row into trimmed string records. */
export function readCsvFile(file: string): Row[] {
  if (!fs.existsSync(file)) throw new Error(`Missing CSV: ${file}`);
  return parse(fs.readFileSync(file, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
}

// --------------------------------------------------------------- validation

/** Number of data rows in each catalogue CSV (no validation). */
export function catalogueCsvRowCounts(dataDir: string): Record<CatalogueTable, number> {
  return {
    data_sources: readCsv(dataDir, "bronze/source_catalogue.csv").length,
    occupations: readCsv(dataDir, "silver/occupations.csv").length,
    skills: readCsv(dataDir, "silver/skills.csv").length,
    occupation_skills: readCsv(dataDir, "silver/occupation_skills.csv").length,
  };
}

/** Collects row-level problems so an import can report all of them before writing. */
export class Validator {
  readonly errors: string[] = [];

  constructor(private file: string) {}

  fail(line: number, msg: string) {
    this.errors.push(`${this.file} row ${line}: ${msg}`);
  }

  required(row: Row, line: number, col: string): string {
    const v = row[col];
    if (v === undefined) {
      this.fail(line, `missing column "${col}"`);
      return "";
    }
    if (v === "") this.fail(line, `"${col}" is empty`);
    return v;
  }

  optional(row: Row, col: string): string | null {
    const v = row[col];
    return v === undefined || v === "" ? null : v;
  }

  oneOf(row: Row, line: number, col: string, allowed: readonly string[]): string {
    const v = this.required(row, line, col);
    if (v && !allowed.includes(v)) {
      this.fail(line, `"${col}" = "${v}" is not one of ${allowed.join(", ")}`);
    }
    return v;
  }

  bool(row: Row, line: number, col: string): boolean {
    const v = this.required(row, line, col).toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
    this.fail(line, `"${col}" = "${row[col]}" is not True/False`);
    return false;
  }

  int(row: Row, line: number, col: string, min: number, max: number): number {
    const raw = this.required(row, line, col);
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.fail(line, `"${col}" = "${raw}" must be an integer between ${min} and ${max}`);
    }
    return n;
  }

  decimal(row: Row, line: number, col: string, min: number, max: number): number {
    const raw = this.required(row, line, col);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      this.fail(line, `"${col}" = "${raw}" must be a number between ${min} and ${max}`);
    }
    return n;
  }

  date(row: Row, line: number, col: string): string | null {
    const v = this.optional(row, col);
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      this.fail(line, `"${col}" = "${v}" is not a YYYY-MM-DD date`);
    }
    return v;
  }

  reference(line: number, col: string, value: string, known: Set<string>, target: string) {
    if (value && !known.has(value)) {
      this.fail(line, `"${col}" = "${value}" does not exist in ${target}`);
    }
  }

  unique(line: number, label: string, value: string, seen: Set<string>) {
    if (seen.has(value)) this.fail(line, `duplicate ${label} "${value}"`);
    seen.add(value);
  }
}

// CSV header is line 1, so data row i is on line i + 2.
export const lineOf = (i: number) => i + 2;

function buildSources(rows: Row[], v: Validator): InsertDataSource[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const sourceId = v.required(r, line, "source_id");
    v.unique(line, "source_id", sourceId, seen);
    const verificationStatus = v.required(r, line, "verification_status");
    return {
      sourceId,
      sourceName: v.required(r, line, "source_name"),
      sourceUrl: v.required(r, line, "source_url"),
      sourceType: v.required(r, line, "source_type"),
      publicationDate: v.date(r, line, "publication_date"),
      retrievalDate: v.date(r, line, "retrieval_date"),
      licenceOrUsageNotes: v.optional(r, "licence_or_usage_notes"),
      verificationStatus,
      dataOrigin: verificationStatus.startsWith("SYNTHETIC") ? "SYNTHETIC" : "SOURCE_ATTRIBUTED",
    };
  });
}

/** Rejects rows that claim to be non-synthetic but cite the synthetic generator. */
function originFor(
  v: Validator,
  line: number,
  isSynthetic: boolean,
  sourceId: string,
  sources: Map<string, InsertDataSource>,
): "SYNTHETIC" | "SOURCE_ATTRIBUTED" {
  const source = sources.get(sourceId);
  if (!isSynthetic && source?.dataOrigin === "SYNTHETIC") {
    v.fail(line, `is_synthetic=False but source "${sourceId}" is a synthetic generator`);
  }
  return isSynthetic ? "SYNTHETIC" : "SOURCE_ATTRIBUTED";
}

function buildOccupations(
  rows: Row[],
  v: Validator,
  sources: Map<string, InsertDataSource>,
): InsertOccupation[] {
  const seen = new Set<string>();
  const sourceIds = new Set(sources.keys());
  return rows.map((r, i) => {
    const line = lineOf(i);
    const occupationId = v.required(r, line, "occupation_id");
    v.unique(line, "occupation_id", occupationId, seen);
    const sourceId = v.required(r, line, "source_id");
    v.reference(line, "source_id", sourceId, sourceIds, "source_catalogue.csv");
    const isSynthetic = v.bool(r, line, "is_synthetic");
    return {
      occupationId,
      canonicalTitle: v.required(r, line, "canonical_title"),
      masco2020Code: v.optional(r, "masco_2020_code"),
      escoCode: v.optional(r, "esco_code"),
      industrySector: v.required(r, line, "industry_sector"),
      careerLevel: v.oneOf(r, line, "career_level", ["Entry", "Mid", "Senior", "Lead"]),
      roleDescription: v.optional(r, "role_description"),
      minEducationLevel: v.optional(r, "min_education_level"),
      minExperienceYears: v.int(r, line, "min_experience_years", 0, 60),
      mycolCriticalStatus: v.optional(r, "mycol_critical_status"),
      primarySdgId: v.optional(r, "primary_sdg_id"),
      sdgRationale: v.optional(r, "sdg_rationale"),
      sourceId,
      verificationStatus: v.required(r, line, "verification_status"),
      isSynthetic,
      dataOrigin: originFor(v, line, isSynthetic, sourceId, sources),
    };
  });
}

function buildSkills(
  rows: Row[],
  v: Validator,
  sources: Map<string, InsertDataSource>,
): InsertSkill[] {
  const seen = new Set<string>();
  const sourceIds = new Set(sources.keys());
  return rows.map((r, i) => {
    const line = lineOf(i);
    const skillId = v.required(r, line, "skill_id");
    v.unique(line, "skill_id", skillId, seen);
    const sourceId = v.required(r, line, "source_id");
    v.reference(line, "source_id", sourceId, sourceIds, "source_catalogue.csv");
    const isSynthetic = v.bool(r, line, "is_synthetic");
    return {
      skillId,
      canonicalName: v.required(r, line, "canonical_name"),
      skillCategory: v.required(r, line, "skill_category"),
      skillType: v.required(r, line, "skill_type"),
      synonyms: (r["synonyms_pipe_delimited"] ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
      description: v.optional(r, "description"),
      escoSkillUri: v.optional(r, "esco_skill_uri"),
      sourceId,
      verificationStatus: v.required(r, line, "verification_status"),
      isSynthetic,
      dataOrigin: originFor(v, line, isSynthetic, sourceId, sources),
    };
  });
}

function buildOccupationSkills(
  rows: Row[],
  v: Validator,
  sourceIds: Set<string>,
  occupationIds: Set<string>,
  skillIds: Set<string>,
): InsertOccupationSkill[] {
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();
  return rows.map((r, i) => {
    const line = lineOf(i);
    const occSkillId = v.required(r, line, "occ_skill_id");
    v.unique(line, "occ_skill_id", occSkillId, seenIds);
    const occupationId = v.required(r, line, "occupation_id");
    const skillId = v.required(r, line, "skill_id");
    const sourceId = v.required(r, line, "source_id");
    v.reference(line, "occupation_id", occupationId, occupationIds, "occupations.csv");
    v.reference(line, "skill_id", skillId, skillIds, "skills.csv");
    v.reference(line, "source_id", sourceId, sourceIds, "source_catalogue.csv");
    v.unique(line, "occupation/skill pair", `${occupationId}/${skillId}`, seenPairs);
    return {
      occSkillId,
      occupationId,
      skillId,
      importanceLevel: v.oneOf(r, line, "importance_level", ["Required", "Preferred"]),
      requiredProficiency: v.int(r, line, "required_proficiency", 1, 5),
      transferabilityWeight: v.decimal(r, line, "transferability_weight", 0, 1),
      sourceId,
      verificationStatus: v.required(r, line, "verification_status"),
    };
  });
}

// ------------------------------------------------------------------ upserts

export interface UpsertCount {
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Inserts rows, updating existing ones only when a value actually changed
 * (so unchanged rows keep their updated_at). Counts come from `xmax = 0`,
 * which is true for freshly inserted rows.
 */
async function upsert(
  tx: Tx,
  table: PgTable,
  keyColumn: string,
  rows: Record<string, unknown>[],
): Promise<UpsertCount> {
  const columns = getTableColumns(table);
  const updatable = Object.entries(columns).filter(
    ([, col]) => !["created_at", "updated_at", keyColumn].includes(col.name),
  );
  const set: Record<string, SQL> = Object.fromEntries(
    updatable.map(([key, col]) => [key, sql.raw(`excluded."${col.name}"`)]),
  );
  set["updatedAt"] = sql`now()`;
  const target = updatable.map(([, col]) => `"${col.name}"`);
  const changed = sql.raw(
    `(${target.map((c) => `${tableName(table)}.${c}`).join(", ")}) is distinct from (${target
      .map((c) => `excluded.${c}`)
      .join(", ")})`,
  );
  const keyCol = Object.values(columns).find((c) => c.name === keyColumn);
  if (!keyCol) throw new Error(`Unknown key column ${keyColumn}`);

  const count: UpsertCount = { inserted: 0, updated: 0, unchanged: 0 };
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await tx
      .insert(table)
      .values(chunk)
      .onConflictDoUpdate({ target: keyCol, set, setWhere: changed })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    const inserted = result.filter((r) => r.inserted).length;
    count.inserted += inserted;
    count.updated += result.length - inserted;
    count.unchanged += chunk.length - result.length;
  }
  return count;
}

function tableName(table: PgTable): string {
  const name = (table as unknown as Record<symbol, string>)[
    Symbol.for("drizzle:Name")
  ];
  if (!name) throw new Error("Could not resolve table name");
  return `"${name}"`;
}

async function notInCsv(
  tx: Tx,
  table: string,
  key: string,
  ids: string[],
): Promise<string[]> {
  const res = await tx.execute<{ id: string }>(
    sql`select ${sql.identifier(key)} as id from ${sql.identifier(table)}
        where not (${sql.identifier(key)} = any(${sql.param(ids)}::text[]))`,
  );
  return res.rows.map((r) => r.id);
}

// --------------------------------------------------------------------- main

export type CatalogueTable = "data_sources" | "occupations" | "skills" | "occupation_skills";

export interface CatalogueImportResult {
  runId: string;
  fingerprint: string;
  /** Rows read from each CSV. */
  csvRows: Record<CatalogueTable, number>;
  result: Record<CatalogueTable, UpsertCount>;
  /** IDs present in the database but no longer in the CSVs (kept, not deleted). */
  notInCsv: Record<CatalogueTable, string[]>;
}

export interface CatalogueImportOptions {
  dataDir?: string;
  /** Recorded in audit_logs.actor_type. */
  actorType?: string;
}

/**
 * Validates and upserts the catalogue. Throws (after recording a failed
 * ingestion run) when validation or the write fails; nothing is written then.
 */
export async function importCatalogue(
  options: CatalogueImportOptions = {},
): Promise<CatalogueImportResult> {
  const dataDir = options.dataDir ?? resolveCatalogueDataDir();
  const actorType = options.actorType ?? "import-script";
  const fingerprint = catalogueFingerprint(dataDir);

  const sourceV = new Validator("bronze/source_catalogue.csv");
  const sources = buildSources(readCsv(dataDir, "bronze/source_catalogue.csv"), sourceV);
  const sourceMap = new Map(sources.map((s) => [s.sourceId, s]));

  const occV = new Validator("silver/occupations.csv");
  const occupations = buildOccupations(readCsv(dataDir, "silver/occupations.csv"), occV, sourceMap);

  const skillV = new Validator("silver/skills.csv");
  const skills = buildSkills(readCsv(dataDir, "silver/skills.csv"), skillV, sourceMap);

  const linkV = new Validator("silver/occupation_skills.csv");
  const links = buildOccupationSkills(
    readCsv(dataDir, "silver/occupation_skills.csv"),
    linkV,
    new Set(sourceMap.keys()),
    new Set(occupations.map((o) => o.occupationId)),
    new Set(skills.map((s) => s.skillId)),
  );

  const errors = [sourceV, occV, skillV, linkV].flatMap((v) => v.errors);
  const recordsSeen = sources.length + occupations.length + skills.length + links.length;

  const [run] = await db
    .insert(ingestionRunsTable)
    .values({ runType: CATALOGUE_RUN_TYPE, status: "running", recordsSeen })
    .returning({ id: ingestionRunsTable.id });
  if (!run) throw new Error("Could not record ingestion run");

  const markFailed = async (message: string) => {
    await db
      .update(ingestionRunsTable)
      .set({ status: "failed", errorMessage: message.slice(0, 4000), finishedAt: new Date() })
      .where(eq(ingestionRunsTable.id, run.id));
  };

  if (errors.length > 0) {
    const shown = errors.slice(0, 25).join("\n  ");
    const more = errors.length > 25 ? `\n  ...and ${errors.length - 25} more` : "";
    await markFailed(`${errors.length} validation error(s):\n${errors.join("\n")}`);
    throw new Error(`Import aborted, nothing was written. ${errors.length} problem(s):\n  ${shown}${more}`);
  }

  try {
    const summary = await db.transaction(async (tx) => {
      await tx.insert(languagesTable).values(LANGUAGES).onConflictDoNothing();
      await tx.insert(rolesTable).values(ROLES).onConflictDoNothing();
      const result = {
        data_sources: await upsert(tx, dataSourcesTable, "source_id", sources),
        occupations: await upsert(tx, occupationsTable, "occupation_id", occupations),
        skills: await upsert(tx, skillsTable, "skill_id", skills),
        occupation_skills: await upsert(tx, occupationSkillsTable, "occ_skill_id", links),
      };
      const extra = {
        data_sources: await notInCsv(tx, "data_sources", "source_id", sources.map((s) => s.sourceId)),
        occupations: await notInCsv(tx, "occupations", "occupation_id", occupations.map((o) => o.occupationId)),
        skills: await notInCsv(tx, "skills", "skill_id", skills.map((s) => s.skillId)),
        occupation_skills: await notInCsv(tx, "occupation_skills", "occ_skill_id", links.map((l) => l.occSkillId)),
      };
      await tx.insert(auditLogsTable).values({
        actorType,
        action: "catalogue.import",
        entityType: "ingestion_run",
        entityId: run.id,
        metadata: { fingerprint, result, notInCsv: Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.length])) },
      });
      return { result, extra };
    });

    const totals = Object.values(summary.result).reduce(
      (acc, c) => ({ inserted: acc.inserted + c.inserted, updated: acc.updated + c.updated }),
      { inserted: 0, updated: 0 },
    );
    await db
      .update(ingestionRunsTable)
      .set({
        status: "succeeded",
        recordsInserted: totals.inserted,
        recordsUpdated: totals.updated,
        details: JSON.stringify({ fingerprint, ...summary.result }),
        finishedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, run.id));

    return {
      runId: run.id,
      fingerprint,
      csvRows: {
        data_sources: sources.length,
        occupations: occupations.length,
        skills: skills.length,
        occupation_skills: links.length,
      },
      result: summary.result,
      notInCsv: summary.extra,
    };
  } catch (err) {
    await markFailed(err instanceof Error ? err.message : String(err));
    throw err;
  }
}
