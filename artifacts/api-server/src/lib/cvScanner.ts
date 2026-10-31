import { getDocumentProxy } from "unpdf";
import { data } from "./data";
import { extractSkills, EXTRACTION_NOTE } from "./extractor";

/**
 * CV scanner: reads a PDF (or pasted text) and suggests a profile.
 *
 * Two engines:
 *  - RULE_BASED (default): synonym-normalised skill matching over the
 *    taxonomy, plus pattern rules for education level and years of
 *    experience. Fully reproducible, no external calls.
 *  - AI_MODEL (only when OPENAI_API_KEY is set): an OpenAI model reads the
 *    CV and may only pick skills from the taxonomy. Every skill it returns
 *    must quote evidence that literally appears in the CV, otherwise it is
 *    dropped. Falls back to RULE_BASED (and says so) if the call fails.
 */

export type EducationLevel = "SPM" | "Diploma/DKM" | "Bachelor" | "Master/PhD";

export interface ScannedSkill {
  skillId: string;
  name: string;
  category: string;
  proficiency: number;
  matchedTerm: string;
  evidence: string;
}

export interface CvScanResult {
  engine: "AI_MODEL" | "RULE_BASED";
  method: string;
  note: string;
  personName: string | null;
  fileName: string | null;
  pageCount: number | null;
  characterCount: number;
  textPreview: string;
  skills: ScannedSkill[];
  suggestedEducation: EducationLevel | null;
  educationEvidence: string | null;
  suggestedYearsExperience: number | null;
  experienceEvidence: string | null;
  suggestedSectors: { sector: string; matchedSkillCount: number }[];
}

export class CvScanError extends Error {}

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;

/* ------------------------------------------------------------------ */
/* Person name                                                         */
/* ------------------------------------------------------------------ */

const NAME_STOP_WORDS = new Set([
  "about", "academic", "achievement", "address", "awards", "bachelor", "career", "certification",
  "accounting", "administration", "business", "computer", "curriculum", "cv", "data", "degree",
  "economics", "education", "engineering", "email", "experience", "expertise", "finance",
  "healthcare", "history", "human", "information", "linkedin", "law", "management", "marketing",
  "nursing", "objective", "phone", "profile", "professional", "psychology", "qualification",
  "references", "resources", "resume", "science", "skills", "software", "summary", "technology",
  "work",
]);

const NAME_ROLE_WORDS = new Set([
  "accountant", "administrator", "analyst", "assistant", "consultant", "designer", "developer",
  "director", "engineer", "executive", "manager", "nurse", "officer", "specialist", "teacher",
]);

function isPersonName(value: string): boolean {
  const cleaned = value.trim();
  if (cleaned.length < 4 || cleaned.length > 120 || /[@:/\\|,0-9]/u.test(cleaned)) return false;
  const parts = cleaned.split(/\s+/u);
  if (parts.length < 2 || parts.length > 8) return false;
  const tokenPattern = /^(?:\p{L}\.?|\p{L}[\p{L}'’.-]*\p{L})$/u;
  if (!parts.every((part) => tokenPattern.test(part))) return false;
  const words = parts.map((part) => part.replace(/[.'’\-]/gu, "").toLowerCase());
  if (words.some((word) => NAME_STOP_WORDS.has(word))) return false;
  if (words.filter((word) => NAME_ROLE_WORDS.has(word)).length > 0) return false;
  return true;
}

function headerNameFragment(line: string): string {
  return line
    .replace(/^(?:(?:full\s+)?name)\s*[:：-]\s*/iu, "")
    .split(/\s*(?:\||•|·|—|–|\s-\s)\s*/u, 1)[0]!
    .replace(/\s+(?:e-?mail|phone|mobile|tel|linkedin|website|portfolio|address)\s*[:：]?\s*.*$/iu, "")
    .replace(/\s+[^\s@]+@[^\s@]+\.[^\s@]+.*$/u, "")
    .replace(/\s+\+?\d[\d ().-]{5,}\d.*$/u, "")
    .replace(/^[\s,;:|•·-]+|[\s,;:|•·-]+$/gu, "")
    .trim();
}

/** Detect one unambiguous name in the CV header; never derive a name from the uploaded filename. */
export function detectPersonName(text: string): string | null {
  const lines = text.split(/\r?\n/u).map((line) => line.replace(/^\s*[•*·-]\s*/u, "").trim()).filter(Boolean);
  const header = lines.slice(0, 12);
  const explicitlyLabelled = header
    .filter((line) => /^(?:full\s+)?name\s*[:：-]/iu.test(line))
    .map(headerNameFragment)
    .filter((name) => isPersonName(name));
  if (explicitlyLabelled.length === 1) return explicitlyLabelled[0]!;
  if (explicitlyLabelled.length > 1) return null;

  const candidates = [...new Set(header.map(headerNameFragment).filter((name) => isPersonName(name)))];
  return candidates.length === 1 ? candidates[0]! : null;
}

/* ------------------------------------------------------------------ */
/* PDF -> text                                                         */
/* ------------------------------------------------------------------ */

export async function pdfToText(buf: Buffer): Promise<{ text: string; pageCount: number }> {
  if (buf.length > MAX_PDF_BYTES) throw new CvScanError("The PDF is larger than 5 MB.");
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new CvScanError("This file is not a PDF.");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf));
  } catch {
    throw new CvScanError("The PDF could not be opened. It may be damaged or password-protected.");
  }
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  const text = pages.join("\n\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: text.slice(0, MAX_TEXT_CHARS), pageCount: pdf.numPages };
}

/* ------------------------------------------------------------------ */
/* Education level                                                     */
/* ------------------------------------------------------------------ */

const EDU_PATTERNS: [EducationLevel, RegExp][] = [
  [
    "Master/PhD",
    /\b(ph\.?\s?d|doctor of philosophy|doctorate|master of|master'?s degree|masters degree|m\.?sc\b|mba\b|m\.eng|sarjana (?!muda))/i,
  ],
  [
    "Bachelor",
    /\b(bachelor|honours degree|degree in|ijazah|sarjana muda|b\.?sc\b|b\.eng|beng\b|llb\b|mbbs\b|b\.ed\b|bba\b|b\.a\.)/i,
  ],
  ["Diploma/DKM", /\b(diploma|dkm\b|dvm\b|skm\s*(tahap|level)\s*[45])/i],
  [
    "SPM",
    /\b(spm\b|stpm\b|skm\b|sijil pelajaran malaysia|o[- ]level|a[- ]level|matriculation|matrikulasi|foundation in)/i,
  ],
];

function detectEducation(lines: string[]): { level: EducationLevel | null; evidence: string | null } {
  for (const [level, re] of EDU_PATTERNS) {
    const hit = lines.find((l) => re.test(l));
    if (hit) return { level, evidence: clip(hit) };
  }
  return { level: null, evidence: null };
}

/* ------------------------------------------------------------------ */
/* Years of experience                                                 */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, mac: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, ogo: 7,
  sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dis: 11,
};
const DATE = String.raw`(?:(?:(jan|feb|mar|mac|apr|may|mei|jun|jul|aug|ogo|sep|oct|okt|nov|dec|dis)[a-z]*\.?[ \t]+)|(?:(\d{1,2})[/.-]))?((?:19|20)\d{2})`;
const OPEN_END = String.raw`(present|current|now|today|date|kini|sekarang|masa kini)`;
const RANGE = new RegExp(`\\b${DATE}[ \\t]*(?:-|–|—|to|until|hingga|sehingga)[ \\t]*(?:${DATE}|${OPEN_END})`, "gi");

const HEADING_EXP = /^(work |professional |employment |career |working )?(experience|history|employment)s?\b|^pengalaman/i;
const HEADING_OTHER =
  /^(education|academic|pendidikan|qualifications?|kelayakan|skills?|kemahiran|certifications?|projects?|references?|rujukan|languages?|bahasa|awards?|achievements?|interests?|summary|profile|objective|activities|co-curricular|kokurikulum|personal|contact|volunteer|training|courses?)\b/i;

function toMonth(mon: string | undefined, num: string | undefined, year: string): number {
  let m = 0;
  if (mon && MONTHS[mon.toLowerCase().slice(0, 3)] !== undefined) m = MONTHS[mon.toLowerCase().slice(0, 3)]!;
  else if (num && +num >= 1 && +num <= 12) m = +num - 1;
  return +year * 12 + m;
}

function detectExperience(text: string, lines: string[]): { years: number | null; evidence: string | null } {
  // 1. An explicit statement such as "5 years of experience" / "3+ yrs experience" / "4 tahun pengalaman".
  const stated = [
    ...text.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?|tahun)\b[^.\n]{0,30}?\b(experience|pengalaman)/gi),
  ];
  if (stated.length) {
    const best = stated.reduce((a, b) => (parseFloat(b[1]!) > parseFloat(a[1]!) ? b : a));
    const years = Math.min(50, parseFloat(best[1]!));
    return { years, evidence: `CV states "${clip(best[0], 80)}"` };
  }

  // 2. Date ranges inside the work-experience section.
  let inExp = false;
  let sawExpHeading = false;
  const expLines: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (l.length > 0 && l.length <= 40) {
      if (HEADING_EXP.test(l)) {
        inExp = true;
        sawExpHeading = true;
        continue;
      }
      if (HEADING_OTHER.test(l)) {
        inExp = false;
        continue;
      }
    }
    if (inExp) expLines.push(l);
  }
  if (!sawExpHeading) return { years: null, evidence: null };

  const now = new Date();
  const nowM = now.getFullYear() * 12 + now.getMonth();
  const spans: [number, number, string][] = [];
  for (const m of expLines.join("\n").matchAll(RANGE)) {
    const start = toMonth(m[1], m[2], m[3]!);
    const end = m[7] ? nowM : m[6] ? toMonth(m[4], m[5], m[6]) : NaN;
    if (!Number.isFinite(end) || end < start || start > nowM) continue;
    spans.push([start, Math.min(end, nowM) + 1, m[0].trim()]);
  }
  if (!spans.length) return { years: null, evidence: null };

  // Merge overlapping jobs so parallel roles are not double-counted.
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = [spans[0]![0], spans[0]![1]];
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  const years = Math.min(50, Math.round((total / 12) * 10) / 10);
  return {
    years,
    evidence: `Added up ${spans.length} date range${spans.length > 1 ? "s" : ""} in the experience section (${spans
      .slice(0, 4)
      .map((s) => s[2])
      .join("; ")}${spans.length > 4 ? "; …" : ""})`,
  };
}

/* ------------------------------------------------------------------ */
/* Industry suggestions                                                */
/* ------------------------------------------------------------------ */

const sectorSkillSets = (() => {
  const m = new Map<string, Set<string>>();
  for (const o of data.occupations) {
    const set = m.get(o.sector) ?? new Set<string>();
    for (const os of data.occSkillsByOcc.get(o.id) ?? []) set.add(os.skillId);
    m.set(o.sector, set);
  }
  return m;
})();

function suggestSectors(skillIds: string[]) {
  const domain = skillIds.filter((id) => data.skillById.get(id)?.category !== "Core_Transferable");
  return [...sectorSkillSets.entries()]
    .map(([sector, set]) => ({
      sector,
      matchedSkillCount: domain.filter((id) => set.has(id)).length,
      share: domain.filter((id) => set.has(id)).length / Math.sqrt(set.size),
    }))
    .filter((s) => s.matchedSkillCount > 0)
    .sort((a, b) => b.share - a.share || b.matchedSkillCount - a.matchedSkillCount)
    .slice(0, 3)
    .map(({ sector, matchedSkillCount }) => ({ sector, matchedSkillCount }));
}

/* ------------------------------------------------------------------ */
/* Optional AI engine (only with the user's own OPENAI_API_KEY)         */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

async function aiSkills(text: string): Promise<{ skills: ScannedSkill[]; model: string; dropped: number }> {
  const model = process.env["OPENAI_MODEL"] || "gpt-5-mini";
  const catalogue = data.skills.map((s) => `${s.id} | ${s.name}`).join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}`,
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read CVs from any industry and map the person's demonstrated abilities to a fixed skill catalogue. " +
            "Only use skill IDs from the catalogue. Do not invent skills. For each skill, copy a short exact quote (5-25 words) " +
            "from the CV as evidence, and rate proficiency 1-5 (1 = mentioned only, 3 = used at work, 5 = expert/leads others). " +
            'Return JSON: {"skills":[{"skillId":"SKL_0001","proficiency":3,"evidence":"exact quote"}]}. ' +
            "Return at most 25 skills.\n\nSKILL CATALOGUE (id | name):\n" +
            catalogue,
        },
        { role: "user", content: `CV TEXT:\n${text.slice(0, 20_000)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI returned HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as {
    skills?: { skillId?: string; proficiency?: number; evidence?: string }[];
  };
  const hay = norm(text);
  const out = new Map<string, ScannedSkill>();
  let dropped = 0;
  for (const s of parsed.skills ?? []) {
    const sk = s.skillId ? data.skillById.get(s.skillId) : undefined;
    const ev = typeof s.evidence === "string" ? s.evidence : "";
    // Keep only catalogue skills whose quoted evidence really is in the CV.
    if (!sk || ev.length < 3 || !hay.includes(norm(ev))) {
      dropped++;
      continue;
    }
    out.set(sk.id, {
      skillId: sk.id,
      name: sk.name,
      category: sk.category,
      proficiency: Math.min(5, Math.max(1, Math.round(Number(s.proficiency) || 3))),
      matchedTerm: "AI-identified",
      evidence: clip(ev),
    });
  }
  return { skills: [...out.values()], model, dropped };
}

/* ------------------------------------------------------------------ */

function clip(s: string, n = 220) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export async function scanCv(
  input: { text: string; fileName: string | null; pageCount: number | null },
  log: { warn: (obj: object, msg: string) => void },
): Promise<CvScanResult> {
  const text = input.text;
  if (text.replace(/\s/g, "").length < 40) {
    throw new CvScanError(
      input.pageCount !== null
        ? "No readable text was found in this PDF. It is probably a scanned image — please export your CV as a text-based PDF, or paste the text instead."
        : "Please paste more of your CV text.",
    );
  }
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const edu = detectEducation(lines);
  const exp = detectExperience(text, lines);

  let engine: CvScanResult["engine"] = "RULE_BASED";
  let method = `Rule-based scanner: synonym matching on ${data.skills.length} taxonomy skills across ${sectorSkillSets.size} industries, plus pattern rules for education and work dates. No AI model used.`;
  let note = EXTRACTION_NOTE;
  let skills: ScannedSkill[] = extractSkills(text);

  if (process.env["OPENAI_API_KEY"]) {
    try {
      const ai = await aiSkills(text);
      engine = "AI_MODEL";
      method = `AI scan with OpenAI ${ai.model}, restricted to the ${data.skills.length}-skill taxonomy. Each skill must quote evidence found word-for-word in your CV.`;
      note = `${ai.dropped ? `${ai.dropped} AI suggestion(s) were dropped because their evidence was not found in the CV. ` : ""}AI can still misjudge — review every skill and proficiency before matching. Your CV text was sent to OpenAI for this scan and is not stored by this app.`;
      skills = ai.skills;
    } catch (err) {
      log.warn({ err: String(err) }, "AI CV scan failed; using rule-based scanner");
      note = `The AI scan was unavailable (${String(err).slice(0, 80)}), so the rule-based scanner was used. ${EXTRACTION_NOTE}`;
    }
  }

  return {
    engine,
    method,
    note,
    personName: detectPersonName(text),
    fileName: input.fileName,
    pageCount: input.pageCount,
    characterCount: text.length,
    textPreview: clip(text, 600),
    skills: skills.sort((a, b) => b.proficiency - a.proficiency || a.name.localeCompare(b.name)),
    suggestedEducation: edu.level,
    educationEvidence: edu.evidence,
    suggestedYearsExperience: exp.years,
    experienceEvidence: exp.evidence,
    suggestedSectors: suggestSectors(skills.map((s) => s.skillId)),
  };
}
