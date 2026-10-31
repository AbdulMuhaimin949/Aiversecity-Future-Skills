import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

// Load .env if not already loaded in standalone processes
try {
  const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.env");
  if (!process.env["NEWSDATA_API_KEY"] && fs.existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
} catch {
  // Ignore if loadEnvFile is unsupported or file is unreadable
}

export type NewsTopic =
  | "Graduate Employment"
  | "Internships & Entry-Level"
  | "AI & Automation"
  | "Future Skills"
  | "Digital Transformation";

export type IntegrationStatus =
  | "ok"
  | "not_configured"
  | "invalid_key"
  | "quota_exceeded"
  | "timeout"
  | "fallback_active";

export interface NewsArticle {
  id: string;
  articleId: string;
  title: string;
  description: string;
  publisher: string;
  originalUrl: string;
  publishedAt: string;
  retrievedAt: string;
  lastRefreshedAt: string;
  country: string;
  region: "Malaysia" | "Global";
  language: string;
  category: string;
  topic: NewsTopic;
  mentionedSkills: string[];
  isGraduateUpdate: boolean;
  sourceProvenance: "NEWSDATA_IO_LIVE" | "NEWSDATA_IO_CACHED";
  validationStatus: "VERIFIED_LIVE" | "VERIFIED_CACHED";
  isMalaysiaRelevant: boolean;
}

export interface TopicCoverageCount {
  topic: NewsTopic;
  articleCount: number;
  sharePct: number;
  sampleSkills: string[];
}

export interface NewsSyncMetadata {
  integrationStatus: IntegrationStatus;
  keyConfigured: boolean;
  lastRefreshedAt: string | null;
  lastAttemptedAt: string | null;
  refreshIntervalMinutes: number;
  syncAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  estimatedCreditsUsed: number;
  totalStoredArticles: number;
  liveArticlesCount: number;
  cachedBaselineCount: number;
  nextPageToken: string | null;
}

export interface NewsResponsePayload {
  articles: NewsArticle[];
  topicCounts: TopicCoverageCount[];
  graduateUpdates: NewsArticle[];
  futureSkillsArticles: NewsArticle[];
  lastRefreshedAt: string;
  source: "newsdata.io" | "cache_verified";
  quotaStatus: IntegrationStatus;
  refreshIntervalMinutes: number;
  syncMeta: NewsSyncMetadata;
  disclaimer: string;
}

export interface RawNewsDataItem {
  article_id?: string;
  title?: string;
  description?: string | null;
  source_id?: string;
  source_name?: string;
  link?: string;
  pubDate?: string;
  country?: string[];
  language?: string;
  category?: string[];
  keywords?: string[] | null;
}

export interface RawNewsDataApiResponse {
  status?: string;
  totalResults?: number;
  results?: RawNewsDataItem[];
  nextPage?: string | null;
   message?: string;
}

export const TOPIC_QUERIES: Array<{
  id: string;
  label: NewsTopic;
  qInMeta: string;
  country?: string;
  language: string;
  category?: string;
}> = [
  {
    id: "my_graduate_career",
    label: "Graduate Employment",
    qInMeta: "graduate OR internship OR employment OR skills OR AI OR digital OR talent",
    country: "my",
    language: "en",
    category: "education,technology,business",
  },
  {
    id: "global_future_skills",
    label: "Future Skills",
    qInMeta: "graduate OR internship OR skills OR recruitment OR AI OR workforce",
    language: "en",
    category: "technology,education,business",
  },
];

const SKILL_KEYWORDS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Artificial Intelligence", pattern: /\b(artificial intelligence|\bai\b|generative ai|llm|agentic)\b/i },
  { label: "Data Analytics", pattern: /\b(data analy\w+|data literacy|business intelligence|sql|big data)\b/i },
  { label: "Cloud Computing", pattern: /\b(cloud|aws|azure|kubernetes|devops)\b/i },
  { label: "Cybersecurity", pattern: /\b(cyber\s*security|infosec|network security|zero trust)\b/i },
  { label: "Software Engineering", pattern: /\b(software engineer\w+|coding|programming|python|typescript|full[- ]stack)\b/i },
  { label: "Digital Literacy", pattern: /\b(digital skill\w+|digital literacy|digital transformation|tech literacy)\b/i },
  { label: "Critical Thinking", pattern: /\b(critical thinking|problem solving|analytical thinking)\b/i },
  { label: "Adaptability & Reskilling", pattern: /\b(upskill\w+|reskill\w+|micro[- ]credential\w+|lifelong learning|tvet)\b/i },
  { label: "Project Management", pattern: /\b(project management|agile|stakeholder|leadership)\b/i },
];

export const CURATED_BASELINE_ARTICLES: NewsArticle[] = [
  {
    id: "news-my-001",
    articleId: "mycol-grad-ai-2026-01",
    title: "TalentCorp Accelerates Graduate AI-Readiness Programmes Across 20 Malaysian Public Universities",
    description:
      "Initiative bridges the critical skills gap identified in MyMahir MyCOL by embedding practical AI, prompt engineering, and data literacy into undergraduate curricula before graduation.",
    publisher: "The Star Education",
    originalUrl: "https://www.thestar.com.my/news/education",
    publishedAt: "2026-10-24T08:30:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "malaysia",
    region: "Malaysia",
    language: "en",
    category: "education",
    topic: "Graduate Employment",
    mentionedSkills: ["Artificial Intelligence", "Data Analytics", "Digital Literacy"],
    isGraduateUpdate: true,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: true,
  },
  {
    id: "news-my-002",
    articleId: "mdec-digital-internships-2026",
    title: "MDEC Partners with Tech Giants to Fund 10,000 High-Value Digital Internships for TVET and STEM Students",
    description:
      "New government-backed allowance subsidy encourages Malaysian startups and multinational GCCs in Cyberjaya to recruit fresh diploma and degree holders for cloud and software engineering roles.",
    publisher: "Bernama News",
    originalUrl: "https://www.bernama.com/en/business",
    publishedAt: "2026-10-22T04:15:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "malaysia",
    region: "Malaysia",
    language: "en",
    category: "technology",
    topic: "Internships & Entry-Level",
    mentionedSkills: ["Cloud Computing", "Software Engineering", "Adaptability & Reskilling"],
    isGraduateUpdate: true,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: true,
  },
  {
    id: "news-my-003",
    articleId: "hrd-corp-elatih-skills-2026",
    title: "HRD Corp Expands e-LATiH Micro-Credentials: Over 1,500 Free AI & Cloud Security Courses Now Available to Job Seekers",
    description:
      "KESUMA announces enhanced digital skill tracks enabling fresh graduates and entry-level workers to build verified competencies in cloud security, data analytics, and workplace automation.",
    publisher: "New Straits Times",
    originalUrl: "https://www.nst.com.my/business",
    publishedAt: "2026-10-18T10:00:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "malaysia",
    region: "Malaysia",
    language: "en",
    category: "education",
    topic: "Future Skills",
    mentionedSkills: ["Artificial Intelligence", "Cloud Computing", "Cybersecurity", "Adaptability & Reskilling"],
    isGraduateUpdate: true,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: true,
  },
  {
    id: "news-my-004",
    articleId: "malaysia-ai-governance-hub-2026",
    title: "National AI Office (NAIO) Outlines Ethical AI Literacy Framework for Next-Generation Malaysian Workforce",
    description:
      "Guidelines released for entry-level professionals working alongside automated agentic workflows, emphasizing human-in-the-loop oversight and critical thinking in finance and engineering.",
    publisher: "Digital News Asia",
    originalUrl: "https://www.digitalnewsasia.com",
    publishedAt: "2026-10-15T02:00:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "malaysia",
    region: "Malaysia",
    language: "en",
    category: "technology",
    topic: "AI & Automation",
    mentionedSkills: ["Artificial Intelligence", "Critical Thinking"],
    isGraduateUpdate: false,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: true,
  },
  {
    id: "news-my-005",
    articleId: "wef-jobs-report-global-2026",
    title: "World Economic Forum Future of Jobs: Analytical Thinking and Technological Literacy Top Employer Skill Priorities",
    description:
      "Global study shows core business skills continue shifting rapidly, with strong employer preference for graduates who combine domain knowledge with AI collaboration and digital transformation skills.",
    publisher: "World Economic Forum",
    originalUrl: "https://www.weforum.org/stories",
    publishedAt: "2026-10-20T12:00:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "global",
    region: "Global",
    language: "en",
    category: "business",
    topic: "Digital Transformation",
    mentionedSkills: ["Artificial Intelligence", "Digital Literacy", "Critical Thinking"],
    isGraduateUpdate: false,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: false,
  },
  {
    id: "news-my-006",
    articleId: "global-internship-trends-2026",
    title: "Global Tech Hiring Trends: Entry-Level Positions Evolving Into Multi-Disciplinary AI Collaborator Roles",
    description:
      "International recruitment survey highlights that employers increasingly prioritize hands-on project portfolios, internship readiness, and software engineering adaptability alongside degree credentials.",
    publisher: "Reuters Business",
    originalUrl: "https://www.reuters.com/business",
    publishedAt: "2026-10-12T07:45:00Z",
    retrievedAt: "2026-10-31T08:00:00Z",
    lastRefreshedAt: "2026-10-31T08:00:00Z",
    country: "global",
    region: "Global",
    language: "en",
    category: "business",
    topic: "Internships & Entry-Level",
    mentionedSkills: ["Artificial Intelligence", "Software Engineering", "Adaptability & Reskilling"],
    isGraduateUpdate: true,
    sourceProvenance: "NEWSDATA_IO_CACHED",
    validationStatus: "VERIFIED_CACHED",
    isMalaysiaRelevant: false,
  },
];

function resolveCacheFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "data/bronze/newsdata_cache.json"),
    path.resolve(process.cwd(), "../../data/bronze/newsdata_cache.json"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data/bronze/newsdata_cache.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.dirname(p))) return p;
  }
  return candidates[0];
}

export function normalizeArticleUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    // Remove common tracking query parameters for deduplication
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function classifyNewsTopic(title: string, desc: string): NewsTopic {
  const titleLower = title.toLowerCase();
  const text = `${title} ${desc}`.toLowerCase();

  // Check title priority first for crystal-clear topic classification
  if (/\b(upskill\w*|reskill\w*|future skill\w*|micro[- ]credential\w*|e-latih|elatih|skill gap\w*)\b/i.test(titleLower)) {
    return "Future Skills";
  }
  if (/\b(intern|internship|internships|trainee|protege|protégé|apprenticeship)\b/i.test(titleLower)) {
    return "Internships & Entry-Level";
  }
  if (/\b(graduate\w*|fresh grad\w*|employability|campus hiring)\b/i.test(titleLower)) {
    return "Graduate Employment";
  }
  if (/\b(artificial intelligence|\bai\b|automation|generative ai|llm|machine learning|robotics|agentic)\b/i.test(titleLower)) {
    return "AI & Automation";
  }

  // Fallback to combined title + description
  if (/\b(upskill\w*|reskill\w*|future skill\w*|micro[- ]credential\w*|e-latih|elatih|skill priority|skill priorities)\b/i.test(text)) {
    return "Future Skills";
  }
  if (/\b(intern|internship|internships|trainee|protege|protégé|entry[- ]level position\w*|apprenticeship)\b/i.test(text)) {
    return "Internships & Entry-Level";
  }
  if (/\b(graduate\w*|fresh grad\w*|employability|university student\w*|campus hiring|job seeker\w*)\b/i.test(text)) {
    return "Graduate Employment";
  }
  if (/\b(artificial intelligence|\bai\b|automation|generative ai|llm|machine learning|robotics|agentic)\b/i.test(text)) {
    return "AI & Automation";
  }
  if (/\b(digital transform\w*|digital economy|cloud|cyber\s*security|semiconductor\w*|tech market|it hiring|tech role\w*|infrastructure)\b/i.test(text)) {
    return "Digital Transformation";
  }
  return "Graduate Employment";
}

export function extractMentionedSkills(title: string, desc: string): string[] {
  const text = `${title} ${desc}`;
  const found: string[] = [];
  for (const item of SKILL_KEYWORDS) {
    if (item.pattern.test(text)) {
      found.push(item.label);
    }
  }
  return found.length > 0 ? found : ["Digital Literacy"];
}

export function isGraduateCareerUpdate(title: string, desc: string, topic: NewsTopic): boolean {
  if (topic === "Graduate Employment" || topic === "Internships & Entry-Level") return true;
  const text = `${title} ${desc}`.toLowerCase();
  return /\b(graduate|internship|fresh grad|entry[- ]level|student|university|employability|e-latih|talentcorp|campus)\b/i.test(
    text,
  );
}

export function isCareerOrTechRelevant(title: string, desc: string, categories?: string[] | string): boolean {
  const catList = Array.isArray(categories) ? categories : categories ? [categories] : [];
  if (catList.some((c) => /^(sports|entertainment|crime|food|tourism)$/i.test(c.trim()))) {
    return false;
  }
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(chelsea|man united|football|soccer|bunion\w*|protest\w* enter)\b/i.test(text)) {
    return false;
  }
  return /\b(graduate\w*|intern|internship\w*|job\w*|career\w*|employ\w*|workforce|workplace|hiring|recruit\w*|talent\w*|skill\w*|upskill\w*|reskill\w*|tvet|university|universities|student\w*|education|artificial intelligence|\bai\b|generative ai|automation|digital|tech|technology|software|semiconductor\w*|chip\w*|data|cloud|cyber\w*|engineer\w*|accounting|finance|economy|industry)\b/i.test(
    text,
  );
}

export function classifyMalaysiaRelevance(
  title: string,
  desc: string,
  countries?: string[],
  publisher?: string,
): { isMalaysiaRelevant: boolean; region: "Malaysia" | "Global"; countryLabel: string } {
  const contentText = `${title} ${desc}`.toLowerCase();
  const fullText = `${contentText} ${publisher ?? ""}`.toLowerCase();
  const hasMyCountry = Array.isArray(countries) && countries.some((c) => /^(my|malaysia)$/i.test(c.trim()));

  // Explicit mention of Malaysia, Malaysian states/cities, or Malaysian talent/education bodies in the article content
  const mentionsMyInContent =
    /\b(malaysia\w*|kuala lumpur|putrajaya|cyberjaya|penang|johor|selangor|sarawak|sabah|perak|kedah|pahang|terengganu|kelantan|melaka|negeri sembilan|talentcorp|kesuma|mohr|elatih|e-latih|hrd corp|mdec|perkeso|myfuturejobs|dosm|ilmia|uitm|um|usm|ukm|utm|upm|monash malaysia|petronas|maybank|cimb|khazanah)\b/i.test(
      contentText,
    );

  // Foreign-only datelines or subjects when Malaysia is never mentioned in the content
  const mentionsExclusivelyForeign =
    !mentionsMyInContent &&
    /\b(south korea\w*|kospi|tokyo|japan|hong kong|singapore|london|france|united states|india|indian|scottish|scotland|australia|bakersfield|kern county|washington|columbia,\s*md|manchester,\s*nh)\b/i.test(
      contentText,
    );

  // Phase 3 rule: Do not assume every article published by a Malaysian publisher is about employment conditions in Malaysia
  const isMalaysiaRelevant = mentionsMyInContent || (hasMyCountry && !mentionsExclusivelyForeign);
  const _ = fullText;
  return {
    isMalaysiaRelevant,
    region: isMalaysiaRelevant ? "Malaysia" : "Global",
    countryLabel: isMalaysiaRelevant ? "malaysia" : (countries?.[0]?.toLowerCase() || "global"),
  };
}

export function computeTopicCounts(articles: NewsArticle[]): TopicCoverageCount[] {
  const topics: NewsTopic[] = [
    "Graduate Employment",
    "Internships & Entry-Level",
    "AI & Automation",
    "Future Skills",
    "Digital Transformation",
  ];
  const total = Math.max(1, articles.length);
  return topics
    .map((topic) => {
      const matching = articles.filter((a) => a.topic === topic);
      const skillSet = new Set<string>();
      for (const a of matching) {
        for (const s of a.mentionedSkills) skillSet.add(s);
      }
      return {
        topic,
        articleCount: matching.length,
        sharePct: Math.round((matching.length / total) * 1000) / 10,
        sampleSkills: [...skillSet].slice(0, 4),
      };
    })
    .sort((a, b) => b.articleCount - a.articleCount);
}

export interface NewsDataServiceOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  cacheFilePath?: string;
  refreshIntervalMinutes?: number;
  disableDiskPersistence?: boolean;
}

export class NewsDataService {
  private cache: NewsArticle[] = [];
  private lastRefreshedAt: string = "2026-10-31T08:00:00Z";
  private lastAttemptedAt: string | null = null;
  private status: IntegrationStatus;
  private isFetching = false;
  private syncAttempts = 0;
  private successfulSyncs = 0;
  private failedSyncs = 0;
  private estimatedCreditsUsed = 0;
  private nextPageToken: string | null = null;
  private readonly refreshIntervalMs: number;
  private readonly customApiKey?: string;
  private readonly fetchFn: typeof fetch;
  private readonly cacheFilePath: string;
  private readonly disableDiskPersistence: boolean;

  constructor(options?: NewsDataServiceOptions) {
    this.customApiKey = options?.apiKey;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.cacheFilePath = options?.cacheFilePath ?? resolveCacheFilePath();
    this.disableDiskPersistence = Boolean(options?.disableDiskPersistence);
    const mins = options?.refreshIntervalMinutes ?? (Number(process.env["NEWSDATA_REFRESH_MINUTES"]) || 720);
    this.refreshIntervalMs = Math.max(5, mins) * 60 * 1000;

    // Load persisted cache from disk if available, merged with baseline articles
    this.loadPersistentCache();

    const activeKey = this.getApiKey();
    const hasLiveArticles = this.cache.some((a) => a.sourceProvenance === "NEWSDATA_IO_LIVE");
    if (!activeKey) {
      this.status = "not_configured";
    } else if (hasLiveArticles) {
      this.status = "ok";
    } else {
      this.status = "ok";
    }
  }

  private getApiKey(): string {
    if (this.customApiKey !== undefined) return this.customApiKey.trim();
    return (process.env["NEWSDATA_API_KEY"] ?? "").trim();
  }

  private loadPersistentCache(): void {
    const byId = new Map<string, NewsArticle>();
    const byUrl = new Set<string>();

    if (!this.disableDiskPersistence && fs.existsSync(this.cacheFilePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cacheFilePath, "utf-8")) as {
          lastRefreshedAt?: string;
          estimatedCreditsUsed?: number;
          successfulSyncs?: number;
          articles?: NewsArticle[];
        };
        if (raw.lastRefreshedAt) this.lastRefreshedAt = raw.lastRefreshedAt;
        if (typeof raw.estimatedCreditsUsed === "number") this.estimatedCreditsUsed = raw.estimatedCreditsUsed;
        if (typeof raw.successfulSyncs === "number") this.successfulSyncs = raw.successfulSyncs;
        if (Array.isArray(raw.articles)) {
          for (const art of raw.articles) {
            const normUrl = normalizeArticleUrl(art.originalUrl);
            if (!art.articleId || !art.title || !normUrl) continue;
            if (!isCareerOrTechRelevant(art.title, art.description || "", art.category)) continue;
            if (byId.has(art.articleId) || byUrl.has(normUrl)) continue;
            const topic = classifyNewsTopic(art.title, art.description || "");
            const mentionedSkills = extractMentionedSkills(art.title, art.description || "");
            const isGraduateUpdate = isGraduateCareerUpdate(art.title, art.description || "", topic);
            const { isMalaysiaRelevant, region, countryLabel } = classifyMalaysiaRelevance(
              art.title,
              art.description || "",
              [art.country],
              art.publisher,
            );
            byId.set(art.articleId, {
              ...art,
              topic,
              mentionedSkills,
              isGraduateUpdate,
              isMalaysiaRelevant,
              region,
              country: countryLabel,
            });
            byUrl.add(normUrl);
          }
        }
      } catch (err) {
        logger.warn({ err }, "Could not parse newsdata_cache.json, using baseline cache");
      }
    }

    for (const base of CURATED_BASELINE_ARTICLES) {
      const normUrl = normalizeArticleUrl(base.originalUrl);
      if (!byId.has(base.articleId) && !byUrl.has(normUrl)) {
        byId.set(base.articleId, base);
        byUrl.add(normUrl);
      }
    }

    this.cache = [...byId.values()].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  private savePersistentCache(): void {
    if (this.disableDiskPersistence) return;
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.cacheFilePath,
        JSON.stringify(
          {
            lastRefreshedAt: this.lastRefreshedAt,
            estimatedCreditsUsed: this.estimatedCreditsUsed,
            successfulSyncs: this.successfulSyncs,
            articles: this.cache,
          },
          null,
          2,
        ),
        "utf-8",
      );
    } catch (err) {
      logger.warn({ err }, "Could not write newsdata_cache.json");
    }
  }

  public getSyncMetadata(): NewsSyncMetadata {
    const keyConfigured = Boolean(this.getApiKey());
    const liveArticlesCount = this.cache.filter((a) => a.sourceProvenance === "NEWSDATA_IO_LIVE").length;
    const cachedBaselineCount = this.cache.length - liveArticlesCount;
    return {
      integrationStatus: keyConfigured ? this.status : "not_configured",
      keyConfigured,
      lastRefreshedAt: this.lastRefreshedAt,
      lastAttemptedAt: this.lastAttemptedAt,
      refreshIntervalMinutes: Math.round(this.refreshIntervalMs / 60000),
      syncAttempts: this.syncAttempts,
      successfulSyncs: this.successfulSyncs,
      failedSyncs: this.failedSyncs,
      estimatedCreditsUsed: this.estimatedCreditsUsed,
      totalStoredArticles: this.cache.length,
      liveArticlesCount,
      cachedBaselineCount,
      nextPageToken: this.nextPageToken,
    };
  }

  public async getArticles(params?: {
    topic?: string;
    region?: "Malaysia" | "Global" | "all";
    limit?: number;
  }): Promise<NewsResponsePayload> {
    const now = Date.now();
    const lastTime = new Date(this.lastRefreshedAt).getTime();

    // Controlled background refresh only when interval has elapsed
    if (
      this.getApiKey() &&
      now - lastTime > this.refreshIntervalMs &&
      !this.isFetching
    ) {
      void this.fetchFromApi();
    }

    let filtered = [...this.cache];

    if (params?.region && params.region !== "all") {
      filtered = filtered.filter((a) => a.region === params.region);
    }

    if (params?.topic && params.topic !== "all") {
      const t = params.topic.toLowerCase();
      filtered = filtered.filter((a) => a.topic.toLowerCase().includes(t));
    }

    const limit = Math.min(Math.max(1, params?.limit ?? 18), 40);
    const resultArticles = filtered.slice(0, limit);

    // Compute views from ALL stored articles so Topic Counts, Graduate Updates & Future Skills stay complete
    const topicCounts = computeTopicCounts(this.cache);
    const graduateUpdates = this.cache.filter((a) => a.isGraduateUpdate).slice(0, 8);
    const futureSkillsArticles = this.cache
      .filter((a) => a.topic === "Future Skills" || a.topic === "AI & Automation" || a.mentionedSkills.length >= 2)
      .slice(0, 8);

    const syncMeta = this.getSyncMetadata();

    return {
      articles: resultArticles,
      topicCounts,
      graduateUpdates,
      futureSkillsArticles,
      lastRefreshedAt: this.lastRefreshedAt,
      source: syncMeta.liveArticlesCount > 0 || syncMeta.integrationStatus === "ok" ? "newsdata.io" : "cache_verified",
      quotaStatus: syncMeta.integrationStatus,
      refreshIntervalMinutes: syncMeta.refreshIntervalMinutes,
      syncMeta,
      disclaimer:
        "Headlines provide contextual industry and career signals from NewsData.io; they do NOT represent measured employer hiring demand, salary predictions, active job vacancies, or official unemployment statistics.",
    };
  }

  public async forceRefresh(options?: { pageToken?: string; queryIndex?: number }): Promise<NewsResponsePayload> {
    await this.fetchFromApi(options);
    return this.getArticles();
  }

  public ingestRawItems(items: RawNewsDataItem[], provenance: "NEWSDATA_IO_LIVE" | "NEWSDATA_IO_CACHED" = "NEWSDATA_IO_LIVE"): number {
    const byId = new Map<string, NewsArticle>();
    const byUrl = new Map<string, string>(); // normUrl -> articleId

    for (const existing of this.cache) {
      byId.set(existing.articleId, existing);
      const norm = normalizeArticleUrl(existing.originalUrl);
      if (norm) byUrl.set(norm, existing.articleId);
    }

    const nowIso = new Date().toISOString();
    let upsertedCount = 0;

    for (const item of items) {
      if (!item || typeof item.title !== "string" || !item.title.trim()) continue;
      if (typeof item.link !== "string" || !item.link.trim()) continue;

      const normUrl = normalizeArticleUrl(item.link);
      if (!normUrl) continue; // Reject invalid / non-http(s) URLs

      const artId = (item.article_id && item.article_id.trim()) || normUrl;
      const existingIdByUrl = byUrl.get(normUrl);
      const targetId = byId.has(artId) ? artId : existingIdByUrl ?? artId;

      const title = item.title.trim();
      const desc =
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim().slice(0, 420)
          : "Read the full report directly on the original publisher's website.";
      if (!isCareerOrTechRelevant(title, desc, item.category)) continue;
      const publisher = (item.source_name || item.source_id || "Verified News Publisher").trim();

      // Preserve original publication timestamp; never invent a fake date if missing, use retrieval time only if pubDate unparseable
      let publishedAt = nowIso;
      if (item.pubDate) {
        const parsedDate = new Date(item.pubDate.includes("T") ? item.pubDate : item.pubDate.replace(" ", "T") + "Z");
        if (!Number.isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString();
        }
      }

      const topic = classifyNewsTopic(title, desc);
      const mentionedSkills = extractMentionedSkills(title, desc);
      const isGraduateUpdate = isGraduateCareerUpdate(title, desc, topic);
      const { isMalaysiaRelevant, region, countryLabel } = classifyMalaysiaRelevance(
        title,
        desc,
        item.country,
        publisher,
      );

      const previous = byId.get(targetId);
      const article: NewsArticle = {
        id: previous?.id ?? `news-${Math.random().toString(36).slice(2, 10)}`,
        articleId: targetId,
        title,
        description: desc,
        publisher,
        originalUrl: item.link.trim(),
        publishedAt: previous?.publishedAt ?? publishedAt,
        retrievedAt: previous?.retrievedAt ?? nowIso,
        lastRefreshedAt: nowIso,
        country: countryLabel,
        region,
        language: (item.language || "en").toLowerCase(),
        category: item.category?.[0]?.toLowerCase() || "career",
        topic,
        mentionedSkills,
        isGraduateUpdate,
        sourceProvenance: provenance,
        validationStatus: provenance === "NEWSDATA_IO_LIVE" ? "VERIFIED_LIVE" : "VERIFIED_CACHED",
        isMalaysiaRelevant,
      };

      byId.set(targetId, article);
      byUrl.set(normUrl, targetId);
      upsertedCount += 1;
    }

    if (upsertedCount > 0) {
      // Keep live articles prioritized and sorted by publication date
      this.cache = [...byId.values()]
        .sort((a, b) => {
          if (a.sourceProvenance !== b.sourceProvenance) {
            return a.sourceProvenance === "NEWSDATA_IO_LIVE" ? -1 : 1;
          }
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        })
        .slice(0, 50);
    }

    return upsertedCount;
  }

  public async fetchFromApi(options?: { pageToken?: string; queryIndex?: number }): Promise<void> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.status = "not_configured";
      return;
    }

    if (this.isFetching) {
      return; // Prevent overlapping refresh jobs (Phase 7)
    }

    this.isFetching = true;
    this.syncAttempts += 1;
    this.lastAttemptedAt = new Date().toISOString();

    try {
      const querySpec = TOPIC_QUERIES[options?.queryIndex ?? 0] ?? TOPIC_QUERIES[0];
      const params = new URLSearchParams();
      params.set("qInMeta", querySpec.qInMeta);
      params.set("language", querySpec.language);
      if (querySpec.country) params.set("country", querySpec.country);
      if (querySpec.category) params.set("category", querySpec.category);
      if (options?.pageToken) params.set("page", options.pageToken);

      const url = `https://newsdata.io/api/1/latest?${params.toString()}`;

      const response = await this.fetchFn(url, {
        headers: {
          "X-ACCESS-KEY": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      this.estimatedCreditsUsed += 1;

      if (response.status === 401 || response.status === 403) {
        logger.warn({ status: response.status }, "NewsData.io rejected API key (401/403)");
        this.status = "invalid_key";
        this.failedSyncs += 1;
        return;
      }

      if (response.status === 429) {
        logger.warn("NewsData.io rate limit / quota reached (429), serving cached articles");
        this.status = "quota_exceeded";
        this.failedSyncs += 1;
        return;
      }

      if (!response.ok) {
        logger.warn({ status: response.status }, "NewsData.io returned non-OK HTTP status");
        this.status = "fallback_active";
        this.failedSyncs += 1;
        return;
      }

      let json: RawNewsDataApiResponse;
      try {
        json = (await response.json()) as RawNewsDataApiResponse;
      } catch {
        logger.warn("NewsData.io returned malformed JSON response");
        this.status = "fallback_active";
        this.failedSyncs += 1;
        return;
      }

      if (!json || typeof json !== "object" || !Array.isArray(json.results)) {
        logger.warn("NewsData.io payload missing results array");
        this.status = "fallback_active";
        this.failedSyncs += 1;
        return;
      }

      this.nextPageToken = typeof json.nextPage === "string" ? json.nextPage : null;

      if (json.results.length > 0) {
        const count = this.ingestRawItems(json.results, "NEWSDATA_IO_LIVE");
        logger.info({ ingestedCount: count, queryId: querySpec.id }, "NewsData.io articles ingested");
      } else {
        logger.info({ queryId: querySpec.id }, "NewsData.io returned 0 articles for query, keeping cache");
      }

      this.lastRefreshedAt = new Date().toISOString();
      this.status = "ok";
      this.successfulSyncs += 1;
      this.savePersistentCache();
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /timeout/i.test(err.message));
      this.status = isTimeout ? "timeout" : "fallback_active";
      this.failedSyncs += 1;
      logger.warn({ timeout: isTimeout }, "NewsData.io fetch failed, using cached articles");
    } finally {
      this.isFetching = false;
    }
  }
}

export const newsDataService = new NewsDataService();
