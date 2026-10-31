import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUp, History, Maximize2, Minus, Plus, Trash2, X, KeyRound, BookOpenCheck } from "lucide-react";
import {
  getGetAssistantStatusQueryKey,
  getGetChatSessionQueryKey,
  getListChatSessionsQueryKey,
  useCreateChatSession,
  useDeleteChatSession,
  useGetAssistantStatus,
  useGetChatSession,
  useListChatSessions,
  useSendChatMessage,
  type ChatLanguage,
} from "@workspace/api-client-react";
import { ChatBubble, MentorAvatar } from "@/components/chat-message";
import { CHAT_LANGUAGES, T, type AssistantStrings } from "@/lib/assistant-i18n";
import { ensureGuestToken } from "@/lib/guest";
import { useActiveChat, useChatLanguage } from "@/lib/store";
import { cn } from "@/lib/utils";

const MAX_CHARS = 2000;
type View = "closed" | "minimized" | "open";

function errorText(err: unknown, s: AssistantStrings): string {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 429) return s.errors.rateLimited;
  if (status === 402) return s.errors.insufficientBalance;
  if (status === 413) return s.errors.inputLimit;
  if (status === 503) return s.errors.notReady;
  if (status === 502) return s.errors.aiFailed;
  if (typeof status !== "number") return s.errors.network;
  return s.errors.generic;
}

/** Floating "Ask AI" launcher and chat panel, shown on every page. */
export function AskAiWidget() {
  const [view, setView] = useState<View>("closed");
  const reduce = useReducedMotion();

  return (
    <>
      <AnimatePresence>
        {view === "closed" && (
          <motion.button
            key="launcher"
            type="button"
            onClick={() => setView("open")}
            initial={reduce ? false : { opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.18 }}
            className="group fixed bottom-[max(24px,calc(env(safe-area-inset-bottom)+12px))] right-6 z-50 flex items-center gap-2 rounded-full border-2 border-white bg-gradient-to-br from-royal to-navy py-1.5 pl-1.5 pr-4 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(11,79,158,0.75)] outline-none transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_18px_34px_-12px_rgba(11,79,158,0.85)] focus-visible:ring-4 focus-visible:ring-sky/50 active:scale-95"
            aria-label="Ask AI"
            data-testid="button-ask-ai"
          >
            <MentorAvatar className="h-10 w-10 bg-white transition-transform group-hover:rotate-[-6deg]" />
            <span>Ask AI</span>
          </motion.button>
        )}
      </AnimatePresence>
      {view !== "closed" && <ChatPanel view={view} setView={setView} />}
    </>
  );
}

function ChatPanel({ view, setView }: { view: Exclude<View, "closed">; setView: (v: View) => void }) {
  useState(() => ensureGuestToken());
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const [language, setLanguage] = useChatLanguage();
  const [activeId, setActiveId] = useActiveChat();
  const s = T[language] ?? T.ms;

  const status = useGetAssistantStatus({ query: { queryKey: getGetAssistantStatusQueryKey(), staleTime: 30_000 } });
  const sessions = useListChatSessions();
  const detail = useGetChatSession(activeId ?? "", { query: { enabled: !!activeId, queryKey: getGetChatSessionQueryKey(activeId ?? ""), retry: false } });
  const createSession = useCreateChatSession();
  const sendMessage = useSendChatMessage();
  const deleteSession = useDeleteChatSession();

  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<{ sessionId: string; items: string[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A stored session that no longer exists (deleted, other browser) is forgotten.
  useEffect(() => {
    if (activeId && detail.isError) setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, detail.isError]);

  const messages = useMemo(() => (activeId ? detail.data?.messages ?? [] : []), [activeId, detail.data]);
  const minimized = view === "minimized";

  useEffect(() => {
    if (minimized || showHistory) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pending, error, minimized, showHistory, reduce]);

  useEffect(() => {
    if (!minimized && !showHistory) inputRef.current?.focus();
  }, [minimized, showHistory]);

  // Grow the input with its content, up to about five lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft, minimized, showHistory]);

  const ready = status.data?.chatReady ?? false;
  const busy = pending !== null;

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy || !ready) return;
    setError(null);
    setFollowUps(null);
    setPending(question);
    setDraft("");
    try {
      let id = activeId;
      if (!id) {
        const created = await createSession.mutateAsync({ data: { language } });
        id = created.id;
        setActiveId(id);
      }
      const exchange = await sendMessage.mutateAsync({ sessionId: id, data: { content: question, language } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetChatSessionQueryKey(id) }),
        qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() }),
      ]);
      setFollowUps({ sessionId: id, items: exchange.followUps });
    } catch (err) {
      setDraft(question);
      setError(errorText(err, s));
    } finally {
      setPending(null);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  }

  function newChat() {
    setActiveId(null);
    setShowHistory(false);
    setError(null);
    setFollowUps(null);
    setDraft("");
  }

  async function removeSession(id: string) {
    await deleteSession.mutateAsync({ sessionId: id });
    if (id === activeId) setActiveId(null);
    await qc.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
  }

  const dateFmt = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const shownFollowUps = followUps && followUps.sessionId === activeId && !pending ? followUps.items : [];
  const iconBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/85 outline-none transition hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white active:scale-90";

  return (
    <motion.section
      role="dialog"
      aria-label={s.title}
      aria-modal="false"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformOrigin: "bottom right" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setView("minimized");
      }}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-[24px] border border-navy/20 bg-cream shadow-[0_24px_60px_-20px_rgba(11,79,158,0.55)]",
        "bottom-[max(8px,env(safe-area-inset-bottom))] left-2 right-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[400px]",
        minimized ? "h-auto" : "h-[calc(100dvh-16px-env(safe-area-inset-bottom))] sm:h-[min(600px,calc(100dvh-48px))]",
      )}
      data-testid="panel-ask-ai"
    >
      {/* Header */}
      <header className="flex items-center gap-1.5 bg-gradient-to-br from-navy to-royal px-3 py-2.5 text-white">
        <MentorAvatar className="h-10 w-10 bg-white" />
        <div className="ml-1 min-w-0 flex-1">
          <div className="font-display truncate text-[15px] font-extrabold leading-tight">{s.title}</div>
          <div className="line-clamp-2 text-[10.5px] leading-tight text-white/80">{s.subtitle}</div>
        </div>
        {!minimized && (
          <>
            <button type="button" className={iconBtn} onClick={() => setShowHistory((v) => !v)} aria-label={showHistory ? s.backToChat : s.showHistory} title={showHistory ? s.backToChat : s.showHistory} aria-pressed={showHistory} data-testid="button-chat-history">
              {showHistory ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
            </button>
            <button type="button" className={iconBtn} onClick={newChat} aria-label={s.newChat} title={s.newChat} data-testid="button-new-chat">
              <Plus className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          className={iconBtn}
          onClick={() => setView(minimized ? "open" : "minimized")}
          aria-label={minimized ? s.expand : s.minimize}
          title={minimized ? s.expand : s.minimize}
          data-testid="button-minimize-chat"
        >
          {minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        </button>
        <button type="button" className={iconBtn} onClick={() => setView("closed")} aria-label={s.close} title={s.close} data-testid="button-close-chat">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!minimized && (
        <>
          {/* Language */}
          <div className="flex items-center justify-between gap-2 border-b border-navy/10 bg-white px-3 py-1.5">
            <span className="font-data text-[9.5px] font-semibold uppercase tracking-[0.16em] text-navy" id="chat-language-label">{s.languageLabel}</span>
            <div className="inline-flex rounded-full bg-mist p-0.5" role="radiogroup" aria-labelledby="chat-language-label">
              {CHAT_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={language === l.code}
                  title={l.label}
                  onClick={() => setLanguage(l.code as ChatLanguage)}
                  data-testid={`button-language-${l.code}`}
                  className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-royal", language === l.code ? "bg-navy text-white" : "text-navy/70 hover:text-navy")}
                >
                  {l.short}
                </button>
              ))}
            </div>
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-3" data-testid="panel-sessions">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-sm font-bold">{s.conversations}</span>
                <button type="button" onClick={newChat} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-navy transition hover:bg-royal hover:text-white active:scale-95">
                  <Plus className="h-3.5 w-3.5" /> {s.newChat}
                </button>
              </div>
              {sessions.data && sessions.data.length === 0 && <p className="py-3 text-xs text-muted-foreground">{s.noConversations}</p>}
              {sessions.isError && <p className="py-3 text-xs text-destructive">{s.errors.network}</p>}
              <ul className="space-y-1">
                {sessions.data?.map((c) => (
                  <li key={c.id} className={cn("flex items-center gap-1 rounded-xl transition", c.id === activeId ? "bg-charcoal text-white" : "bg-white hover:bg-mist")}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(c.id);
                        setShowHistory(false);
                        setError(null);
                      }}
                      className="min-w-0 flex-1 px-3 py-2 text-left"
                      data-testid={`button-session-${c.id}`}
                    >
                      <div className="truncate text-sm font-semibold">{c.title ?? s.untitled}</div>
                      <div className={cn("font-data text-[10px]", c.id === activeId ? "text-white/70" : "text-muted-foreground")}>
                        {dateFmt.format(new Date(c.lastMessageAt ?? c.createdAt))} · {CHAT_LANGUAGES.find((l) => l.code === c.language)?.short}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSession(c.id)}
                      aria-label={s.deleteChat}
                      title={s.deleteChat}
                      className={cn("mr-1 rounded-lg p-1.5 opacity-60 transition hover:opacity-100", c.id === activeId ? "hover:bg-white/15" : "hover:bg-white")}
                      data-testid={`button-delete-session-${c.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-live="polite" data-testid="panel-chat">
              {status.data && !ready && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-accent/50 bg-accent/10 p-3" data-testid="status-assistant-not-ready">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div className="text-xs">
                    <div className="font-bold">{s.notReadyTitle}</div>
                    <p className="text-muted-foreground">{s.needsKnowledge}</p>
                  </div>
                </div>
              )}
              {status.data && ready && !status.data.llmReady && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-accent/50 bg-accent/10 p-3" data-testid="status-assistant-search-only">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div className="text-xs">
                    <div className="font-bold">{s.searchOnlyTitle}</div>
                    <p className="text-muted-foreground">{s.searchOnlyNotice}</p>
                  </div>
                </div>
              )}

              {/* Welcome (not stored) */}
              <div className="flex gap-2">
                <MentorAvatar className="mt-0.5 h-7 w-7" />
                <div className="rounded-[18px] rounded-tl-md border bg-white px-3.5 py-2.5 text-sm leading-relaxed">{s.welcome}</div>
              </div>

              {activeId && detail.isLoading && <div className="ml-9 h-16 animate-pulse rounded-2xl bg-muted" />}

              {messages.length === 0 && !pending && !(activeId && detail.isLoading) && (
                <SuggestionList label={s.suggestionsLabel} items={s.suggestions} disabled={!ready || busy} onPick={(q) => void ask(q)} testId="suggestion" />
              )}

              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} s={s} lang={language} />
              ))}

              {pending && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-br-md bg-navy/80 px-3.5 py-2 text-sm text-white [overflow-wrap:anywhere]">{pending}</div>
                  </div>
                  <div className="flex items-center gap-2" data-testid="status-thinking">
                    <MentorAvatar className="h-7 w-7" />
                    <div className="flex items-center gap-2 rounded-[18px] rounded-tl-md border bg-white px-3.5 py-2.5 text-xs text-muted-foreground">
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-royal" animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </span>
                      {s.thinking}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive" role="alert" data-testid="status-chat-error">
                  {error}
                </p>
              )}

              {shownFollowUps.length > 0 && <SuggestionList label={s.followUpsLabel} items={shownFollowUps} disabled={!ready || busy} onPick={(q) => void ask(q)} testId="follow-up" />}
              <div ref={endRef} />
            </div>
          )}

          {/* Input */}
          <form onSubmit={onSubmit} className="border-t border-navy/10 bg-white px-3 pb-2 pt-2">
            <div className="flex items-end gap-2 rounded-2xl border-2 border-primary/15 bg-white px-2 py-1.5 focus-within:border-royal/60">
              <label htmlFor="chat-input" className="sr-only">{s.placeholder}</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={draft}
                maxLength={MAX_CHARS}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={s.placeholder}
                disabled={!ready}
                className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                data-testid="input-chat"
              />
              <button
                type="submit"
                disabled={!ready || busy || !draft.trim()}
                aria-label={s.send}
                title={s.send}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white shadow-[0_3px_0_0_#07356c] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:shadow-none"
                data-testid="button-send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-[10px] text-muted-foreground">{s.disclaimer}</span>
              <span className={cn("font-data shrink-0 text-[10px]", draft.length > MAX_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground")}>
                {draft.length}/{MAX_CHARS}
              </span>
            </div>
          </form>
        </>
      )}
    </motion.section>
  );
}

function SuggestionList({ label, items, disabled, onPick, testId }: { label: string; items: string[]; disabled: boolean; onPick: (q: string) => void; testId: string }) {
  return (
    <div className="ml-9">
      <div className="font-data mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-navy">{label}</div>
      <div className="flex flex-col items-start gap-1.5">
        {items.map((q, i) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="rounded-2xl border border-royal/30 bg-white px-3 py-1.5 text-left text-xs font-semibold text-navy transition hover:border-royal hover:bg-mist active:scale-[.98] disabled:pointer-events-none disabled:opacity-50"
            data-testid={`button-${testId}-${i}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
