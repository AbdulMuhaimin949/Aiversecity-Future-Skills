/**
 * Free, local retrieval over approved knowledge using PostgreSQL full-text
 * search. This is LEXICAL (keyword) retrieval, not vector semantic search, and
 * it calls no external API.
 *
 * The approved knowledge text is English. Bahasa Melayu and Mandarin questions
 * are therefore translated to English search terms with a small reviewed
 * glossary (below) before matching. Questions about a role or phrase that is
 * not in the glossary still match when they contain the English words
 * (for example a role title typed in English inside a Malay or Chinese
 * question). Anything else returns no match rather than a guess.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { RetrievedChunk } from "./retrieval";

export const LEXICAL_RETRIEVAL_METHOD = "postgresql_full_text" as const;

/** Role phrases (any language) → English role title words. */
const ROLE_GLOSSARY: Array<{ keys: string[]; english: string }> = [
  { keys: ["data analyst", "penganalisis data", "juruanalisis data", "数据分析师", "数据分析员", "数据分析"], english: "data analyst" },
  { keys: ["data scientist", "saintis data", "数据科学家"], english: "data scientist" },
  { keys: ["data engineer", "jurutera data", "数据工程师"], english: "data engineer" },
  { keys: ["machine learning engineer", "jurutera pembelajaran mesin", "机器学习工程师", "ml engineer"], english: "machine learning engineer" },
  { keys: ["ai engineer", "ai research", "jurutera ai", "ai工程师", "人工智能工程师"], english: "ai engineer" },
  { keys: ["software developer", "software engineer", "pembangun perisian", "jurutera perisian", "软件开发", "软件工程师"], english: "software developer" },
  { keys: ["frontend developer", "frontend engineer", "pembangun frontend", "前端开发", "前端工程师"], english: "frontend developer" },
  { keys: ["backend developer", "backend engineer", "pembangun backend", "后端开发", "后端工程师"], english: "backend engineer" },
  { keys: ["full stack", "fullstack", "pembangun full stack", "全栈工程师", "全栈开发"], english: "full stack" },
  { keys: ["devops", "cloud engineer", "jurutera awan", "运维工程师", "云端架构师", "云工程师"], english: "devops cloud engineer" },
  { keys: ["web developer", "pembangun web", "网页开发", "网站开发"], english: "web developer" },
  { keys: ["product manager", "pengurus produk", "产品经理"], english: "product manager" },
  { keys: ["ux designer", "ui/ux", "pereka ux", "用户体验设计师"], english: "ux designer" },
  { keys: ["cybersecurity", "keselamatan siber", "网络安全", "安全工程师"], english: "cybersecurity" },
  { keys: ["business intelligence", "bi developer", "perisikan perniagaan", "商业智能"], english: "business intelligence" },
  { keys: ["project manager", "pengurus projek", "项目经理"], english: "project manager" },
];

/** Generic question words & feature aliases → English terms used for matching and ranking. */
const TERM_GLOSSARY: Array<{ keys: string[]; english: string[] }> = [
  // System Guide & Overview
  {
    keys: ["ctrl cv", "sistem", "system", "panduan", "guide", "macam mana", "mcm mana", "camne", "cmne", "how to use", "how it works", "怎么用", "怎样用", "系统功能", "新手指南", "做么", "干嘛", "功能"],
    english: ["guide", "overview", "system", "career"],
  },
  // Profile & CV upload
  {
    keys: ["profile", "profil", "cv", "resume", "muat naik", "upload", "imbas", "scan", "5mb", "pdf", "persona", "kemahiran manual", "pilih kemahiran", "pick skills", "简历", "上传", "档案", "个人档案", "扫描", "隐私"],
    english: ["profile", "cv", "resume", "skills", "upload"],
  },
  // Radar & Trends
  {
    keys: ["radar", "rising", "slowing", "meningkat", "perlahan", "90%", "julat", "trend", "arah", "forecast", "ramalan", "雷达", "上升", "放缓", "趋势", "90%区间", "预测"],
    english: ["radar", "forecast", "demand", "trend", "scenarios"],
  },
  // Matches & Match scoring
  {
    keys: ["match", "matches", "padanan", "padan", "skor", "score", "ranking", "kiraan", "formula", "ai risk", "risiko ai", "job safety", "keselamatan kerja", "ai-resilient", "exposed", "匹配", "职位匹配", "工作推荐", "配对", "分数", "算法", "计算", "ai风险", "工作安全度"],
    english: ["match", "score", "overlap", "readiness", "risk", "safety"],
  },
  // Pathway & Reskilling courses
  {
    keys: ["pathway", "laluan", "pembelajaran", "learning", "kursus", "course", "courses", "e-latih", "hrd corp", "uncovered", "tidak diliputi", "gaps", "jurang", "路线", "技能路线", "学习路线", "培训", "课程", "缺口", "未覆盖"],
    english: ["pathway", "learning", "courses", "gaps", "skills"],
  },
  // Scenarios
  {
    keys: ["low impact", "moderate impact", "high impact", "baseline", "impak rendah", "impak sederhana", "impak tinggi", "garis asas", "低影响", "中度影响", "高影响", "基准", "基线", "情景", "场景"],
    english: ["scenarios", "impact", "baseline", "automation", "disruption"],
  },
  // Sources & Evidence
  {
    keys: ["sources", "sumber", "mycol", "ridge", "autoregression", "sdg", "bukti", "data", "来源", "数据来源", "联合国", "可持续发展"],
    english: ["sources", "mycol", "methodology", "data", "sdgs"],
  },
  // Skills & Learning
  { keys: ["kemahiran", "kemahiran-kemahiran", "skills", "skill", "技能", "技术", "能力"], english: ["skills"] },
  { keys: ["laluan", "belajar", "pembelajaran", "learn", "study", "路径", "学习", "培训"], english: ["pathway", "learning"] },
  { keys: ["peranan", "jawatan", "pekerjaan", "role", "roles", "job", "jobs", "角色", "职位", "岗位", "工作"], english: ["role"] },
  { keys: ["gambaran", "senario", "scenario", "scenarios", "情景", "场景"], english: ["scenario"] },
];

const STOPWORDS = new Set([
  "apakah", "apa", "untuk", "yang", "dan", "atau", "dalam", "adalah", "bagaimana", "boleh", "perlu", "diperlukan",
  "saya", "anda", "dengan", "kepada", "dari", "ini", "itu", "what", "which", "how", "are", "is", "the", "needed",
  "need", "for", "to", "a", "an", "of", "and", "do", "does", "can", "i", "me", "my", "about", "tell",
]);

export type LexicalQuery = {
  /** tsquery that every result must satisfy (adjacent words) when a known role was detected, else null. */
  phraseQuery: string | null;
  /** tsquery (OR of all English terms) used for matching and ranking. */
  anyQuery: string | null;
  englishTerms: string[];
};

const wordsOnly = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Builds the PostgreSQL tsquery strings for a question in ms, zh-CN or en. */
export function buildLexicalQuery(question: string): LexicalQuery {
  const text = question.toLowerCase();
  const phrases: string[] = [];
  const terms = new Set<string>();

  for (const role of ROLE_GLOSSARY) {
    if (role.keys.some((k) => text.includes(k))) {
      phrases.push(role.english);
      for (const w of wordsOnly(role.english)) terms.add(w);
    }
  }
  for (const g of TERM_GLOSSARY) {
    if (g.keys.some((k) => text.includes(k))) for (const w of g.english) terms.add(w);
  }
  for (const w of wordsOnly(text)) {
    if (w.length >= 2 && !STOPWORDS.has(w)) terms.add(w);
  }

  const english = [...terms];
  const phraseQuery = phrases.length
    ? phrases.map((p) => `(${wordsOnly(p).join(" <-> ")})`).join(" | ")
    : null;
  return { phraseQuery, anyQuery: english.length ? english.join(" | ") : null, englishTerms: english };
}

type Executor = Pick<typeof db, "execute">;

/**
 * Ranked chunks from approved documents in approved sources only. Pending,
 * rejected and retired documents (and unapproved sources) are filtered in SQL.
 */
export async function retrieveLexical(
  question: string,
  opts: { topK?: number; executor?: Executor } = {},
): Promise<RetrievedChunk[]> {
  const q = buildLexicalQuery(question);
  if (!q.anyQuery) return [];
  const topK = opts.topK ?? 6;
  const exec = opts.executor ?? db;
  const matchQuery = q.phraseQuery ?? q.anyQuery;

  const res = await exec.execute(sql`
    select * from (
      select
        c.id as chunk_id, c.chunk_index, c.content, c.language,
        d.id as document_id, d.title as document_title, d.url as document_url,
        s.name as source_name, coalesce(s.base_url, ds.source_url) as source_url, s.data_source_id,
        v.vec,
        ts_rank_cd(v.vec, to_tsquery('english', ${q.anyQuery})) as any_rank
      from knowledge_chunks c
      join knowledge_documents d on d.id = c.document_id
      join knowledge_sources s on s.id = d.knowledge_source_id
      left join data_sources ds on ds.source_id = s.data_source_id
      cross join lateral (
        select setweight(to_tsvector('english', d.title), 'A') || setweight(to_tsvector('english', c.content), 'B') as vec
      ) v
      where d.approval_status = 'approved' and s.approval_status = 'approved'
    ) r
    where r.vec @@ to_tsquery('english', ${matchQuery})
    order by (r.any_rank
      ${q.phraseQuery ? sql`+ 2 * ts_rank_cd(r.vec, to_tsquery('english', ${q.phraseQuery}))` : sql``}) desc,
      r.document_title, r.chunk_index
    limit ${topK}
  `);

  return res.rows.map((r: Record<string, unknown>) => ({
    chunkId: String(r["chunk_id"]),
    chunkIndex: Number(r["chunk_index"]),
    content: String(r["content"]),
    language: String(r["language"]),
    documentId: String(r["document_id"]),
    documentTitle: String(r["document_title"]),
    documentUrl: (r["document_url"] as string | null) ?? null,
    sourceName: String(r["source_name"]),
    sourceUrl: (r["source_url"] as string | null) ?? null,
    dataSourceId: (r["data_source_id"] as string | null) ?? null,
    score: Number(r["any_rank"]),
  }));
}
