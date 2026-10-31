import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GraduationCap,
  Info,
  LayoutGrid,
  Newspaper,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn, formatDateDDMMYYYY } from "@/lib/utils";

type NewsLang = "en" | "ms" | "zh";
type SubView = "latest" | "topics" | "graduate" | "skills";
type DisplayMode = "marquee" | "grid";

interface NewsArticle {
  id: string;
  articleId: string;
  title: string;
  description: string;
  publisher: string;
  originalUrl: string;
  publishedAt: string;
  retrievedAt: string;
  region: "Malaysia" | "Global";
  topic: string;
  mentionedSkills?: string[];
  isGraduateUpdate?: boolean;
  sourceProvenance?: "NEWSDATA_IO_LIVE" | "NEWSDATA_IO_CACHED";
  isMalaysiaRelevant: boolean;
}

interface TopicCoverageCount {
  topic: string;
  articleCount: number;
  sharePct: number;
  sampleSkills: string[];
}

interface NewsSyncMetadata {
  integrationStatus: string;
  keyConfigured: boolean;
  lastRefreshedAt: string | null;
  refreshIntervalMinutes: number;
  totalStoredArticles: number;
  liveArticlesCount: number;
  cachedBaselineCount: number;
}

interface NewsPayload {
  articles: NewsArticle[];
  topicCounts?: TopicCoverageCount[];
  graduateUpdates?: NewsArticle[];
  futureSkillsArticles?: NewsArticle[];
  lastRefreshedAt: string;
  source: string;
  quotaStatus: string;
  refreshIntervalMinutes: number;
  syncMeta?: NewsSyncMetadata;
  disclaimer: string;
}

const I18N: Record<
  NewsLang,
  {
    kicker: string;
    title: string;
    subtitle: string;
    updated: string;
    refresh: string;
    tabs: Record<SubView, string>;
    filterLabel: string;
    allRegions: string;
    allTopics: string;
    readOriginal: string;
    liveTag: string;
    cachedTag: string;
    emptyState: string;
    errorState: string;
    topicsHeading: string;
    topicsNote: string;
    articlesUnit: string;
    gradHeading: string;
    gradNote: string;
    skillsHeading: string;
    skillsNote: string;
    keywordBadge: string;
    topicLabels: Record<string, string>;
    regionLabels: Record<"Malaysia" | "Global", string>;
    disclaimer: string;
    movingStream: string;
    gridView: string;
    pauseStream: string;
    playStream: string;
    hoverHint: string;
    bottomTickerTitle: string;
    bottomTickerJump: string;
    minimize: string;
    expand: string;
  }
> = {
  en: {
    kicker: "Section C · Powered by NewsData.io",
    title: "Industry News & Career Signals",
    subtitle:
      "Validated Malaysian and global career, graduate employability, internship, and future-skills news.",
    updated: "Last updated",
    refresh: "Refresh",
    tabs: {
      latest: "A. Latest Industry News",
      topics: "B. Trending News Topics",
      graduate: "C. Graduate Career Updates",
      skills: "D. Future Skills News",
    },
    filterLabel: "Filter:",
    allRegions: "All News",
    allTopics: "All Topics",
    readOriginal: "Original article",
    liveTag: "Live API",
    cachedTag: "Verified Cache",
    emptyState: "No stored articles match this filter. Try selecting All News or All Topics.",
    errorState: "Could not load news feed. Cached articles remain available once connectivity restores.",
    topicsHeading: "Topic Coverage Frequency (Stored Articles)",
    topicsNote:
      "Counts reflect news coverage frequency across stored NewsData.io articles — NOT employer hiring demand or job opening volumes.",
    articlesUnit: "articles",
    gradHeading: "Internships, Graduate Programmes & Entry-Level Preparation",
    gradNote:
      "These articles highlight graduate programmes and employability initiatives. They are contextual news updates, not verified active job vacancies.",
    skillsHeading: "Emerging Technical & Transferable Skills in the News",
    skillsNote:
      "Skill tags below are keyword mentions extracted from article titles and summaries — distinguished from verified MASCO/MyCOL employer skill requirements.",
    keywordBadge: "Keyword mention in news (not a verified employer requirement)",
    topicLabels: {
      "Graduate Employment": "Graduate Employment",
      "Internships & Entry-Level": "Internships",
      "AI & Automation": "AI & Automation",
      "Future Skills": "Future Skills",
      "Digital Transformation": "Digital Transformation",
    },
    regionLabels: {
      Malaysia: "Malaysia",
      Global: "Global",
    },
    disclaimer:
      "NewsData.io provides contextual industry news signals (Free plan includes delayed feed data). Article counts do NOT influence CTRL CV role matching scores, job demand forecasts, AI risk ratings, or salary estimates.",
    movingStream: "Moving Ads Stream",
    gridView: "Grid View",
    pauseStream: "Pause",
    playStream: "Resume",
    hoverHint: "Hover card to pause & read",
    bottomTickerTitle: "Live Career Signals",
    bottomTickerJump: "Jump to News",
    minimize: "Minimize",
    expand: "Live Signals Ticker",
  },
  ms: {
    kicker: "Seksyen C · Dikuasakan oleh NewsData.io",
    title: "Berita Industri & Isyarat Kerjaya",
    subtitle:
      "Berita kerjaya, kebolehpasaran graduan, latihan industri, dan kemahiran masa hadapan Malaysia serta global.",
    updated: "Kemas kini terakhir",
    refresh: "Segar semula",
    tabs: {
      latest: "A. Berita Industri Terkini",
      topics: "B. Topik Berita Sohor",
      graduate: "C. Kemas Kini Kerjaya Graduan",
      skills: "D. Berita Kemahiran Masa Depan",
    },
    filterLabel: "Tapis:",
    allRegions: "Semua Berita",
    allTopics: "Semua Topik",
    readOriginal: "Artikel asal",
    liveTag: "API Langsung",
    cachedTag: "Cache Disahkan",
    emptyState: "Tiada artikel tersimpan yang sepadan dengan tapisan ini. Cuba pilih Semua Berita atau Semua Topik.",
    errorState: "Tidak dapat memuatkan suapan berita. Artikel tersimpan akan dipaparkan semula.",
    topicsHeading: "Kekerapan Liputan Topik (Artikel Tersimpan)",
    topicsNote:
      "Kiraan ini menunjukkan kekerapan liputan berita dalam artikel tersimpan NewsData.io — BUKAN permintaan pengambilan majikan atau jumlah jawatan kosong.",
    articlesUnit: "artikel",
    gradHeading: "Latihan Industri, Program Graduan & Persediaan Kerjaya Awal",
    gradNote:
      "Artikel ini mengetengahkan inisiatif kebolehpasaran dan program graduan. Ia adalah maklumat berita kontekstual, bukannya jawatan kosong aktif yang disahkan.",
    skillsHeading: "Kemahiran Teknikal & Boleh Pindah yang Muncul dalam Berita",
    skillsNote:
      "Tag kemahiran di bawah ialah sebutan kata kunci daripada tajuk/ringkasan berita — dibezakan daripada keperluan kemahiran majikan rasmi MASCO/MyCOL.",
    keywordBadge: "Sebutan kata kunci berita (bukan syarat rasmi majikan)",
    topicLabels: {
      "Graduate Employment": "Pekerjaan Graduan",
      "Internships & Entry-Level": "Latihan Industri",
      "AI & Automation": "AI & Automasi",
      "Future Skills": "Kemahiran Masa Depan",
      "Digital Transformation": "Transformasi Digital",
    },
    regionLabels: {
      Malaysia: "Malaysia",
      Global: "Global",
    },
    disclaimer:
      "NewsData.io membekalkan isyarat berita industri kontekstual. Kiraan artikel TIDAK mengubah skor padanan kerjaya CTRL CV, unjuran permintaan kerja, mahupun anggaran gaji.",
    movingStream: "Strim Iklan Bergerak",
    gridView: "Paparan Grid",
    pauseStream: "Jeda",
    playStream: "Sambung",
    hoverHint: "Halakan kursor untuk jeda & baca",
    bottomTickerTitle: "Isyarat Kerjaya Terkini",
    bottomTickerJump: "Ke Bahagian Berita",
    minimize: "Kecilkan",
    expand: "Isyarat Berita Langsung",
  },
  zh: {
    kicker: "C 部分 · 由 NewsData.io 提供支持",
    title: "行业新闻与职业信号",
    subtitle: "聚焦马来西亚与全球的毕业生就业、实习计划、AI自动化及未来技能资讯。",
    updated: "最后更新",
    refresh: "刷新",
    tabs: {
      latest: "A. 最新行业资讯",
      topics: "B. 热门新闻主题",
      graduate: "C. 毕业生职业动态",
      skills: "D. 未来技能资讯",
    },
    filterLabel: "筛选：",
    allRegions: "全部新闻",
    allTopics: "全部主题",
    readOriginal: "阅读原文",
    liveTag: "实时源",
    cachedTag: "已验证缓存",
    emptyState: "没有符合此筛选条件的缓存文章，请尝试选择“全部新闻”或“全部主题”。",
    errorState: "无法加载新闻源，恢复连接后将显示已缓存文章。",
    topicsHeading: "新闻主题报道频次（基于已存储文章）",
    topicsNote:
      "以下数据仅代表 NewsData.io 已存储文章的新闻报道频次，绝不代表雇主招聘需求或实际岗位空缺数量。",
    articlesUnit: "篇文章",
    gradHeading: "实习机会、毕业生计划与初入职场准备",
    gradNote: "以下文章聚焦毕业生培训与就业扶植计划，仅供行业背景参考，并非经核实的实时招聘职位空缺。",
    skillsHeading: "新闻中提及的新兴技术与可迁移技能",
    skillsNote:
      "下方技能标签系从新闻标题与摘要中提取的关键词提及，请与 MASCO/MyCOL 官方核实的雇主技能要求区分。",
    keywordBadge: "新闻关键词提及（非雇主硬性要求）",
    topicLabels: {
      "Graduate Employment": "毕业生就业",
      "Internships & Entry-Level": "实习与初级岗位",
      "AI & Automation": "AI 与自动化",
      "Future Skills": "未来技能",
      "Digital Transformation": "数字化转型",
    },
    regionLabels: {
      Malaysia: "马来西亚",
      Global: "全球资讯",
    },
    disclaimer:
      "NewsData.io 仅提供行业背景新闻信号（免费版包含延时数据）。新闻数量不会影响 CTRL CV 的职位匹配度评分、需求预测或薪资估算。",
    movingStream: "动态流播",
    gridView: "网格视图",
    pauseStream: "暂停",
    playStream: "播放",
    hoverHint: "鼠标悬停卡片暂停阅读",
    bottomTickerTitle: "实时职业动态流",
    bottomTickerJump: "跳转至新闻区",
    minimize: "收起",
    expand: "展开实时动态",
  },
};

export function LatestIndustryNewsSection() {
  const [lang, setLang] = useState<NewsLang>("en");
  const [subView, setSubView] = useState<SubView>("latest");
  const [selectedRegion, setSelectedRegion] = useState<"all" | "Malaysia" | "Global">("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("marquee");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isTickerCollapsed, setIsTickerCollapsed] = useState<boolean>(false);

  const t = I18N[lang];

  const { data, isLoading, isError, refetch, isFetching } = useQuery<NewsPayload>({
    queryKey: ["latest-industry-news", selectedRegion, selectedTopic],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRegion !== "all") params.set("region", selectedRegion);
      if (selectedTopic !== "all") params.set("topic", selectedTopic);
      params.set("limit", "18");
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load industry news");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const topics = [
    "all",
    "AI & Automation",
    "Graduate Employment",
    "Internships & Entry-Level",
    "Future Skills",
    "Digital Transformation",
  ];

  const viewTabs: Array<{ id: SubView; Icon: typeof Newspaper }> = [
    { id: "latest", Icon: Newspaper },
    { id: "topics", Icon: BarChart3 },
    { id: "graduate", Icon: GraduationCap },
    { id: "skills", Icon: Sparkles },
  ];

  const filteredArticles = data?.articles ?? [];
  const repeatFactor = filteredArticles.length < 4 ? 4 : 2;
  const marqueeArticles = Array.from({ length: repeatFactor }).flatMap(() => filteredArticles);

  const renderArticleCard = (
    art: NewsArticle,
    showSkillsHighlight = false,
    isMarquee = false,
    customKey?: string,
  ) => {
    const isLive = art.sourceProvenance === "NEWSDATA_IO_LIVE";
    return (
      <article
        key={customKey ?? art.articleId}
        className={cn(
          "flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md",
          isMarquee ? "w-[320px] sm:w-[380px] shrink-0 h-[240px] select-text" : "h-full",
        )}
        data-testid={`card-news-${art.articleId}`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "font-data rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                  art.region === "Malaysia"
                    ? "bg-royal/15 text-royal"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                {t.regionLabels[art.region] ?? art.region}
              </span>
              <span className="font-data rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {t.topicLabels[art.topic] ?? art.topic}
              </span>
              <span
                className={cn(
                  "font-data rounded px-1.5 py-0.5 text-[9px] font-medium",
                  isLive
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isLive ? t.liveTag : t.cachedTag}
              </span>
            </div>
            <span className="font-data text-[10px] text-muted-foreground">
              {formatDateDDMMYYYY(art.publishedAt)}
            </span>
          </div>

          <h3 className="font-display line-clamp-2 text-sm font-bold leading-snug">
            <a
              href={art.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {art.title}
            </a>
          </h3>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {art.description}
          </p>

          {showSkillsHighlight && art.mentionedSkills && art.mentionedSkills.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex flex-wrap gap-1">
                {art.mentionedSkills.map((sk) => (
                  <span
                    key={sk}
                    className="font-data rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary"
                  >
                    {sk}
                  </span>
                ))}
              </div>
              <div className="text-[10px] italic text-muted-foreground">{t.keywordBadge}</div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[11px]">
          <span className="max-w-[160px] truncate font-semibold text-foreground/80">
            {art.publisher}
          </span>
          <a
            href={art.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            data-testid={`link-news-${art.articleId}`}
          >
            {t.readOriginal} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </article>
    );
  };

  return (
    <section id="section-career-news" className="space-y-4" data-testid="section-latest-industry-news">
      {/* Header with Multilingual Switcher & Refresh */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="h-4 w-4" />
            </span>
            <span className="font-data text-xs font-bold uppercase tracking-wider text-primary">
              {t.kicker}
            </span>
          </div>
          <h2 className="font-display mt-1 text-2xl font-bold">{t.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* Language Switcher (EN / BM / 中文) */}
          <div
            className="inline-flex rounded-lg border bg-card p-0.5 text-[11px] font-bold"
            role="group"
            aria-label="News section language"
            data-testid="group-news-lang"
          >
            {(
              [
                { code: "en", label: "EN" },
                { code: "ms", label: "BM" },
                { code: "zh", label: "中文" },
              ] as const
            ).map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  lang === l.code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`button-news-lang-${l.code}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {data?.lastRefreshedAt && (
            <span className="font-data text-[11px] text-muted-foreground" data-testid="text-news-refreshed">
              {t.updated}: {formatDateDDMMYYYY(data.lastRefreshedAt)}
            </span>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-95 disabled:opacity-50"
            data-testid="button-refresh-news"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            <span>{t.refresh}</span>
          </button>
        </div>
      </div>

      {/* Phase 8: 4 Career News Intelligence Sub-View Tabs */}
      <div
        className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-1.5"
        role="tablist"
        aria-label="Industry News Views"
        data-testid="tabs-news-intelligence"
      >
        {viewTabs.map(({ id, Icon }) => {
          const active = subView === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubView(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                active
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`tab-news-${id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.tabs[id]}</span>
            </button>
          );
        })}
      </div>

      {/* Loading & Error states */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="skeleton-news">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-card/60 p-4" />
          ))}
        </div>
      )}

      {isError && (
        <div
          className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground"
          data-testid="error-news"
        >
          {t.errorState}
        </div>
      )}

      {/* VIEW A: Latest Industry News */}
      {data && subView === "latest" && (
        <div className="space-y-3" data-testid="view-news-latest">
          {/* Filter Bar with Region, Topic, View Mode Switcher, and Pause/Play */}
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-bold text-muted-foreground">{t.filterLabel}</span>
              
              {/* Region filter pills */}
              <div className="flex flex-wrap gap-1" role="group" aria-label="Region filter">
                {(["all", "Malaysia", "Global"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRegion(r)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-semibold transition",
                      selectedRegion === r
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    data-testid={`button-region-${r.toLowerCase()}`}
                  >
                    {r === "all" ? t.allRegions : t.regionLabels[r]}
                  </button>
                ))}
              </div>

              <div className="hidden h-4 w-px bg-border sm:block" />

              {/* Topic filter pills */}
              <div className="flex flex-wrap gap-1" role="group" aria-label="Topic filter">
                {topics.map((topicKey) => (
                  <button
                    key={topicKey}
                    type="button"
                    onClick={() => setSelectedTopic(topicKey)}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition",
                      selectedTopic === topicKey
                        ? "border border-primary/30 bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    data-testid={`button-topic-${topicKey.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    {topicKey === "all" ? t.allTopics : (t.topicLabels[topicKey] ?? topicKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Switcher & Stream Pause/Play */}
            <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
              {displayMode === "marquee" && (
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                    isPaused
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  title={isPaused ? t.playStream : t.pauseStream}
                  aria-label={isPaused ? t.playStream : t.pauseStream}
                >
                  {isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
                  <span>{isPaused ? t.playStream : t.pauseStream}</span>
                </button>
              )}

              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDisplayMode("marquee")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 transition",
                    displayMode === "marquee"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Radio className="h-3 w-3 animate-pulse text-amber-300" />
                  <span>{t.movingStream}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("grid")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 transition",
                    displayMode === "grid"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="h-3 w-3" />
                  <span>{t.gridView}</span>
                </button>
              </div>
            </div>
          </div>

          {displayMode === "marquee" && (
            <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={cn("absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75", !isPaused && "animate-ping")} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>{t.hoverHint}</span>
              </span>
              <span className="font-data">
                {data.articles.length} {t.articlesUnit}
              </span>
            </div>
          )}

          {data.articles.length === 0 ? (
            <div
              className="rounded-xl border border-dashed bg-card p-8 text-center text-xs text-muted-foreground"
              data-testid="empty-news"
            >
              {t.emptyState}
            </div>
          ) : displayMode === "marquee" ? (
            <div className="relative overflow-hidden rounded-2xl border bg-card/40 p-3 sm:p-4">
              {/* Left and right subtle fade masks */}
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-16 bg-gradient-to-r from-card via-card/70 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-16 bg-gradient-to-l from-card via-card/70 to-transparent" />

              <div
                className={cn(
                  "news-marquee-track flex gap-4 py-1",
                  isPaused && "news-marquee-paused",
                )}
                style={{ animationDuration: `${Math.max(30, marqueeArticles.length * 4.5)}s` }}
              >
                {marqueeArticles.map((art, idx) =>
                  renderArticleCard(art, false, true, `marquee-item-${art.articleId}-${idx}`),
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.articles.slice(0, 9).map((art) => renderArticleCard(art, false))}
            </div>
          )}
        </div>
      )}

      {/* VIEW B: Trending News Topics (Article Coverage Counts) */}
      {data && subView === "topics" && (
        <div className="space-y-3 rounded-2xl border bg-card p-5" data-testid="view-news-topics">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <h3 className="font-display text-base font-bold">{t.topicsHeading}</h3>
            <span className="font-data text-xs text-muted-foreground">
              {data.syncMeta?.totalStoredArticles ?? data.articles.length} {t.articlesUnit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.topicsNote}</p>

          <div className="mt-3 space-y-3">
            {(data.topicCounts ?? []).map((tc) => (
              <div
                key={tc.topic}
                className="rounded-xl border bg-background/60 p-3.5"
                data-testid={`row-topic-count-${tc.topic.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{t.topicLabels[tc.topic] ?? tc.topic}</span>
                  <span className="font-data text-primary">
                    {tc.articleCount} {t.articlesUnit} ({tc.sharePct}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(6, tc.sharePct)}%` }}
                  />
                </div>
                {tc.sampleSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {tc.sampleSkills.map((sk) => (
                      <span
                        key={sk}
                        className="font-data rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW C: Graduate Career Updates */}
      {data && subView === "graduate" && (
        <div className="space-y-3" data-testid="view-news-graduate">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <h3 className="font-display text-sm font-bold text-primary">{t.gradHeading}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.gradNote}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data.graduateUpdates ?? data.articles.filter((a) => a.isGraduateUpdate)).map((art) =>
              renderArticleCard(art, false),
            )}
          </div>
        </div>
      )}

      {/* VIEW D: Future Skills News */}
      {data && subView === "skills" && (
        <div className="space-y-3" data-testid="view-news-skills">
          <div className="rounded-xl border border-royal/25 bg-royal/5 p-3.5">
            <h3 className="font-display text-sm font-bold text-royal">{t.skillsHeading}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.skillsNote}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data.futureSkillsArticles ?? data.articles).map((art) =>
              renderArticleCard(art, true),
            )}
          </div>
        </div>
      )}

      {/* Non-statistical & Quota Disclaimer */}
      <div
        className="flex items-start gap-2 rounded-lg border-l-2 border-primary/40 bg-card p-2.5 text-[11px] text-muted-foreground"
        data-testid="text-news-disclaimer"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{t.disclaimer}</span>
      </div>

      {/* Floating Bottom Website-Ad Style Breaking News Ticker */}
      {data && data.articles.length > 0 && (
        <>
          {isTickerCollapsed ? (
            <button
              type="button"
              onClick={() => setIsTickerCollapsed(false)}
              className="fixed bottom-3 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-card/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-lg backdrop-blur-md transition hover:bg-muted active:scale-95"
              title={t.expand}
              aria-label={t.expand}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>{t.bottomTickerTitle} ({data.articles.length})</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div
              className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 py-2 px-3 shadow-2xl backdrop-blur-md transition-all sm:px-6"
              role="region"
              aria-label="Bottom live career news ticker"
            >
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                {/* Left: Ticker Title & Synchronized Quick Region Filter Pills */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-data text-[11px] font-bold uppercase tracking-wider text-primary hidden sm:inline">
                    {t.bottomTickerTitle}
                  </span>

                  <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-[10px] font-bold">
                    {(["all", "Malaysia", "Global"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRegion(r)}
                        className={cn(
                          "rounded px-2 py-0.5 transition",
                          selectedRegion === r
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r === "all" ? t.allRegions : t.regionLabels[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Center: Moving Headlines Conveyor */}
                <div className="relative min-w-0 flex-1 overflow-hidden">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent" />

                  <div
                    className={cn(
                      "news-ticker-track flex items-center gap-6",
                      isPaused && "news-marquee-paused",
                    )}
                    style={{ animationDuration: `${Math.max(28, marqueeArticles.length * 3.8)}s` }}
                  >
                    {marqueeArticles.map((art, idx) => (
                      <div
                        key={`bottom-ticker-${art.articleId}-${idx}`}
                        className="inline-flex shrink-0 items-center gap-2 text-xs"
                      >
                        <span
                          className={cn(
                            "font-data rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                            art.region === "Malaysia"
                              ? "bg-royal/15 text-royal"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {art.region}
                        </span>
                        <a
                          href={art.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {art.title}
                        </a>
                        <span className="font-data text-[10px] text-muted-foreground">
                          · {art.publisher}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Controls (Pause, Jump, Minimize) */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPaused((prev) => !prev)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    title={isPaused ? t.playStream : t.pauseStream}
                    aria-label={isPaused ? t.playStream : t.pauseStream}
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("section-career-news")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="hidden sm:inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted transition"
                    title={t.bottomTickerJump}
                  >
                    <span>{t.bottomTickerJump}</span>
                    <ChevronUp className="h-3 w-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTickerCollapsed(true)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    title={t.minimize}
                    aria-label={t.minimize}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
