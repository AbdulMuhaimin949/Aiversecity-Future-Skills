/**
 * Knowledge sources the assistant may cite, and how each one turns into
 * documents. Every document starts as `pending`; nothing is embedded or
 * retrieved until a reviewer approves both the source and the document.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import type { LanguageCode } from "@workspace/db/schema";

type Row = Record<string, string>;

export type SourceDocument = {
  title: string;
  url: string | null;
  language: LanguageCode;
  mimeType: string;
  dataOrigin: "SOURCE_ATTRIBUTED" | "SYNTHETIC";
  publishedAt: Date | null;
  /** Full document text (markdown). Chunked before storage. */
  text: string;
};

export type SourceDefinition = {
  name: string;
  sourceType: string;
  dataSourceId: string | null;
  baseUrl: string | null;
  licenceNotes: string;
  defaultLanguage: LanguageCode;
  load: () => SourceDocument[];
  /** Rows the loader rejected during validation (recorded as run errors). */
  validate?: () => string[];
};

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

function dataDir(): string {
  const candidates = [
    process.env["PIPELINE_DATA_DIR"],
    path.join(repoRoot, "pipeline/data"),
    path.resolve(process.cwd(), "pipeline/data"),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((d) => fs.existsSync(path.join(d, "silver")));
  if (!found) throw new Error(`Pipeline data directory not found. Tried: ${candidates.join(", ")}`);
  return found;
}

function readCsv(rel: string): Row[] {
  const file = path.join(dataDir(), rel);
  if (!fs.existsSync(file)) throw new Error(`Missing CSV: ${file}`);
  return parse(fs.readFileSync(file, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
}

const pct = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "not available";
};

const humanise = (v: string) => v.replace(/_/g, " ").toLowerCase();

// ------------------------------------------------- career catalogue (roles)

function loadOccupationDocuments(): SourceDocument[] {
  const occupations = readCsv("silver/occupations.csv");
  const skills = new Map(readCsv("silver/skills.csv").map((r) => [r["skill_id"]!, r]));
  const occSkills = readCsv("silver/occupation_skills.csv");
  const sdgs = readCsv("gold/occupation_sdgs.csv");
  const resources = readCsv("gold/learning_resources.csv");
  const forecasts = new Map<string, Row>();
  for (const r of readCsv("gold/forecast_features_scenarios.csv")) forecasts.set(r["occupation_id"]!, r);
  const sources = new Map(readCsv("bronze/source_catalogue.csv").map((r) => [r["source_id"]!, r]));

  const skillsByOcc = new Map<string, Row[]>();
  for (const r of occSkills) {
    const list = skillsByOcc.get(r["occupation_id"]!) ?? [];
    list.push(r);
    skillsByOcc.set(r["occupation_id"]!, list);
  }
  const sdgsByOcc = new Map<string, Row[]>();
  for (const r of sdgs) {
    const list = sdgsByOcc.get(r["occupation_id"]!) ?? [];
    list.push(r);
    sdgsByOcc.set(r["occupation_id"]!, list);
  }

  return occupations.map((o) => {
    const id = o["occupation_id"]!;
    const links = skillsByOcc.get(id) ?? [];
    const skillLine = (importance: string) =>
      links
        .filter((l) => l["importance_level"] === importance)
        .map((l) => {
          const s = skills.get(l["skill_id"]!);
          return `${s?.["canonical_name"] ?? l["skill_id"]} (proficiency ${l["required_proficiency"]}/5)`;
        })
        .join("; ") || "none listed";
    const linkedSkillIds = new Set(links.map((l) => l["skill_id"]!));
    const courses = resources.filter((r) =>
      (r["target_skill_ids"] ?? "").split("|").some((sid) => linkedSkillIds.has(sid)),
    );
    const fc = forecasts.get(id);
    const src = sources.get(o["source_id"]!);
    const synthetic = o["is_synthetic"]?.toLowerCase() === "true";

    const lines = [
      `# ${o["canonical_title"]} (MASCO 2020 code ${o["masco_2020_code"]})`,
      [
        `Sector: ${o["industry_sector"]}.`,
        `Career level: ${o["career_level"]}.`,
        `Minimum education: ${o["min_education_level"]}.`,
        `Minimum experience: ${o["min_experience_years"]} years.`,
        `Malaysia Critical Occupations List (MyCOL) status: ${humanise(o["mycol_critical_status"] ?? "unknown")}.`,
        `ESCO code: ${o["esco_code"]}.`,
      ].join("\n"),
      `Role description: ${o["role_description"]}`,
      `Required skills for ${o["canonical_title"]}: ${skillLine("Required")}.`,
      `Preferred skills for ${o["canonical_title"]}: ${skillLine("Preferred")}.`,
    ];
    if (fc) {
      lines.push(
        `AI Risk for ${o["canonical_title"]}: ${pct(fc["ai_exposure_index"])} (how much AI may affect the role's tasks, not a prediction of job loss). Job Safety: ${pct(fc["ai_augmentation_potential"])} (how much AI may help with the work, not a guarantee of employment). These are estimates; for non-technology sectors the exposure levels are assumptions ordered by ILO Working Paper 96 (2023).`,
      );
    }
    const occSdgs = sdgsByOcc.get(id) ?? [];
    if (occSdgs.length) {
      lines.push(
        `UN Sustainable Development Goals: ${occSdgs
          .map((s) => `SDG ${s["sdg_goal_number"]} ${s["sdg_goal_title"]} (target ${s["sdg_target_code"]})`)
          .join("; ")}. ${o["sdg_rationale"] ?? ""}`.trim(),
      );
    }
    lines.push(
      courses.length
        ? `HRD Corp e-LATiH courses that teach some of these skills: ${courses
            .map((c) => `${c["course_title"]} (${c["estimated_hours"]} hours, ${c["delivery_mode"]})`)
            .join("; ")}.`
        : `No course in the e-LATiH catalogue used by Aiversecity teaches this role's skills yet.`,
    );
    lines.push(
      `Data provenance: ${src?.["source_name"] ?? o["source_id"]}; verification status ${o["verification_status"]}${synthetic ? "; synthetic record" : ""}. Proficiency targets and role descriptions are generated by the Aiversecity pipeline.`,
    );

    return {
      title: `${o["canonical_title"]} — role profile`,
      url: null,
      language: "en",
      mimeType: "text/markdown",
      dataOrigin: synthetic ? "SYNTHETIC" : "SOURCE_ATTRIBUTED",
      publishedAt: null,
      text: lines.join("\n\n"),
    } satisfies SourceDocument;
  });
}

// ---------------------------------------------- e-LATiH learning resources

function loadCourseDocuments(): SourceDocument[] {
  const skills = new Map(readCsv("silver/skills.csv").map((r) => [r["skill_id"]!, r]));
  return readCsv("gold/learning_resources.csv").map((r) => {
    const taught = (r["target_skill_ids"] ?? "")
      .split("|")
      .filter(Boolean)
      .map((id) => skills.get(id)?.["canonical_name"] ?? id);
    const cost = Number(r["cost_amount"]);
    const synthetic = /SYNTHETIC/i.test(r["verification_status"] ?? "");
    return {
      title: r["course_title"]!,
      url: r["provider_url"] || null,
      language: "en",
      mimeType: "text/markdown",
      dataOrigin: synthetic ? "SYNTHETIC" : "SOURCE_ATTRIBUTED",
      publishedAt: null,
      text: [
        `# ${r["course_title"]}`,
        [
          `Provider: ${r["provider_name"]}.`,
          `Delivery mode: ${r["delivery_mode"]}.`,
          `Estimated learning time: ${r["estimated_hours"]} hours.`,
          `Cost: ${cost === 0 ? "free" : `${r["cost_amount"]} ${r["currency"]}`}.`,
          `Level: ${r["prerequisite_level"]}.`,
          `Skills taught: ${taught.join("; ") || "not specified"}.`,
          `Course page: ${r["provider_url"]}`,
        ].join("\n"),
        `Verification status: ${r["verification_status"]}.`,
      ].join("\n\n"),
    } satisfies SourceDocument;
  });
}

// ------------------------------------------------- methodology (markdown)

/** Parses `---\nkey: value\n---` front matter. */
function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2]! };
}

const METHODOLOGY_DIR = path.join(repoRoot, "knowledge/methodology");

function loadMethodologyDocuments(): SourceDocument[] {
  if (!fs.existsSync(METHODOLOGY_DIR)) throw new Error(`Missing folder: ${METHODOLOGY_DIR}`);
  const files = fs.readdirSync(METHODOLOGY_DIR).filter((f) => f.endsWith(".md")).sort();
  return files.map((f) => {
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(METHODOLOGY_DIR, f), "utf-8"));
    const title = meta["title"];
    if (!title) throw new Error(`${f}: front matter must include "title"`);
    const language = (meta["language"] ?? "en") as LanguageCode;
    if (!["ms", "zh-CN", "en"].includes(language)) throw new Error(`${f}: unsupported language "${language}"`);
    const origin = meta["data_origin"] ?? "SOURCE_ATTRIBUTED";
    if (origin !== "SOURCE_ATTRIBUTED" && origin !== "SYNTHETIC") throw new Error(`${f}: bad data_origin "${origin}"`);
    return {
      title,
      url: meta["url"] || null,
      language,
      mimeType: "text/markdown",
      dataOrigin: origin,
      publishedAt: meta["published"] ? new Date(meta["published"]) : null,
      text: body,
    };
  });
}

// ------------------------------------ synthetic RAG add-on (hackathon demo)

const SYNTHETIC_DIR = path.join(repoRoot, "knowledge/synthetic-addon");
const SYNTHETIC_TYPES = new Set(["ROLE_OVERVIEW", "SKILLS_PATHWAY"]);

function readSyntheticDocs(): { docs: SourceDocument[]; rejected: string[] } {
  const file = path.join(SYNTHETIC_DIR, "rag_knowledge_documents.csv");
  if (!fs.existsSync(file)) throw new Error(`Missing CSV: ${file}`);
  const rows = parse(fs.readFileSync(file, "utf-8"), { columns: true, skip_empty_lines: true, trim: true }) as Row[];
  const occupations = new Map(readCsv("silver/occupations.csv").map((r) => [r["occupation_id"]!, r]));
  const docs: SourceDocument[] = [];
  const rejected: string[] = [];
  for (const r of rows) {
    const id = r["document_id"] ?? "(no id)";
    const problems: string[] = [];
    if (!/^SYN_DOC_\d+$/.test(id)) problems.push("document_id is not a SYN_DOC id");
    if (r["is_synthetic"] !== "true") problems.push("is_synthetic is not true");
    if (!occupations.has(r["occupation_id"] ?? "")) problems.push(`unknown occupation_id ${r["occupation_id"]}`);
    if (!SYNTHETIC_TYPES.has(r["document_type"] ?? "")) problems.push(`unknown document_type ${r["document_type"]}`);
    if (!["ms", "zh-CN", "en"].includes(r["language"] ?? "")) problems.push(`unsupported language ${r["language"]}`);
    if (!r["title"]?.trim() || !r["content"]?.trim()) problems.push("title or content is empty");
    if (problems.length) {
      rejected.push(`${id}: ${problems.join("; ")}`);
      continue;
    }
    const occ = occupations.get(r["occupation_id"]!)!;
    docs.push({
      title: r["title"]!,
      url: null,
      language: r["language"] as LanguageCode,
      mimeType: "text/markdown",
      dataOrigin: "SYNTHETIC",
      publishedAt: r["created_at"] ? new Date(r["created_at"]) : null,
      text: [
        `# ${r["title"]}`,
        r["content"]!,
        `Fictional demo data (is_synthetic = true). Document ${id}, version ${r["version"] || "1"}, type ${humanise(r["document_type"]!)}, linked role ${occ["canonical_title"] ?? occ["title"] ?? r["occupation_id"]} (${r["occupation_id"]}). Licence: ${r["source_license"] || "generated demo only"}. Not real Malaysian labour-market statistics.`,
      ].join("\n\n"),
    });
  }
  return { docs, rejected };
}

// -------------- synthetic practice labs + trend scenarios (hackathon demo)

/**
 * One document per skill (its fictional practice labs) and one per role (its
 * fictional quarterly demand index). Titles are unique per skill / role so the
 * "newer version retires older" rule never collides. Validated against the
 * pipeline catalogue ids; rows that are not marked synthetic are rejected.
 */
function readSyntheticLearningDocs(): { docs: SourceDocument[]; rejected: string[] } {
  const read = (name: string) => {
    const file = path.join(SYNTHETIC_DIR, name);
    if (!fs.existsSync(file)) throw new Error(`Missing CSV: ${file}`);
    return parse(fs.readFileSync(file, "utf-8"), { columns: true, skip_empty_lines: true, trim: true }) as Row[];
  };
  const skills = new Map(readCsv("silver/skills.csv").map((r) => [r["skill_id"]!, r]));
  const occupations = new Map(readCsv("silver/occupations.csv").map((r) => [r["occupation_id"]!, r]));
  const rejected: string[] = [];

  const labsBySkill = new Map<string, Row[]>();
  for (const r of read("synthetic_learning_resources.csv")) {
    const id = r["resource_id"] ?? "(no id)";
    const skillIds = (r["target_skill_ids"] ?? "").split("|").filter(Boolean);
    const problems: string[] = [];
    if (r["is_synthetic"]?.toLowerCase() !== "true") problems.push("is_synthetic is not true");
    if (r["availability_status"] !== "NOT_AN_ACTUAL_COURSE") problems.push("availability_status is not NOT_AN_ACTUAL_COURSE");
    if (!skillIds.length) problems.push("no target skills");
    for (const sid of skillIds) if (!skills.has(sid)) problems.push(`unknown skill ${sid}`);
    if (problems.length) {
      rejected.push(`${id}: ${problems.join("; ")}`);
      continue;
    }
    for (const sid of skillIds) labsBySkill.set(sid, [...(labsBySkill.get(sid) ?? []), r]);
  }

  const trendsByOcc = new Map<string, Row[]>();
  for (const r of read("synthetic_trend_scenarios.csv")) {
    const id = r["observation_id"] ?? "(no id)";
    const problems: string[] = [];
    if (r["is_synthetic"]?.toLowerCase() !== "true") problems.push("is_synthetic is not true");
    if (r["unit"] !== "FICTIONAL_DEMAND_INDEX") problems.push(`unit ${r["unit"]} is not FICTIONAL_DEMAND_INDEX`);
    if (!occupations.has(r["occupation_id"] ?? "")) problems.push(`unknown occupation_id ${r["occupation_id"]}`);
    if (!Number.isFinite(Number(r["scenario_index"]))) problems.push("scenario_index is not a number");
    if (problems.length) {
      rejected.push(`${id}: ${problems.join("; ")}`);
      continue;
    }
    trendsByOcc.set(r["occupation_id"]!, [...(trendsByOcc.get(r["occupation_id"]!) ?? []), r]);
  }

  const notice =
    "Fictional demo data (is_synthetic = true) from the Aiversecity synthetic hackathon dataset SYN_AIVERSECITY_V1.";
  const docs: SourceDocument[] = [];
  for (const [sid, labs] of [...labsBySkill].sort(([a], [b]) => a.localeCompare(b))) {
    const name = skills.get(sid)!["canonical_name"]!;
    docs.push({
      title: `Fictional practice labs — ${name} (Synthetic)`,
      url: null,
      language: "en",
      mimeType: "text/markdown",
      dataOrigin: "SYNTHETIC",
      publishedAt: null,
      text: [
        `# Fictional practice labs — ${name} (Synthetic)`,
        `SIMULATED PRACTICE IDEAS for the skill ${name} (${sid}). These labs are NOT actual courses, are not offered by any training provider and are not part of the HRD Corp e-LATiH catalogue.`,
        labs
          .map(
            (l) =>
              `- ${l["course_title"]} (${l["resource_id"]}): ${l["prerequisite_level"]} level, about ${l["estimated_hours"]} hours, ${l["delivery_mode"]}, provider "${l["provider_name"]}" (fictional), cost ${l["cost_amount"]} ${l["currency"]}.`,
          )
          .join("\n"),
        `${notice} Availability: NOT_AN_ACTUAL_COURSE.`,
      ].join("\n\n"),
    });
  }
  for (const [oid, rows] of [...trendsByOcc].sort(([a], [b]) => a.localeCompare(b))) {
    const title = occupations.get(oid)!["canonical_title"]!;
    const sorted = [...rows].sort((a, b) => a["quarter"]!.localeCompare(b["quarter"]!));
    docs.push({
      title: `Fictional demand scenario — ${title} (Synthetic)`,
      url: null,
      language: "en",
      mimeType: "text/markdown",
      dataOrigin: "SYNTHETIC",
      publishedAt: null,
      text: [
        `# Fictional demand scenario — ${title} (Synthetic)`,
        `SIMULATED DEMAND INDEX for ${title} (${oid}), geography ${humanise(sorted[0]?.["geography"] ?? "fictional scenario")}. ${sorted[0]?.["disclaimer"] ?? "Not a real employment statistic or forecast"}. It is not the Aiversecity demand forecast and must not be quoted as Malaysian labour-market data.`,
        `Quarterly fictional index values: ${sorted.map((r) => `${r["quarter"]} ${Number(r["scenario_index"]).toFixed(2)}`).join("; ")}.`,
        notice,
      ].join("\n\n"),
    });
  }
  return { docs, rejected };
}

export const SOURCES: SourceDefinition[] = [
  {
    name: "Aiversecity career catalogue",
    sourceType: "pipeline_catalogue",
    dataSourceId: "SRC_MASCO_2020",
    baseUrl: null,
    licenceNotes:
      "Role profiles built from the Aiversecity pipeline: MASCO 2020 codes, ESCO-aligned skills, MyCOL status, UN SDG targets and AI Risk / Job Safety estimates.",
    defaultLanguage: "en",
    load: loadOccupationDocuments,
  },
  {
    name: "HRD Corp e-LATiH course catalogue",
    sourceType: "learning_catalogue",
    dataSourceId: "SRC_ELATIH_HRDC",
    baseUrl: "https://elatih.hrdcorp.gov.my/",
    licenceNotes: "Course titles, durations and links curated from the public e-LATiH web catalogue.",
    defaultLanguage: "en",
    load: loadCourseDocuments,
  },
  {
    name: "Aiversecity methodology notes",
    sourceType: "project_documentation",
    dataSourceId: null,
    baseUrl: null,
    licenceNotes: "Written by the Aiversecity team; explains how scores, scenarios and data sources work.",
    defaultLanguage: "en",
    load: loadMethodologyDocuments,
  },
  {
    name: "Aiversecity synthetic knowledge add-on",
    sourceType: "synthetic_demo",
    dataSourceId: null,
    baseUrl: null,
    licenceNotes:
      "100% fictional hackathon dataset (SYN_AIVERSECITY_V1, seed 20261030) built from existing occupation and skill ids. Not real vacancies, salaries, courses or labour-market statistics.",
    defaultLanguage: "en",
    load: () => readSyntheticDocs().docs,
    validate: () => readSyntheticDocs().rejected,
  },
  {
    name: "Aiversecity synthetic practice labs and trend scenarios",
    sourceType: "synthetic_demo",
    dataSourceId: null,
    baseUrl: null,
    licenceNotes:
      "100% fictional hackathon dataset (SYN_AIVERSECITY_V1): practice-lab ideas per skill (NOT actual courses, not e-LATiH) and a fictional quarterly demand index per role (not a real statistic or forecast).",
    defaultLanguage: "en",
    load: () => readSyntheticLearningDocs().docs,
    validate: () => readSyntheticLearningDocs().rejected,
  },
];
