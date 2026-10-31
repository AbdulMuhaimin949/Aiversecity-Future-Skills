import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, History, ScrollText } from "lucide-react";
import {
  getGetReviewerCvQueryKey, getGetReviewQueueQueryKey, useDecideClaim, useGetReviewerCv, useResolveAppeal,
  type ReviewerAppeal, type ReviewerClaim, type ReviewerDecision,
} from "@workspace/api-client-react";
import { btn, ErrorState, Skel } from "@/components/kit";
import { CharcoalPill } from "@/components/pill";
import {
  AppealBadge, DECISIONS, EvidenceItem, ExtractionTag, FictionBanner, NotReviewerCard, ReviewCaseTag, ReviewerGate, SignedOutCard, StatusBadge,
  apiErrorMessage, apiStatus, decisionLabel, fmtDate,
} from "@/components/cv-kit";
import { cn } from "@/lib/utils";

export default function ReviewerCvPage() {
  return (
    <div className="space-y-6" data-testid="page-reviewer-cv">
      <ReviewerGate>{() => <Workspace />}</ReviewerGate>
    </div>
  );
}

function Workspace() {
  const { cvId = "" } = useParams<{ cvId: string }>();
  const q = useGetReviewerCv(cvId, { query: { queryKey: getGetReviewerCvQueryKey(cvId), enabled: !!cvId, retry: false } });

  if (q.isLoading) return <div className="space-y-4"><Skel className="h-24" /><Skel className="h-96" /></div>;
  if (q.isError || !q.data) {
    const s = apiStatus(q.error);
    if (s === 401) return <SignedOutCard />;
    if (s === 403) return <NotReviewerCard email={null} />;
    return <ErrorState message={apiErrorMessage(q.error, "This CV could not be loaded.")} onRetry={() => q.refetch()} />;
  }
  const { cv, claims, auditTrail } = q.data;

  return (
    <>
      <Link href="/reviewer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline" data-testid="link-back-queue"><ArrowLeft className="h-4 w-4" /> Back to queue</Link>
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CharcoalPill tilt={2}>Review workspace</CharcoalPill>
          <span className="font-data text-xs font-semibold uppercase tracking-[0.18em] text-primary">{cv.externalId}</span>
        </div>
        <h1 className="font-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[0.98] [overflow-wrap:anywhere]" data-testid="text-candidate-name">{cv.candidateName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{[cv.targetOccupation?.title, cv.education, cv.state, cv.yearsExperience != null ? `${cv.yearsExperience} years` : null].filter(Boolean).join(" · ")}</p>
      </header>
      <FictionBanner>Decide on the evidence shown. Review cases have no answer key here.</FictionBanner>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <div className="font-data mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy">CV text (fictional)</div>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl bg-cream/70 p-3 font-sans text-[13px] leading-relaxed [overflow-wrap:anywhere]" data-testid="text-cv">{cv.cvText}</pre>
          </div>
          <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-5" data-testid="panel-audit">
            <div className="flex items-center gap-2 font-bold"><ScrollText className="h-4 w-4 text-royal" /> Audit trail</div>
            {auditTrail.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No activity yet.</p> : (
              <ol className="mt-2 max-h-[40vh] space-y-2 overflow-auto border-l-2 border-mist pl-3">
                {auditTrail.map((a) => (
                  <li key={a.id} className="text-xs" data-testid={`audit-${a.id}`}>
                    <div className="font-data text-[10px] uppercase text-muted-foreground">{fmtDate(a.createdAt)} · {a.action} · {a.actorName ?? a.actorType}</div>
                    <div className="[overflow-wrap:anywhere]">{a.summary}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <h2 className="font-display text-2xl font-extrabold">Claims <span className="font-data text-base text-muted-foreground">({claims.length})</span></h2>
          {claims.length === 0 && <div className="rounded-2xl border-2 border-dashed bg-white/70 p-6 text-center text-sm text-muted-foreground">No claims on this CV.</div>}
          {claims.map((c) => <ClaimPanel key={c.id} claim={c} cvId={cvId} />)}
        </section>
      </div>
    </>
  );
}

function useInvalidate(cvId: string) {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: getGetReviewerCvQueryKey(cvId) }),
    qc.invalidateQueries({ queryKey: getGetReviewQueueQueryKey() }),
    qc.invalidateQueries({ queryKey: [getGetReviewQueueQueryKey()[0]] }),
  ]);
}

function ClaimPanel({ claim: c, cvId }: { claim: ReviewerClaim; cvId: string }) {
  const openAppeal = c.appeals.find((a) => a.status === "submitted" || a.status === "under_review");
  const current = c.decisions[0]?.decision;
  return (
    <article className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5" data-testid={`card-claim-${c.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data rounded-md bg-charcoal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{c.claimType}</span>
        <StatusBadge status={c.status} testId={`status-claim-${c.id}`} />
        {c.reviewCaseId && <ReviewCaseTag />}
        {c.externalId && <span className="font-data text-[10px] text-muted-foreground">{c.externalId}</span>}
      </div>
      <p className="mt-2.5 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]" data-testid={`text-claim-${c.id}`}>{c.claimText}</p>
      <div className="mt-1 flex flex-wrap gap-x-3"><ExtractionTag method={c.extractionMethod} model={c.extractionModel} />{c.skill && <span className="text-xs text-navy">Skill: {c.skill.name}</span>}</div>

      <div className="mt-3">
        <div className="font-data mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence ({c.evidence.length})</div>
        {c.evidence.length === 0 ? <p className="text-xs text-muted-foreground">No evidence attached.</p> : <ul className="space-y-2">{c.evidence.map((e) => <EvidenceItem key={e.id} ev={e} />)}</ul>}
      </div>

      {c.appeals.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="font-data text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Appeals ({c.appeals.length})</div>
          {c.appeals.map((a) => <AppealRow key={a.id} a={a} />)}
        </div>
      )}

      {c.decisions.length > 0 && (
        <div className="mt-3">
          <div className="font-data mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><History className="h-3 w-3" /> Decision history</div>
          <ol className="space-y-1.5">
            {c.decisions.map((d, i) => (
              <li key={d.id} className={cn("rounded-xl p-2.5 text-sm", i === 0 ? "bg-mist/70" : "bg-cream/60")} data-testid={`decision-${d.id}`}>
                <div className="flex flex-wrap items-center gap-x-2 font-semibold">{decisionLabel(d.decision)}{d.viaAppeal && <span className="text-xs font-normal text-royal">via appeal</span>}</div>
                <p className="[overflow-wrap:anywhere]">{d.rationale}</p>
                <div className="font-data text-[10.5px] text-muted-foreground">{d.reviewerName} · {fmtDate(d.decidedAt)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {openAppeal ? <ResolveForm appeal={openAppeal} current={current} cvId={cvId} /> : <DecideForm claimId={c.id} cvId={cvId} />}
    </article>
  );
}

function AppealRow({ a }: { a: ReviewerAppeal }) {
  return (
    <div className="rounded-xl border p-2.5" data-testid={`appeal-${a.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-data text-[11px] font-semibold">{a.applicantLabel} · {a.language}</span>
        <AppealBadge status={a.status} />
      </div>
      <p className="mt-1 text-sm [overflow-wrap:anywhere]">{a.reason}</p>
      <div className="font-data text-[10.5px] text-muted-foreground">Sent {fmtDate(a.submittedAt)}{a.resolvedAt ? ` · resolved ${fmtDate(a.resolvedAt)}${a.resolvedByName ? ` by ${a.resolvedByName}` : ""}` : ""}</div>
      {a.resolution && <p className="mt-1 rounded-lg bg-cream p-2 text-xs [overflow-wrap:anywhere]">{a.resolution}</p>}
    </div>
  );
}

function Rationale({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const len = value.trim().length;
  return (
    <>
      <label htmlFor={id} className="mt-3 block text-xs font-bold">Rationale (shown to the applicant)</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value.slice(0, 2000))} rows={3} className="mt-1 w-full rounded-xl border-2 border-primary/15 bg-white p-2.5 text-sm outline-none focus:border-royal/60" data-testid={`input-${id}`} />
      <span className={cn("font-data text-[10.5px]", len > 0 && len < 10 ? "text-destructive" : "text-muted-foreground")}>{len}/2000{len > 0 && len < 10 ? " · at least 10" : ""}</span>
    </>
  );
}

function DecisionPicker({ value, onChange, name, exclude }: { value: ReviewerDecision | null; onChange: (d: ReviewerDecision) => void; name: string; exclude?: ReviewerDecision }) {
  return (
    <div className="mt-2 grid gap-1.5 sm:grid-cols-3" role="radiogroup">
      {DECISIONS.filter((d) => d.id !== exclude).map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={value === d.id} onClick={() => onChange(d.id)} title={d.hint}
          className={cn("rounded-xl border-2 px-2.5 py-2 text-left text-xs font-bold transition active:scale-[.97]", value === d.id ? "border-navy bg-navy text-white" : "border-primary/15 text-navy hover:bg-mist")}
          data-testid={`radio-${name}-${d.id}`}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

function DecideForm({ claimId, cvId }: { claimId: string; cvId: string }) {
  const decide = useDecideClaim();
  const invalidate = useInvalidate(cvId);
  const [decision, setDecision] = useState<ReviewerDecision | null>(null);
  const [rationale, setRationale] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ok = decision && rationale.trim().length >= 10;
  const submit = () => {
    if (!ok) return;
    setErr(null);
    decide.mutate({ claimId, data: { decision, rationale: rationale.trim() } }, {
      onSuccess: () => { setDecision(null); setRationale(""); void invalidate(); },
      onError: (e) => { setErr(apiErrorMessage(e, "The decision was not saved.")); if (apiStatus(e) === 409) void invalidate(); },
    });
  };
  return (
    <form className="mt-4 rounded-2xl border-2 border-royal/25 bg-cream/40 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid={`form-decide-${claimId}`}>
      <div className="text-sm font-bold">Record a decision</div>
      <DecisionPicker value={decision} onChange={setDecision} name={`decision-${claimId}`} />
      <Rationale id={`rationale-${claimId}`} value={rationale} onChange={setRationale} />
      <div className="mt-2 flex justify-end"><button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={!ok || decide.isPending} data-testid={`button-decide-${claimId}`}>{decide.isPending ? "Saving..." : "Save decision"}</button></div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid={`status-decide-error-${claimId}`}>{err}</p>}
    </form>
  );
}

function ResolveForm({ appeal, current, cvId }: { appeal: ReviewerAppeal; current?: ReviewerDecision; cvId: string }) {
  const resolve = useResolveAppeal();
  const invalidate = useInvalidate(cvId);
  const [outcome, setOutcome] = useState<"upheld" | "rejected" | null>(null);
  const [newDecision, setNewDecision] = useState<ReviewerDecision | null>(null);
  const [rationale, setRationale] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ok = outcome && rationale.trim().length >= 10 && (outcome === "rejected" || (newDecision && newDecision !== current));
  const submit = () => {
    if (!ok) return;
    setErr(null);
    resolve.mutate({ appealId: appeal.id, data: { outcome, rationale: rationale.trim(), newDecision: outcome === "upheld" ? newDecision ?? undefined : undefined } }, {
      onSuccess: () => { void invalidate(); },
      onError: (e) => setErr(apiErrorMessage(e, "The appeal was not resolved.")),
    });
  };
  return (
    <form className="mt-4 rounded-2xl border-2 border-accent/60 bg-accent/5 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid={`form-resolve-${appeal.id}`}>
      <div className="text-sm font-bold">Resolve the open appeal first</div>
      <p className="text-xs text-muted-foreground">New decisions are locked while an appeal is open. Current decision: {current ? decisionLabel(current) : "none"}.</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(["upheld", "rejected"] as const).map((o) => (
          <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)}
            className={cn("rounded-xl border-2 px-2.5 py-2 text-xs font-bold transition active:scale-[.97]", outcome === o ? "border-navy bg-navy text-white" : "border-primary/15 text-navy hover:bg-mist")}
            data-testid={`button-outcome-${o}-${appeal.id}`}>
            {o === "upheld" ? "Uphold: change decision" : "Reject: keep decision"}
          </button>
        ))}
      </div>
      {outcome === "upheld" && (<><div className="mt-3 text-xs font-bold">New decision</div><DecisionPicker value={newDecision} onChange={setNewDecision} name={`new-${appeal.id}`} exclude={current} /></>)}
      <Rationale id={`resolution-${appeal.id}`} value={rationale} onChange={setRationale} />
      <div className="mt-2 flex justify-end"><button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={!ok || resolve.isPending} data-testid={`button-resolve-${appeal.id}`}>{resolve.isPending ? "Saving..." : "Resolve appeal"}</button></div>
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid={`status-resolve-error-${appeal.id}`}>{err}</p>}
    </form>
  );
}
