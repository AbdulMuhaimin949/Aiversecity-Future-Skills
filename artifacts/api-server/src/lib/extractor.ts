import { data } from "./data";

/**
 * Synonym-normalised skill extractor (TypeScript port of the pipeline's
 * Part 3 approach): matches canonical names and synonyms on word boundaries,
 * then estimates proficiency from cue words in the same sentence.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GENERIC_SUFFIX = /\s+(Programming|Development)$/i;

/** Short aliases derived from the canonical name: "SQL & Relational Databases" -> "SQL"; "Python Programming" -> "Python". */
function aliases(name: string): string[] {
  const out: string[] = [];
  const stripped = name.replace(GENERIC_SUFFIX, "");
  if (stripped !== name) out.push(stripped);
  if (!/^(Applied|Enterprise|Advanced|Foundational|Regulatory|Diagnostic|Optimization|Automated)\b/.test(name)) {
    for (const part of name.split(/\s+&\s+/)) {
      if (part !== name && part.length >= 3) out.push(part.replace(GENERIC_SUFFIX, ""));
    }
  }
  return out;
}

const TERMS = data.skills
  .flatMap((s) => [s.name, ...s.synonyms, ...aliases(s.name)].map((term) => ({ term, skillId: s.id })))
  .filter((t) => t.term.length >= 2)
  .sort((a, b) => b.term.length - a.term.length)
  .map((t) => ({
    ...t,
    re: new RegExp(`(^|[^A-Za-z0-9])${escape(t.term)}(?=$|[^A-Za-z0-9])`, "i"),
  }));

const CUES: [RegExp, number][] = [
  [/\b(expert|advanced|lead|led|architect|senior|mastery)\b/i, 4],
  [/\b(proficient|intermediate|experienced|hands-on|built|developed|delivered)\b/i, 3],
  [/\b(basic|beginner|familiar|exposure|introductory|learning|coursework)\b/i, 2],
];

export const EXTRACTION_METHOD = `SYNONYM_NORMALIZED (word-boundary match on ${data.skills.length} canonical skills and their synonyms)`;

const cvMetrics = (data.report["cv_skill_extraction_holdout_metrics"] ?? {}) as Record<string, unknown>;
const fmt = (k: string) => (typeof cvMetrics[k] === "number" ? (cvMetrics[k] as number).toFixed(2) : "n/a");
export const EXTRACTION_NOTE = `Holdout evaluation of this extractor on synthetic CVs: recall ${fmt("recall")}, precision ${fmt("precision")} (F1 ${fmt("f1_score")}). Real CVs are messier, so review the list and remove anything that does not apply to you. Your text is processed in memory and not stored.`;

const clip = (s: string, n = 220) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function extractSkills(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const found = new Map<string, { term: string; proficiency: number; evidence: string }>();
  for (const sentence of sentences) {
    let remaining = sentence;
    for (const t of TERMS) {
      if (!t.re.test(remaining)) continue;
      // Remove the matched span so a shorter synonym cannot re-match it.
      remaining = remaining.replace(t.re, "$1 ");
      const cue = CUES.find(([re]) => re.test(sentence));
      const proficiency = cue ? cue[1] : 3;
      const prev = found.get(t.skillId);
      if (!prev || proficiency > prev.proficiency)
        found.set(t.skillId, { term: t.term, proficiency, evidence: clip(sentence) });
    }
  }
  return [...found.entries()].map(([skillId, v]) => {
    const s = data.skillById.get(skillId)!;
    return {
      skillId,
      name: s.name,
      category: s.category,
      proficiency: v.proficiency,
      matchedTerm: v.term,
      evidence: v.evidence,
    };
  });
}
