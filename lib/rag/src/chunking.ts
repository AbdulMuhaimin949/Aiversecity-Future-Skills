import { createHash } from "node:crypto";

export const CHUNK_MAX_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 200;

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Normalises document text before hashing/chunking (line endings, trailing spaces, blank runs). */
export function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits an over-long paragraph on sentence ends, then hard-wraps as a last resort. */
function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const sentences = paragraph.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) ?? [paragraph];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > max) {
      if (cur) out.push(cur.trim());
      cur = "";
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
      continue;
    }
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/**
 * Paragraph-aware chunking. Paragraphs are packed up to `max` characters;
 * each new chunk repeats the tail of the previous one (whole paragraphs up to
 * `overlap` characters) so facts spanning a boundary stay retrievable.
 * Headings ("# ...") are carried into the next chunk as context.
 */
export function chunkText(
  text: string,
  max = CHUNK_MAX_CHARS,
  overlap = CHUNK_OVERLAP_CHARS,
): string[] {
  const paragraphs = normaliseText(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => splitLong(p, max));

  const chunks: string[] = [];
  let current: string[] = [];
  let heading: string | null = null;
  const len = (ps: string[]) => ps.join("\n\n").length;

  for (const p of paragraphs) {
    if (current.length && len([...current, p]) > max) {
      chunks.push(current.join("\n\n"));
      const carry: string[] = [];
      for (let i = current.length - 1; i >= 0; i--) {
        const cand = [current[i]!, ...carry];
        if (len(cand) > overlap) break;
        carry.unshift(current[i]!);
      }
      current = heading && !carry.includes(heading) ? [heading, ...carry] : carry;
      if (current.length && len([...current, p]) > max) current = [];
    }
    if (/^#{1,6}\s/.test(p)) heading = p;
    current.push(p);
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks.filter((c) => c.trim().length > 0);
}
