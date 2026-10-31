import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bot, CheckCircle2, CircleDashed, Database, FilePlus2, Layers, Search, Sparkles, Upload, X } from "lucide-react";
import {
  getGetKnowledgeOverviewQueryKey, getListKnowledgeDocumentsQueryKey, useApproveSyntheticKnowledgeDocuments, useCreateKnowledgeDocument, useDecideKnowledgeSource, useEmbedKnowledgeSource,
  useGetKnowledgeOverview, useListKnowledgeDocuments,
  type ChatLanguage, type KnowledgeDataOrigin, type KnowledgeDocumentFilter, type KnowledgeOverview, type KnowledgeSource, type KnowledgeSourceDecision,
} from "@workspace/api-client-react";
import { btn, ErrorState, PageHead, Skel } from "@/components/kit";
import { Pager, SignOutButton, apiErrorMessage, fmtDate } from "@/components/cv-kit";
import { AdminGate, KnowledgeStatusBadge, LANGUAGE_LABEL, NotesField, docDecisionLabel, useInvalidateKnowledge } from "@/components/knowledge-kit";
import { cn } from "@/lib/utils";

export default function AdminKnowledgePage() {
  return (
    <div className="space-y-6" data-testid="page-admin-knowledge">
      <AdminGate>{(me) => <Desk name={me.displayName ?? me.email} />}</AdminGate>
    </div>
  );
}

function Desk({ name }: { name: string | null }) {
  const overview = useGetKnowledgeOverview({ query: { queryKey: getGetKnowledgeOverviewQueryKey() } });
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHead kicker="Knowledge admin" title="AI Mentor knowledge">
        <div className="flex flex-wrap items-center gap-2">
          {name && <span className="font-data rounded-full bg-white px-3 py-1.5 text-xs" data-testid="text-admin-name">{name}</span>}
          <SignOutButton />
        </div>
      </PageHead>
      <p className="-mt-4 max-w-3xl text-sm text-muted-foreground">
        The AI Mentor only answers from documents a person has approved, in an approved source, after their text has been embedded. New documents always start as pending.
      </p>

      <Lifecycle data={overview.data} />

      {overview.isError && <ErrorState message={apiErrorMessage(overview.error)} onRetry={() => overview.refetch()} />}
      {overview.isLoading && <div className="grid gap-3 md:grid-cols-2"><Skel className="h-40 rounded-[22px]" /><Skel className="h-40 rounded-[22px]" /></div>}
      {overview.data && <Sources data={overview.data} />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold">Documents</h2>
          {!adding && <button type="button" className={btn.primary} onClick={() => setAdding(true)} data-testid="button-open-add-document"><FilePlus2 className="h-4 w-4" /> Add document</button>}
        </div>
        {adding && overview.data && <AddDocumentForm data={overview.data} onClose={() => setAdding(false)} />}
        <DocumentList sources={overview.data?.sources ?? []} />
      </section>

      {overview.data && overview.data.recentRuns.length > 0 && <Runs data={overview.data} />}
    </>
  );
}

function Lifecycle({ data }: { data?: KnowledgeOverview }) {
  const steps = [
    { icon: FilePlus2, label: "Add", text: "Paste or upload text" },
    { icon: CircleDashed, label: "Pending", text: "Waits for a person" },
    { icon: CheckCircle2, label: "Approve", text: "Decision with notes" },
    { icon: Layers, label: "Embed", text: "Gemini vectors" },
    { icon: Bot, label: "AI Mentor", text: "Can cite it" },
  ];
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-5" data-testid="panel-lifecycle">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-center gap-2.5 rounded-2xl bg-mist/60 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy text-white"><s.icon className="h-4 w-4" /></span>
            <div className="min-w-0 leading-tight">
              <div className="font-data text-[10px] text-muted-foreground">{i + 1}</div>
              <div className="text-sm font-bold">{s.label}</div>
              <div className="text-[11px] text-muted-foreground">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
      {data && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={cn("font-data inline-flex items-center gap-1.5 rounded-full px-3 py-1", data.geminiConfigured ? "bg-mist text-navy" : "bg-destructive/10 text-destructive")} data-testid="status-gemini">
            <span className={cn("h-2 w-2 rounded-full", data.geminiConfigured ? "bg-royal" : "bg-destructive")} />
            {data.geminiConfigured ? "Gemini key configured" : "No Gemini key: embedding is unavailable"}
          </span>
          <span className="font-data inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-navy" data-testid="status-embedding-model">
            <Sparkles className="h-3 w-3" /> {data.embeddingModel}{data.embeddingModelActive ? "" : " · not registered yet"}
          </span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sources

function Sources({ data }: { data: KnowledgeOverview }) {
  return (
    <section className="space-y-3" data-testid="section-sources">
      <h2 className="font-display text-2xl font-extrabold">Sources</h2>
      {data.sources.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-white/70 p-6 text-center text-sm text-muted-foreground" data-testid="status-no-sources">
          No knowledge sources yet. Adding a document creates the "{data.adminSourceName}" source.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{data.sources.map((s) => <SourceCard key={s.id} s={s} geminiConfigured={data.geminiConfigured} />)}</div>
      )}
    </section>
  );
}

const SOURCE_DECISIONS: { id: KnowledgeSourceDecision; label: string }[] = [
  { id: "approved", label: "Approve" },
  { id: "pending", label: "Back to pending" },
  { id: "rejected", label: "Reject" },
  { id: "retired", label: "Retire" },
];

const SYNTHETIC_RAG_SOURCE_NAME = "Aiversecity synthetic knowledge add-on";

function SourceCard({ s, geminiConfigured }: { s: KnowledgeSource; geminiConfigured: boolean }) {
  const invalidate = useInvalidateKnowledge();
  const embed = useEmbedKnowledgeSource();
  const [deciding, setDeciding] = useState(false);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const c = s.documentCounts;
  const canBulkApproveSyntheticDocs =
    s.name === SYNTHETIC_RAG_SOURCE_NAME && s.sourceType === "synthetic_demo" && c.pending > 0 && c.pending <= 500;
  const runEmbed = () => {
    setMsg(null);
    embed.mutate({ sourceId: s.id }, {
      onSuccess: (r) => {
        setMsg({ ok: r.errors.length === 0, text: `Embedded ${r.embedded} chunk(s).${r.remaining ? ` ${r.remaining} still waiting; run again.` : ""}${r.errors.length ? ` ${r.errors[0]}` : ""}` });
        void invalidate();
      },
      onError: (e) => { setMsg({ ok: false, text: apiErrorMessage(e, "Embedding failed. Nothing was stored.") }); void invalidate(); },
    });
  };
  return (
    <article className="min-w-0 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5" data-testid={`card-source-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold [overflow-wrap:anywhere]"><Database className="h-4 w-4 shrink-0 text-royal" /> {s.name}</div>
          <div className="font-data mt-0.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">{s.sourceType.replace(/_/g, " ")}</div>
        </div>
        <KnowledgeStatusBadge status={s.approvalStatus} prefix="Source" testId={`status-source-${s.id}`} />
      </div>
      {s.licenceNotes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.licenceNotes}</p>}
      <dl className="font-data mt-3 grid grid-cols-4 gap-1.5 text-center text-[10.5px]">
        {(["pending", "approved", "rejected", "retired"] as const).map((k) => (
          <div key={k} className="rounded-xl bg-cream/70 px-1 py-1.5"><dt className="uppercase text-muted-foreground">{k}</dt><dd className="text-base font-bold text-foreground" data-testid={`count-source-${k}-${s.id}`}>{c[k]}</dd></div>
        ))}
      </dl>
      <div className="font-data mt-2 text-[11px] text-muted-foreground" data-testid={`text-source-embedding-${s.id}`}>
        {s.embeddedChunkCount}/{s.chunkCount} chunks embedded{s.awaitingEmbeddingCount ? ` · ${s.awaitingEmbeddingCount} approved chunk(s) waiting` : ""}
      </div>
      {s.approvalStatus !== "approved" && c.approved > 0 && (
        <p className="mt-2 rounded-xl bg-accent/15 p-2 text-xs text-amber-900">{c.approved} approved document(s) here are not used until this source is approved.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!deciding && <button type="button" className={cn(btn.ghost, "px-3 py-1.5 text-xs")} onClick={() => setDeciding(true)} data-testid={`button-decide-source-${s.id}`}>Change source status</button>}
        {canBulkApproveSyntheticDocs && (
          <button type="button" className={cn(btn.ghost, "px-3 py-1.5 text-xs")} onClick={() => { setDeciding(false); setBulkReviewOpen(true); setMsg(null); }} data-testid={`button-bulk-approve-documents-${s.id}`}>
            Review and approve all {c.pending} synthetic docs
          </button>
        )}
        {s.approvalStatus === "approved" && s.awaitingEmbeddingCount > 0 && (
          <button type="button" className={cn(btn.primary, "px-3 py-1.5 text-xs")} disabled={embed.isPending || !geminiConfigured} onClick={runEmbed} data-testid={`button-embed-source-${s.id}`}>
            <Layers className="h-3.5 w-3.5" /> {embed.isPending ? "Embedding..." : `Embed ${s.awaitingEmbeddingCount} waiting chunk(s)`}
          </button>
        )}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("mt-2 text-xs font-medium [overflow-wrap:anywhere]", msg.ok ? "text-navy" : "text-destructive")} data-testid={`status-embed-source-${s.id}`}>{msg.text}</p>}
      {deciding && <SourceDecisionForm s={s} onDone={() => setDeciding(false)} />}
      {canBulkApproveSyntheticDocs && bulkReviewOpen && <BulkSyntheticApprovalForm s={s} onDone={() => setBulkReviewOpen(false)} onSuccess={(approved) => setMsg({ ok: true, text: `Approved ${approved} synthetic document(s). No embeddings were created. Approve the source separately; embedding is a separate action.` })} />}
    </article>
  );
}

function BulkSyntheticApprovalForm({
  s,
  onDone,
  onSuccess,
}: {
  s: KnowledgeSource;
  onDone: () => void;
  onSuccess: (approved: number) => void;
}) {
  const approve = useApproveSyntheticKnowledgeDocuments();
  const invalidate = useInvalidateKnowledge();
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const pendingCount = s.documentCounts.pending;
  const ready = confirmed && notes.trim().length >= 10;

  const submit = () => {
    if (!ready) return;
    setErr(null);
    approve.mutate(
      { sourceId: s.id, data: { expectedPendingCount: pendingCount, notes: notes.trim() } },
      {
        onSuccess: (result) => {
          void invalidate();
          onSuccess(result.approvedCount);
          onDone();
        },
        onError: (e) => setErr(apiErrorMessage(e, "No approvals were recorded. Refresh and review the current source status.")),
      },
    );
  };

  return (
    <form
      className="mt-3 rounded-2xl border-2 border-royal/25 bg-cream/40 p-3"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      data-testid={`form-bulk-approve-documents-${s.id}`}
    >
      <div className="flex items-center justify-between text-sm font-bold">
        Bulk review: {pendingCount} synthetic documents
        <button type="button" onClick={onDone} aria-label="Cancel bulk approval" className="rounded-full p-1 hover:bg-mist"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        This approves every pending document in this source only. The server checks the count and confirms every document matches the reviewed English synthetic dataset. No embeddings are created or deleted. Source approval and any embedding work remain separate.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 accent-royal"
          data-testid={`checkbox-confirm-bulk-approval-${s.id}`}
        />
        <span>I reviewed all {pendingCount} documents and approve them as synthetic demo knowledge.</span>
      </label>
      <NotesField id={`bulk-approval-notes-${s.id}`} value={notes} onChange={setNotes} label="Review notes (saved for each document)" />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className={cn(btn.ghost, "px-4 py-2")} onClick={onDone}>Cancel</button>
        <button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={!ready || approve.isPending} data-testid={`button-submit-bulk-approval-${s.id}`}>
          {approve.isPending ? "Saving approvals..." : `Approve all ${pendingCount}`}
        </button>
      </div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{err}</p>}
    </form>
  );
}

function SourceDecisionForm({ s, onDone }: { s: KnowledgeSource; onDone: () => void }) {
  const decide = useDecideKnowledgeSource();
  const invalidate = useInvalidateKnowledge();
  const [decision, setDecision] = useState<KnowledgeSourceDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ok = decision && notes.trim().length >= 10;
  const submit = () => {
    if (!ok) return;
    setErr(null);
    decide.mutate({ sourceId: s.id, data: { decision, notes: notes.trim() } }, {
      onSuccess: () => { void invalidate(); onDone(); },
      onError: (e) => setErr(apiErrorMessage(e, "The source status was not changed.")),
    });
  };
  return (
    <form className="mt-3 rounded-2xl border-2 border-royal/25 bg-cream/40 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid={`form-source-${s.id}`}>
      <div className="flex items-center justify-between text-sm font-bold">Source status <button type="button" onClick={onDone} aria-label="Cancel" className="rounded-full p-1 hover:bg-mist"><X className="h-4 w-4" /></button></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup">
        {SOURCE_DECISIONS.filter((d) => d.id !== s.approvalStatus).map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={decision === d.id} onClick={() => setDecision(d.id)}
            className={cn("rounded-xl border-2 px-2 py-1.5 text-xs font-bold transition active:scale-[.97]", decision === d.id ? "border-navy bg-navy text-white" : "border-primary/15 text-navy hover:bg-mist")}
            data-testid={`radio-source-${d.id}-${s.id}`}>{d.label}</button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Anything other than approved stops the AI Mentor from retrieving this source. Stored embeddings are retained.</p>
      <NotesField id={`source-notes-${s.id}`} value={notes} onChange={setNotes} />
      <div className="mt-2 flex justify-end"><button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={!ok || decide.isPending} data-testid={`button-save-source-${s.id}`}>{decide.isPending ? "Saving..." : "Save"}</button></div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{err}</p>}
    </form>
  );
}

// ------------------------------------------------------------- add document

const MAX_TEXT = 100_000;

function AddDocumentForm({ data, onClose }: { data: KnowledgeOverview; onClose: () => void }) {
  const [, navigate] = useLocation();
  const create = useCreateKnowledgeDocument();
  const invalidate = useInvalidateKnowledge();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<ChatLanguage>("en");
  const [origin, setOrigin] = useState<KnowledgeDataOrigin>("SYNTHETIC");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const hasAdminSource = data.sources.some((s) => s.name === data.adminSourceName);
  const adminSource = data.sources.find((s) => s.name === data.adminSourceName);
  const options = data.sources.filter((s) => s.name !== data.adminSourceName);
  const ok = title.trim().length >= 3 && text.trim().length >= 50;

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (f.size > 400_000) { setErr("That file is too large. Use a text or Markdown file under 400 KB."); return; }
    const content = await f.text();
    setText(content.slice(0, MAX_TEXT));
    if (!title.trim()) {
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      setTitle((heading ?? f.name.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ")).slice(0, 200));
    }
  };

  const submit = () => {
    if (!ok) return;
    setErr(null);
    create.mutate({
      data: {
        sourceId: sourceId || (adminSource?.id ?? null),
        title: title.trim(),
        language,
        dataOrigin: origin,
        url: url.trim() || null,
        text,
      },
    }, {
      onSuccess: (d) => { void invalidate(); navigate(`/admin/knowledge/documents/${d.document.id}`); },
      onError: (e) => setErr(apiErrorMessage(e, "The document was not added.")),
    });
  };

  const field = "mt-1 w-full rounded-xl border-2 border-primary/15 bg-white p-2.5 text-sm outline-none focus:border-royal/60";
  return (
    <form className="rounded-[22px] border-2 border-royal/30 bg-white p-4 shadow-sm sm:p-5" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid="form-add-document">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-xl font-extrabold">Add a knowledge document</div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-mist" data-testid="button-close-add-document"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">It is stored as pending. Use the exact title of an existing document in the same source to add a new version; approving it retires the old one.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold">Source
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={field} data-testid="select-source">
            <option value="">{data.adminSourceName}{hasAdminSource ? "" : " (created now)"}</option>
            {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">Title
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))} className={field} placeholder="e.g. Data analyst pathway notes" data-testid="input-title" />
        </label>
        <label className="block text-xs font-bold">Language
          <select value={language} onChange={(e) => setLanguage(e.target.value as ChatLanguage)} className={field} data-testid="select-language">
            {(["en", "ms", "zh-CN"] as const).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
          </select>
        </label>
        <fieldset className="text-xs font-bold">
          <legend>Data origin</legend>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {([["SYNTHETIC", "Synthetic (fictional)"], ["SOURCE_ATTRIBUTED", "From a real source"]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={origin === v} onClick={() => setOrigin(v)}
                className={cn("rounded-xl border-2 px-2 py-2 text-xs font-bold", origin === v ? "border-navy bg-navy text-white" : "border-primary/15 text-navy hover:bg-mist")}
                data-testid={`button-origin-${v}`}>{l}</button>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-bold sm:col-span-2">Link (optional)
          <input value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} className={field} placeholder="https://" data-testid="input-url" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <label htmlFor="input-doc-text" className="text-xs font-bold">Text (Markdown or plain text)</label>
        <button type="button" className={cn(btn.ghost, "px-3 py-1.5 text-xs")} onClick={() => fileRef.current?.click()} data-testid="button-upload-file"><Upload className="h-3.5 w-3.5" /> Load .md / .txt file</button>
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-file" />
      </div>
      <textarea id="input-doc-text" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))} rows={10} className={cn(field, "font-mono text-[12.5px]")} placeholder="# Title&#10;&#10;Write the knowledge the AI Mentor may use..." data-testid="input-doc-text" />
      <span className={cn("font-data text-[10.5px]", text.trim().length > 0 && text.trim().length < 50 ? "text-destructive" : "text-muted-foreground")}>{text.length.toLocaleString()}/{MAX_TEXT.toLocaleString()}{text.trim().length > 0 && text.trim().length < 50 ? " · at least 50" : ""}</span>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={btn.ghost} onClick={onClose}>Cancel</button>
        <button type="submit" className={btn.primary} disabled={!ok || create.isPending} data-testid="button-submit-document">{create.isPending ? "Adding..." : "Add as pending"}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid="status-add-error">{err}</p>}
    </form>
  );
}

// ------------------------------------------------------------ document list

const TABS: { id: KnowledgeDocumentFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "retired", label: "Retired" },
  { id: "all", label: "All" },
];

function DocumentList({ sources }: { sources: KnowledgeSource[] }) {
  const [status, setStatus] = useState<KnowledgeDocumentFilter>("pending");
  const [sourceId, setSourceId] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [input]);
  const params = { status, sourceId: sourceId || undefined, search: search || undefined, page };
  const q = useListKnowledgeDocuments(params, { query: { queryKey: getListKnowledgeDocumentsQueryKey(params), placeholderData: (p) => p } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white p-1.5" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={status === t.id} onClick={() => { setStatus(t.id); setPage(1); }}
            className={cn("flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition active:scale-[.97]", status === t.id ? "bg-navy text-white" : "text-navy hover:bg-mist")}
            data-testid={`tab-docs-${t.id}`}>
            {t.label}
            <span className={cn("font-data rounded-full px-1.5 text-[10.5px]", status === t.id ? "bg-white/20" : "bg-mist")} data-testid={`count-docs-${t.id}`}>{q.data?.counts[t.id] ?? "-"}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-primary/15 bg-white px-3 py-2 focus-within:border-royal/60">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search documents</span>
          <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 100))} placeholder="Search titles" className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-testid="input-search-docs" />
        </label>
        <select value={sourceId} onChange={(e) => { setSourceId(e.target.value); setPage(1); }} className="min-w-0 rounded-2xl border-2 border-primary/15 bg-white px-3 py-2 text-sm sm:max-w-xs" aria-label="Filter by source" data-testid="select-filter-source">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {q.isError && <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-20 rounded-2xl" />)}</div>}
      {q.data && q.data.items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed bg-white/70 p-8 text-center" data-testid="status-empty-docs">
          <div className="font-display text-xl font-bold">Nothing here</div>
          <p className="mt-1 text-sm text-muted-foreground">{search || sourceId ? "No documents match these filters." : status === "pending" ? "No documents are waiting for review." : "No documents with this status."}</p>
        </div>
      )}
      {q.data && q.data.items.length > 0 && (
        <>
          <ul className={cn("space-y-2", q.isFetching && "opacity-70")}>
            {q.data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/knowledge/documents/${d.id}`} className="group flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 transition hover:ring-royal/40 active:scale-[.995]" data-testid={`row-doc-${d.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold [overflow-wrap:anywhere]">{d.title}</span>
                      <span className="font-data rounded bg-charcoal px-1.5 text-[9.5px] uppercase text-white" data-testid={`text-version-${d.id}`}>v{d.version}{d.versionCount > 1 ? ` of ${d.versionCount}` : ""}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <KnowledgeStatusBadge status={d.approvalStatus} testId={`status-doc-${d.id}`} />
                      {d.sourceStatus !== "approved" && <KnowledgeStatusBadge status={d.sourceStatus} prefix="Source" />}
                      <span className="font-data text-[10.5px] text-muted-foreground">{d.sourceName} · {LANGUAGE_LABEL[d.language] ?? d.language} · {d.dataOrigin === "SYNTHETIC" ? "synthetic" : "source-attributed"} · {d.embeddedChunkCount}/{d.chunkCount} embedded</span>
                    </div>
                    {d.lastDecision && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{docDecisionLabel(d.lastDecision.decision)} by {d.lastDecision.reviewerName} · {fmtDate(d.lastDecision.decidedAt)}{d.lastDecision.notes ? ` — ${d.lastDecision.notes}` : ""}</p>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-royal transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function Runs({ data }: { data: KnowledgeOverview }) {
  return (
    <section className="rounded-[22px] bg-white p-4 shadow-sm sm:p-5" data-testid="section-runs">
      <h2 className="font-bold">Recent ingestion and embedding runs</h2>
      <ul className="mt-2 divide-y">
        {data.recentRuns.map((r) => (
          <li key={r.id} className="py-2 text-xs" data-testid={`run-${r.id}`}>
            <div className="flex flex-wrap items-center gap-x-2">
              <span className={cn("font-data rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", r.status === "succeeded" ? "bg-mist text-navy" : r.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-accent/15 text-amber-800")}>{r.status}</span>
              <span className="font-semibold">{r.runType === "knowledge_embed" ? "Embedding" : "Ingest"}</span>
              <span className="text-muted-foreground">{r.sourceName ?? "—"} · {fmtDate(r.startedAt)}{r.triggeredByName ? ` · ${r.triggeredByName}` : " · CLI"}</span>
            </div>
            <div className="font-data mt-0.5 text-[10.5px] text-muted-foreground">{r.runType === "knowledge_embed" ? `${r.recordsUpdated} chunk(s) embedded` : `${r.recordsSeen} seen · ${r.recordsInserted} new · ${r.recordsUpdated} chunks embedded`}</div>
            {r.errorMessage && <p className="mt-0.5 line-clamp-2 text-destructive [overflow-wrap:anywhere]">{r.errorMessage}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
