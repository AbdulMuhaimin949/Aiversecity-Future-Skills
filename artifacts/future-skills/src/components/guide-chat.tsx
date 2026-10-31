import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, Globe, MessageCircleQuestion, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type GuideLang = "en" | "ms" | "zh";
export type LangMode = "auto" | GuideLang;
type Action = { label: string; href: string };
type Msg = { role: "user" | "assistant"; content: string; actions?: Action[] };

/**
 * Parses markdown bold (**text**) into <strong> tags cleanly.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-navy">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/**
 * Formats guide message text:
 * - Converts bullet points (• or -) into clean styled list elements
 * - Converts **bold** into bold typography without stars showing
 * - Handles paragraphs gracefully
 */
function FormattedMessage({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        const isBulletList = lines.every((l) => /^\s*([•\-\*]|\d+\.)\s+/.test(l.trim()));

        if (isBulletList) {
          return (
            <ul key={pIdx} className="my-1.5 space-y-1.5 pl-1">
              {lines.map((line, lIdx) => {
                const cleaned = line.replace(/^\s*([•\-\*]|\d+\.)\s+/, "");
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal" />
                    <span className="flex-1">{renderInlineMarkdown(cleaned)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Mixed paragraph or lines with single bullets
        return (
          <p key={pIdx}>
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              const isBullet = /^\s*([•\-\*]|\d+\.)\s+/.test(trimmed);
              if (isBullet) {
                const cleaned = trimmed.replace(/^\s*([•\-\*]|\d+\.)\s+/, "");
                return (
                  <span key={lIdx} className="my-1 flex items-start gap-2 pl-1">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal" />
                    <span className="flex-1">{renderInlineMarkdown(cleaned)}</span>
                  </span>
                );
              }
              return (
                <span key={lIdx} className="block">
                  {renderInlineMarkdown(line)}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

const LANG_OPTIONS: { code: LangMode; short: string; label: string }[] = [
  { code: "auto", short: "Auto", label: "Auto Detect" },
  { code: "en", short: "EN", label: "English" },
  { code: "ms", short: "BM", label: "Bahasa Melayu" },
  { code: "zh", short: "中文", label: "简体中文" },
];

export function detectLanguage(text: string): GuideLang {
  if (/[\u4e00-\u9fa5]/.test(text)) return "zh";
  const msPattern =
    /\b(saya|aku|nak|nk|tanya|tny|boleh|bleh|bagaimana|bgmana|macam\s*mana|mcm\s*mana|camne|cmne|cara|muat\s*naik|upload|apa|ape|ialah|yang|yg|di|ke|ini|ni|itu|tu|dan|dgn|ngan|untuk|utk|tidak|tak|x|xleh|takleh|ada|dah|dh|kenapa|knp|mengapa|padanan|laluan|kemahiran|pekerjaan|kursus|siapa|sape|tolong|hai|salam|terima\s*kasih|tq|terangkan|faham|blur|pastu|pstu|tgh|sbb)\b/i;
  if (msPattern.test(text)) return "ms";
  return "en";
}

const UI_TEXT: Record<
  GuideLang,
  {
    buttonLabel: string;
    title: string;
    subtitle: string;
    welcome: string;
    suggestionsTitle: string;
    placeholder: string;
    newChat: string;
    closeChat: string;
    serverError: string;
  }
> = {
  en: {
    buttonLabel: "Need help?",
    title: "CTRL CV Guide",
    subtitle: "Ask how to use the system",
    welcome: "Hi! I'm the CTRL CV Guide 👋 Ask me how to use the system, or about anything on this page you don't understand.",
    suggestionsTitle: "Suggested for this page",
    placeholder: "Type your question…",
    newChat: "New chat",
    closeChat: "Close chat",
    serverError: "I couldn't reach the server. Check that the API is running and try again.",
  },
  ms: {
    buttonLabel: "Perlu bantuan?",
    title: "Panduan CTRL CV",
    subtitle: "Tanya cara guna sistem ini",
    welcome: "Hai! Saya Panduan CTRL CV 👋 Tanya saya cara menggunakan sistem ini atau apa-apa pada halaman ini yang anda kurang faham.",
    suggestionsTitle: "Cadangan soalan halaman ini",
    placeholder: "Taip soalan anda…",
    newChat: "Perbualan baru",
    closeChat: "Tutup perbualan",
    serverError: "Tidak dapat berhubung dengan pelayan. Sila pastikan API sedang berjalan dan cuba lagi.",
  },
  zh: {
    buttonLabel: "需要帮助？",
    title: "CTRL CV 智能向导",
    subtitle: "询问系统使用方法",
    welcome: "你好！我是 CTRL CV 智能向导 👋 随时问我如何使用该系统，或解答当前页面上您不理解的任何问题。",
    suggestionsTitle: "本页面推荐提问",
    placeholder: "输入您的问题…",
    newChat: "新对话",
    closeChat: "关闭窗口",
    serverError: "无法连接到服务器。请确保后端服务正常运行后再试。",
  },
};

const SUGGESTIONS: Record<string, Record<GuideLang, string[]>> = {
  "/profile": {
    en: ["How do I upload my CV?", "What if the scan misses a skill?", "Is my personal data stored?"],
    ms: ["Bagaimana cara muat naik CV?", "Bagaimana jika imbasan terlepas kemahiran?", "Adakah data peribadi saya disimpan?"],
    zh: ["如何上传我的简历（CV）？", "如果简历扫描漏了技能怎么办？", "我的个人数据会被保存吗？"],
  },
  "/matches": {
    en: ["How is the match score calculated?", "What do AI Risk and Job Safety mean?", "How do I pick a target role?"],
    ms: ["Bagaimanakah skor padanan dikira?", "Apakah maksud Risiko AI dan Keselamatan Kerja?", "Bagaimana cara pilih peranan sasaran?"],
    zh: ["匹配度分数是如何计算的？", "AI风险和工作安全度是什么意思？", "如何选择我的目标职位？"],
  },
  "/pathway": {
    en: ["How is my pathway built?", "Why is a skill marked uncovered?", "Can I change my target role?"],
    ms: ["Bagaimana laluan pembelajaran dibina?", "Mengapa kemahiran ditanda tidak diliputi?", "Bolehkah saya tukar peranan sasaran?"],
    zh: ["学习路线图是如何生成的？", "为什么有些技能标记为未覆盖？", "我可以更换目标职位吗？"],
  },
  "/radar": {
    en: ["What do Low / Moderate / High Impact mean?", "What is the 90% range?", "How do I read rising vs slowing?"],
    ms: ["Apakah maksud Impak Rendah / Sederhana / Tinggi?", "Apakah itu julat ramalan 90%?", "Bagaimana membaca peranan meningkat vs perlahan?"],
    zh: ["低/中/高影响场景代表什么？", "90%预测区间是什么意思？", "如何解读上升与放缓趋势？"],
  },
  default: {
    en: ["How do I start?", "What does this system do?", "Where does the data come from?"],
    ms: ["Bagaimana cara untuk mula?", "Apakah fungsi sistem ini?", "Dari mana data ini diperoleh?"],
    zh: ["我应该如何开始？", "这个系统有什么核心功能？", "数据来源是哪里？"],
  },
};

function suggestionsFor(path: string, lang: GuideLang): string[] {
  const key = Object.keys(SUGGESTIONS).find((k) => k !== "default" && path.startsWith(k));
  return SUGGESTIONS[key ?? "default"][lang];
}

/** Floating multi-language help chat that guides users through CTRL CV with auto language detection. */
export function GuideChat() {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const [langMode, setLangMode] = useState<LangMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ctrl_cv_guide_lang_mode") : null;
    return saved === "en" || saved === "ms" || saved === "zh" ? saved : "auto";
  });
  const [activeLang, setActiveLang] = useState<GuideLang>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ctrl_cv_guide_lang_mode") : null;
    return saved === "ms" || saved === "zh" || saved === "en" ? saved : "en";
  });

  const [msgs, setMsgs] = useState<Msg[]>(() => [{ role: "assistant", content: UI_TEXT[activeLang].welcome }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  const t = UI_TEXT[activeLang];

  const handleSelectLangMode = (mode: LangMode) => {
    setLangMode(mode);
    try {
      localStorage.setItem("ctrl_cv_guide_lang_mode", mode);
    } catch {
      // ignore
    }
    if (mode !== "auto") {
      setActiveLang(mode);
      if (msgs.length <= 1) {
        setMsgs([{ role: "assistant", content: UI_TEXT[mode].welcome }]);
      }
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [msgs, busy, reduce]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    // Detect language of this query
    const queryLang = langMode === "auto" ? detectLanguage(q) : langMode;
    if (langMode === "auto" && queryLang !== activeLang) {
      setActiveLang(queryLang);
    }

    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setDraft("");
    setBusy(true);

    try {
      const r = await fetch("/api/guide/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: loc,
          lang: langMode,
          messages: next
            .filter((m, idx) => idx !== 0 || m.role === "user")
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await r.json()) as { reply?: string; actions?: Action[]; error?: string; lang?: GuideLang };
      if (data.lang && data.lang !== activeLang) {
        setActiveLang(data.lang);
      }
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply ?? data.error ?? UI_TEXT[data.lang ?? activeLang].serverError,
          actions: data.actions,
        },
      ]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: UI_TEXT[activeLang].serverError }]);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="guide-launcher"
            type="button"
            onClick={() => setOpen(true)}
            initial={reduce ? false : { opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border-2 border-white bg-gradient-to-br from-royal to-navy py-2 pl-2 pr-4 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(11,79,158,0.75)] transition hover:-translate-y-1 active:scale-95"
            aria-label="Open help chat"
            data-testid="button-guide-chat"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy shadow-inner">
              <MessageCircleQuestion className="h-5 w-5" />
            </span>
            <span>{t.buttonLabel}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="guide-panel"
            role="dialog"
            aria-label="CTRL CV Guide chat"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 flex h-[min(580px,calc(100dvh-48px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[26px] border-2 border-sky bg-white shadow-[0_24px_50px_-12px_rgba(11,79,158,0.55)]"
            data-testid="panel-guide-chat"
          >
            {/* Header */}
            <header className="bg-gradient-to-r from-navy via-royal to-sky p-3.5 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-navy shadow-sm">
                    <MessageCircleQuestion className="h-5 w-5" />
                  </span>
                  <div className="leading-tight">
                    <div className="font-display text-base font-extrabold">{t.title}</div>
                    <div className="text-[11px] text-white/85">{t.subtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMsgs([{ role: "assistant", content: t.welcome }])}
                    aria-label={t.newChat}
                    title={t.newChat}
                    className="rounded-full p-1.5 text-white/90 transition hover:bg-white/15"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t.closeChat}
                    title={t.closeChat}
                    className="rounded-full p-1.5 text-white/90 transition hover:bg-white/15"
                    data-testid="button-close-guide-chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Language Switcher Bar with Auto Detection */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-charcoal/30 px-2.5 py-1 backdrop-blur-sm">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-white/80">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Language:</span>
                </span>
                <div className="flex items-center gap-1">
                  {LANG_OPTIONS.map((l) => {
                    const active = langMode === l.code;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => handleSelectLangMode(l.code)}
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[11px] font-bold transition",
                          active
                            ? "bg-white text-navy shadow-sm"
                            : "text-white/85 hover:bg-white/15 hover:text-white",
                        )}
                        data-testid={`button-lang-${l.code}`}
                        title={l.label}
                      >
                        {l.code === "auto" && <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />}
                        {l.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-mist/30 p-3.5">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "whitespace-pre-wrap rounded-br-md bg-navy text-white shadow-sm"
                        : "rounded-bl-md border bg-white shadow-xs",
                    )}
                  >
                    {m.role === "user" ? m.content : <FormattedMessage text={m.content} />}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.actions.map((a) => (
                          <Link
                            key={a.href + a.label}
                            href={a.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-navy transition hover:bg-sky/40"
                          >
                            <span>{a.label}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex gap-1.5 rounded-2xl rounded-bl-md border bg-white px-4 py-3 shadow-xs">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-royal"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {msgs.length === 1 && !busy && (
                <div className="space-y-1.5 pt-1">
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.suggestionsTitle}
                  </div>
                  {suggestionsFor(loc, activeLang).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void ask(s)}
                      className="block w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-left text-xs font-semibold text-navy transition hover:border-primary/50 hover:bg-mist active:scale-99"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t bg-white p-2.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder={t.placeholder}
                className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="input-guide-chat"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white transition hover:bg-royal disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
