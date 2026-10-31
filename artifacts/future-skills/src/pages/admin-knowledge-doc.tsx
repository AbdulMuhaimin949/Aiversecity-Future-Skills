import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, History, Layers, Search, TriangleAlert } from "lucide-react";
import {
  getGetKnowledgeDocumentQueryKey, useDecideKnowledgeDocument, useEmbedKnowledgeDocument, useGetKnowledgeDocument, useTryKnowledgeDocumentQuestion,
  type KnowledgeDocumentDecision, type KnowledgeDocumentDetail, type TryKnowledgeDocumentResult,
} from "@workspace/api-client-react";
import { btn, ErrorState, Skel } from "@/components/kit";
import { CharcoalPill } from "@/components/pill";
import { SignedOutCard, apiErrorMessage, apiStatus, fmtDate } from "@/components/cv-kit";
import { AdminGate, DOC_DECISIONS, KnowledgeStatusBadge, LANGUAGE_LABEL, NotAdminCard, NotesField, docDecisionLabel, useInvalidateKnowledge } from "@/components/knowledge-kit";
import { cn } from "@/lib/utils";

export default function AdminKnowledgeDocPage() {
  return (
    <div className="space-y-6" data-testid="page-admin-knowledge-doc">
      <AdminGate>{() => <Workspace />}</AdminGate>
    </div>
  );
}

function Workspace() {
  const { documentId = "" } = useParams<{ documentId: string }>();
  const q = useGetKnowledgeDocument(documentId, { query: { queryKey: getGetKnowledgeDocumentQueryKey(documentId), enabled: !!documentId, retry: false } });

  if (q.isLoading) return <div className="space-y-4"><Skel className="h-24" /><Skel className="h-96" /></div>;
  if (q.isError || !q.data) {
    const s = apiStatus(q.error);
    if (s === 401) return <SignedOutCard />;
    if (s === 403) return <NotAdminCard email={null} />;
    return <ErrorState message={apiErrorMessage(q.error, "This document could not be loaded.")} onRetry={() => q.refetch()} />;
  }
  const detail = q.data;
  const d = detail.document;

  return (
    <>
      <Link href="/admin/knowledge" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline" data-testid="link-back-knowledge"><ArrowLeft className="h-4 w-4" /> Back to knowledge admin</Link>
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CharcoalPill tilt={2}>Knowledge document</CharcoalPill>
          <span className="font-data text-xs font-semibold uppercase tracking-[0.18em] text-primary" data-testid="text-doc-version">Version {d.version} of {d.versionCount}</span>
        </div>
        <h1 className="font-display text-[clamp(1.8rem,7vw,2.75rem)] font-extrabold leading-[1.02] [overflow-wrap:anywhere]" data-testid="text-doc-title">{d.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <KnowledgeStatusBadge status={d.approvalStatus} testId="status-doc" />
          <KnowledgeStatusBadge status={d.sourceStatus} prefix="Source" testId="status-doc-source" />
          <span className="text-sm text-muted-foreground">{d.sourceName} · {LANGUAGE_LABEL[d.language] ?? d.language} · {d.dataOrigin === "SYNTHETIC" ? "Synthetic (fictional)" : "Source-attributed"} · added {fmtDate(d.createdAt)}</span>
        </div>
        {detail.url && <a href={detail.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline [overflow-wrap:anywhere]"><ExternalLink className="h-3.5 w-3.5" /> {detail.url}</a>}
      </header>

      <Retrieval key={detail.document.id} detail={detail} />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="min-w-0 space-y-3">
          <h2 className="font-display text-2xl font-extrabold">Text <span className="font-data text-base text-muted-foreground">({detail.chunks.length} chunks)</span></h2>
          <p className="text-xs text-muted-foreground">Stored as overlapping chunks; each chunk gets its own embedding.</p>
          <ol className="space-y-2">
            {detail.chunks.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5" data-testid={`chunk-${c.chunkIndex}`}>
                <div className="font-data mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Chunk {c.chunkIndex + 1}</span>
                  <span className={c.embedded ? "text-navy" : ""} data-testid={`status-chunk-${c.chunkIndex}`}>{c.embedded ? "Embedded" : "No embedding"}</span>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed [overflow-wrap:anywhere]">{c.content}</pre>
              </li>
            ))}
          </ol>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <DecisionForm detail={detail} />
          <History_ detail={detail} />
          {detail.versions.length > 1 && <Versions detail={detail} />}
        </aside>
      </div>
    </>
  );
}

function Retrieval({ detail }: { detail: KnowledgeDocumentDetail }) {
  const d = detail.document;
  const embed = useEmbedKnowledgeDocument();
  const tryQuestion = useTryKnowledgeDocumentQuestion();
  const invalidate = useInvalidateKnowledge();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [probe, setProbe] = useState<TryKnowledgeDocumentResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const missing = d.chunkCount - d.embeddedChunkCount;
  const canEmbed = d.approvalStatus === "approved" && d.sourceStatus === "approved" && missing > 0;

  const run = () => {
    setMsg(null);
    embed.mutate({ documentId: d.id }, {
      onSuccess: (r) => {
        setMsg({ ok: r.errors.length === 0, text: `Embedded ${r.embedded} chunk(s).${r.remaining ? ` ${r.remaining} still missing.` : ""}${r.errors.length ? ` ${r.errors[0]}` : ""}` });
        void invalidate();
      },
      onError: (e) => { setMsg({ ok: false, text: apiErrorMessage(e, "Embedding failed. Nothing was stored.") }); void invalidate(); },
    });
  };

  const runQuestion = () => {
    const text = question.trim();
    if (text.length < 3 || text.length > 1000) return;
    setProbe(null);
    setProbeError(null);
    tryQuestion.mutate(
      { documentId: d.id, data: { question: text } },
      {
        onSuccess: setProbe,
        onError: (e) => setProbeError(apiErrorMessage(e, "The retrieval check failed.")),
      },
    );
  };

  let state: { icon: typeof Bot; title: string; text: string; tone: "ok" | "wait" | "off" };
  if (detail.retrievable) state = { icon: Bot, title: "The AI Mentor can use this document", text: "It is approved, its source is approved, and every chunk is embedded.", tone: "ok" };
  else if (d.approvalStatus === "pending") state = { icon: TriangleAlert, title: "Waiting for a decision", text: "Pending documents are never embedded or retrieved.", tone: "wait" };
  else if (d.approvalStatus !== "approved") state = { icon: TriangleAlert, title: `Not used: ${d.approvalStatus}`, text: "Only approved documents are embedded and retrieved.", tone: "off" };
  else if (d.sourceStatus !== "approved") state = { icon: TriangleAlert, title: "Approved, but its source is not", text: `Approve "${d.sourceName}" on the knowledge admin page first.`, tone: "wait" };
  else state = { icon: Layers, title: "Approved, embeddings needed", text: `${missing} of ${d.chunkCount} chunk(s) have no embedding yet. Generate them so the AI Mentor can find this text.`, tone: "wait" };

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-col gap-3 rounded-[22px] border-2 p-4 sm:flex-row sm:items-center sm:justify-between", state.tone === "ok" ? "border-navy bg-navy text-white" : state.tone === "wait" ? "border-accent/60 bg-accent/10" : "border-border bg-muted/60")} data-testid="panel-retrieval">
        <div className="flex items-start gap-3">
          <state.icon className={cn("mt-0.5 h-6 w-6 shrink-0", state.tone === "ok" ? "text-white" : "text-navy")} />
          <div>
            <div className="font-bold" data-testid="text-retrieval-state">{state.title}</div>
            <p className={cn("text-sm", state.tone === "ok" ? "text-white/80" : "text-muted-foreground")}>{state.text}</p>
            <div className={cn("font-data mt-1 text-[11px]", state.tone === "ok" ? "text-white/70" : "text-muted-foreground")} data-testid="text-embedded-count">{d.embeddedChunkCount}/{d.chunkCount} chunks embedded</div>
            {msg && <p role={msg.ok ? "status" : "alert"} className={cn("mt-1 text-xs font-medium [overflow-wrap:anywhere]", msg.ok ? "text-navy" : "text-destructive")} data-testid="status-embed">{msg.text}</p>}
          </div>
        </div>
        {canEmbed && (
          <button type="button" className={cn(btn.primary, "shrink-0")} onClick={run} disabled={embed.isPending} data-testid="button-embed-document">
            <Layers className="h-4 w-4" /> {embed.isPending ? "Embedding..." : "Generate embeddings"}
          </button>
        )}
        {detail.retrievable && <CheckCircle2 className="hidden h-8 w-8 shrink-0 text-white sm:block" />}
      </div>

      <section className="rounded-[22px] border-2 border-primary/15 bg-white p-4 shadow-sm" aria-labelledby="heading-try-question" data-testid="panel-try-question">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-royal" />
          <h2 id="heading-try-question" className="font-display text-lg font-extrabold">Try a question</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Searches approved knowledge chunks only. It does not generate an AI answer.</p>
        {!detail.retrievable && (
          <p className="mt-3 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-navy" role="status" data-testid="status-document-not-retrievable">
            This document is not retrievable yet. Approve it and its source, then embed every chunk. The results below only include approved, embedded knowledge.
          </p>
        )}
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); runQuestion(); }}>
          <label htmlFor="try-question-input" className="sr-only">Question to test</label>
          <textarea
            id="try-question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Ask a question that this document should help answer..."
            className="w-full resize-y rounded-xl border border-primary/20 bg-mist/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-royal"
            data-testid="input-try-question"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-data text-[10px] text-muted-foreground">Question embedding + search only · no reply generation</span>
            <button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={question.trim().length < 3 || tryQuestion.isPending} data-testid="button-try-question">
              <Search className="h-4 w-4" /> {tryQuestion.isPending ? "Searching..." : "Search chunks"}
            </button>
          </div>
        </form>
        {probeError && <p role="alert" className="mt-3 text-sm font-medium text-destructive [overflow-wrap:anywhere]" data-testid="status-try-question-error">{probeError}</p>}
        {probe && (
          <div className="mt-4 space-y-2" aria-live="polite" data-testid="results-try-question">
            {!probe.documentRetrievable && (
              <p className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-semibold text-navy" data-testid="status-probe-document-not-retrievable">
                This document is not retrievable yet; its chunks cannot appear in AI Mentor results until approval and embedding are complete.
              </p>
            )}
            {probe.results.length === 0 ? (
              <p className="rounded-xl bg-mist/60 px-3 py-3 text-sm text-muted-foreground" data-testid="text-no-retrieval-results">
                No approved chunks met the minimum relevance score for this question.
              </p>
            ) : (
              <>
                <div className="font-data text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top {probe.results.length} matching chunks</div>
                <ol className="space-y-2">
                  {probe.results.map((result, i) => (
                    <li
                      key={result.chunkId}
                      className={cn("rounded-2xl border-2 p-3", result.isCurrentDocument ? "border-navy bg-mist" : "border-border bg-white")}
                      data-testid={`try-result-${i + 1}`}
                      data-current-document={result.isCurrentDocument ? "true" : "false"}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold [overflow-wrap:anywhere]">{result.documentTitle}</span>
                            {result.isCurrentDocument && <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white" data-testid="badge-current-document">This document</span>}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{result.sourceName} · Chunk {result.chunkIndex + 1}</div>
                        </div>
                        <span className="font-data shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-navy" title="Cosine similarity score">
                          Score {(result.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed [overflow-wrap:anywhere]">{result.content}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DecisionForm({ detail }: { detail: KnowledgeDocumentDetail }) {
  const d = detail.document;
  const decide = useDecideKnowledgeDocument();
  const invalidate = useInvalidateKnowledge();
  const [decision, setDecision] = useState<KnowledgeDocumentDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const choices = DOC_DECISIONS.filter((x) => x.id !== d.approvalStatus);
  const ok = decision && notes.trim().length >= 10;
  const hint = DOC_DECISIONS.find((x) => x.id === decision)?.hint;
  const submit = () => {
    if (!ok) return;
    setErr(null);
    setDone(null);
    decide.mutate({ documentId: d.id, data: { decision, notes: notes.trim() } }, {
      onSuccess: () => { setDone(`Recorded: ${docDecisionLabel(decision)}.`); setDecision(null); setNotes(""); void invalidate(); },
      onError: (e) => setErr(apiErrorMessage(e, "The decision was not saved.")),
    });
  };
  return (
    <form className="rounded-[22px] border-2 border-royal/25 bg-white p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid="form-decide-document">
      <div className="font-bold">Record a decision</div>
      <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup">
        {choices.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={decision === x.id} onClick={() => setDecision(x.id)} title={x.hint}
            className={cn("rounded-xl border-2 px-2.5 py-2 text-left text-xs font-bold transition active:scale-[.97]", decision === x.id ? "border-navy bg-navy text-white" : "border-primary/15 text-navy hover:bg-mist")}
            data-testid={`radio-doc-${x.id}`}>{x.label}</button>
        ))}
      </div>
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
      <NotesField id="doc-notes" value={notes} onChange={setNotes} />
      <div className="mt-2 flex justify-end"><button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={!ok || decide.isPending} data-testid="button-save-decision">{decide.isPending ? "Saving..." : "Save decision"}</button></div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid="status-decide-error">{err}</p>}
      {done && <p role="status" className="mt-2 text-xs font-medium text-navy" data-testid="status-decide-done">{done}</p>}
    </form>
  );
}

function History_({ detail }: { detail: KnowledgeDocumentDetail }) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm" data-testid="panel-approvals">
      <div className="flex items-center gap-2 font-bold"><History className="h-4 w-4 text-royal" /> Approval history</div>
      {detail.approvals.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No decisions yet.</p> : (
        <ol className="mt-2 space-y-1.5">
          {detail.approvals.map((a, i) => (
            <li key={a.id} className={cn("rounded-xl p-2.5 text-sm", i === 0 ? "bg-mist/70" : "bg-cream/60")} data-testid={`approval-${a.id}`}>
              <div className="font-semibold">{docDecisionLabel(a.decision)}</div>
              {a.notes && <p className="[overflow-wrap:anywhere]">{a.notes}</p>}
              <div className="font-data text-[10.5px] text-muted-foreground">{a.reviewerName} · {fmtDate(a.decidedAt)}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Versions({ detail }: { detail: KnowledgeDocumentDetail }) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm" data-testid="panel-versions">
      <div className="font-bold">Versions with this title</div>
      <ul className="mt-2 space-y-1">
        {detail.versions.map((v) => (
          <li key={v.id}>
            {v.id === detail.document.id ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-mist/70 px-2.5 py-1.5 text-sm font-semibold"><span>v{v.version} (this one)</span><KnowledgeStatusBadge status={v.approvalStatus} /></div>
            ) : (
              <Link href={`/admin/knowledge/documents/${v.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm hover:bg-mist" data-testid={`link-version-${v.version}`}>
                <span>v{v.version} · {fmtDate(v.createdAt)}</span><KnowledgeStatusBadge status={v.approvalStatus} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
