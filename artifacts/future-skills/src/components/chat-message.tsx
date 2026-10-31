import { Fragment, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { ChatCitation, ChatMessage as ChatMessageT } from "@workspace/api-client-react";
import type { AssistantStrings } from "@/lib/assistant-i18n";
import { cn } from "@/lib/utils";

const MASCOT = `${import.meta.env.BASE_URL}ai-mentor.png`;

/** Turns "[2]" markers into buttons that highlight the matching citation. */
function withMarkers(text: string, ranks: Set<number>, onMarker: (rank: number) => void, active: number | null, msgId: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const rank = Number(m[1]);
    if (!ranks.has(rank)) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <button
        key={`${m.index}-${rank}`}
        type="button"
        onClick={() => onMarker(rank)}
        aria-label={`Source ${rank}`}
        data-testid={`marker-${msgId}-${rank}`}
        className={cn(
          "font-data mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-md px-1 align-middle text-[10px] font-bold transition",
          active === rank ? "bg-charcoal text-white" : "bg-mist text-navy hover:bg-royal hover:text-white",
        )}
      >
        {rank}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Paragraphs({ text, render }: { text: string; render: (line: string) => ReactNode[] }) {
  return (
    <>
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="my-1.5 list-disc space-y-1 pl-4">
              {lines.map((l, li) => <li key={li}>{render(l.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, ""))}</li>)}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {render(l.replace(/\*\*/g, ""))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function CitationCard({ c, active, s, msgId }: { c: ChatCitation; active: boolean; s: AssistantStrings; msgId: string }) {
  const href = c.documentUrl ?? c.sourceUrl;
  const synthetic = /synthetic/i.test(c.documentTitle) || /synthetic/i.test(c.sourceName);
  return (
    <li
      id={`cite-${msgId}-${c.rank}`}
      className={cn("rounded-xl border bg-white p-2.5 transition", active ? "border-navy ring-2 ring-royal/40" : "border-border")}
      data-testid={`citation-${msgId}-${c.rank}`}
    >
      <div className="flex items-start gap-2">
        <span className="font-data flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-navy text-[10px] font-bold text-white">{c.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold leading-snug [overflow-wrap:anywhere]">{c.documentTitle}</div>
          <div className="font-data mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] uppercase tracking-wider text-muted-foreground">
            <span className="[overflow-wrap:anywhere]">{c.sourceName}</span>
            {c.relevanceScore !== null && <span>· {Math.round(c.relevanceScore * 100)}% {s.relevance}</span>}
            {synthetic && <span className="rounded bg-accent/25 px-1 text-amber-800">synthetic</span>}
          </div>
          <p className={cn("mt-1 text-[11.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]", !active && "line-clamp-2")}>{c.excerpt}</p>
          {href && (
            <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-navy hover:underline" data-testid={`link-citation-${msgId}-${c.rank}`}>
              {s.openSource} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function MentorAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mist", className)}>
      <img src={MASCOT} alt="" className="h-[115%] w-[115%] max-w-none object-contain" />
    </span>
  );
}

function Time({ at, lang }: { at: string; lang: string }) {
  const d = new Date(at);
  return (
    <time dateTime={d.toISOString()} className="font-data text-[9.5px] text-muted-foreground">
      {new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }).format(d)}
    </time>
  );
}

export function ChatBubble({ message, s, lang }: { message: ChatMessageT; s: AssistantStrings; lang: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1" data-testid={`message-user-${message.id}`}>
        <div className="max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-br-md bg-navy px-3.5 py-2 text-sm leading-relaxed text-white [overflow-wrap:anywhere]">{message.content}</div>
        <Time at={message.createdAt} lang={lang} />
      </div>
    );
  }
  const ranks = new Set(message.citations.map((c) => c.rank));
  const focus = (rank: number) => {
    setActive((cur) => (cur === rank ? null : rank));
    document.getElementById(`cite-${message.id}-${rank}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  return (
    <div className="flex gap-2" data-testid={`message-assistant-${message.id}`}>
      <MentorAvatar className="mt-0.5 h-7 w-7" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="rounded-[18px] rounded-tl-md border bg-white px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]">
          <Paragraphs text={message.content} render={(line) => withMarkers(line, ranks, focus, active, message.id)} />
        </div>
        {message.citations.length > 0 ? (
          <div>
            <div className="font-data mb-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-navy">{s.sources}</div>
            <ol className="space-y-1.5">
              {message.citations.map((c) => (
                <CitationCard key={c.chunkId} c={c} active={active === c.rank} s={s} msgId={message.id} />
              ))}
            </ol>
          </div>
        ) : (
          <div className="font-data text-[9.5px] uppercase tracking-wider text-muted-foreground">{s.noCitations}</div>
        )}
        <Time at={message.createdAt} lang={lang} />
      </div>
    </div>
  );
}
