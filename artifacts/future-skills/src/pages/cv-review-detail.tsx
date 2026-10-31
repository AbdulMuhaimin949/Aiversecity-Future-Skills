import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Scale, Sparkles, UserCheck } from "lucide-react";
import {
  getGetDemoCvQueryKey, getGetCvReviewStatusQueryKey, useExtractDemoCvClaims, useGetCvReviewStatus, useGetDemoCv, useSubmitClaimAppeal,
  type ApplicantClaim,
} from "@workspace/api-client-react";
import { btn, ErrorState, Skel } from "@/components/kit";
import { CharcoalPill } from "@/components/pill";
import { AppealBadge, EvidenceItem, ExtractionTag, FictionBanner, ReviewCaseTag, StatusBadge, apiErrorMessage, decisionLabel, fmtDate } from "@/components/cv-kit";
import { ensureGuestToken } from "@/lib/guest";
import { cn } from "@/lib/utils";

export default function CvReviewDetailPage() {
  const { cvId = "" } = useParams<{ cvId: string }>();
  const qc = useQueryClient();
  const q = useGetDemoCv(cvId, { query: { queryKey: getGetDemoCvQueryKey(cvId), enabled: !!cvId } });
  const status = useGetCvReviewStatus({ query: { queryKey: getGetCvReviewStatusQueryKey(), staleTime: 30_000 } });
  const extract = useExtractDemoCvClaims();
  const [extractError, setExtractError] = useState<string | null>(null);

  if (q.isLoading) return <div className="space-y-4"><Skel className="h-28" /><div className="grid gap-4 lg:grid-cols-2"><Skel className="h-96" /><Skel className="h-96" /></div></div>;
  if (q.isError || !q.data) return <ErrorState message={apiErrorMessage(q.error, "This fictional CV was not found.")} onRetry={() => q.refetch()} />;
  const { cv, claims } = q.data;
  const available = status.data?.aiExtractionAvailable ?? false;

  const runExtract = () => {
    ensureGuestToken();
    setExtractError(null);
    extract.mutate({ cvId }, {
      onSuccess: (d) => qc.setQueryData(getGetDemoCvQueryKey(cvId), d),
      onError: (e) => setExtractError(apiErrorMessage(e, "AI extraction failed. Nothing was changed.")),
    });
  };

  return (
    <div className="space-y-6" data-testid="page-cv-review-detail">
      <Link href="/cv-review" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> All fictional CVs
      </Link>
      <header className="fade-up">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CharcoalPill tilt={-3}>Fictional CV</CharcoalPill>
          <span className="font-data text-xs font-semibold uppercase tracking-[0.18em] text-primary" data-testid="text-external-id">{cv.externalId}</span>
        </div>
        <h1 className="font-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[0.98] [overflow-wrap:anywhere]" data-testid="text-candidate-name">{cv.candidateName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{[cv.targetOccupation?.title, cv.education, cv.state, cv.yearsExperience != null ? `${cv.yearsExperience} years experience` : null].filter(Boolean).join(" · ")}</p>
      </header>

      <FictionBanner>{cv.provenance}</FictionBanner>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <div className="font-data mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-navy">CV text (fictional)</div>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-cream/70 p-3 font-sans text-[13px] leading-relaxed [overflow-wrap:anywhere]" data-testid="text-cv">{cv.cvText}</pre>
          </div>
          <div className="mt-4 rounded-[22px] bg-white p-4 shadow-sm sm:p-5" data-testid="panel-extract">
            <div className="flex items-center gap-2 font-bold"><Bot className="h-4 w-4 text-royal" /> AI claim extraction</div>
            <p className="mt-1 text-xs text-muted-foreground">
              AI{status.data ? ` (${status.data.extractionModel})` : ""} only pulls claims out of the CV with verbatim quotes. It decides nothing; a human reviewer checks every claim.
            </p>
            {status.data && !available && (
              <p className="mt-2 rounded-xl border border-accent/50 bg-accent/10 p-2.5 text-xs" data-testid="status-extract-unavailable">AI extraction is switched off here because no AI key is configured. The claims from the demo dataset are still reviewable.</p>
            )}
            <button type="button" className={cn(btn.primary, "mt-3 w-full")} disabled={!available || extract.isPending} onClick={runExtract} data-testid="button-extract">
              <Sparkles className="h-4 w-4" /> {extract.isPending ? "Extracting claims..." : cv.aiExtracted ? "Run AI extraction again" : "Extract claims with AI"}
            </button>
            {extractError && <p role="alert" className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs font-medium text-destructive" data-testid="status-extract-error">{extractError}</p>}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Claims <span className="font-data text-base text-muted-foreground">({claims.length})</span></h2>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserCheck className="h-3.5 w-3.5" /> Humans decide</span>
          </div>
          {claims.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed bg-white/70 p-6 text-center text-sm text-muted-foreground" data-testid="status-no-claims">No claims recorded for this CV yet.{available ? " Try the AI extraction." : ""}</div>
          )}
          {claims.map((c, i) => <ClaimCard key={c.id} claim={c} cvId={cvId} index={i} />)}
        </section>
      </div>
    </div>
  );
}

function ClaimCard({ claim: c, cvId, index }: { claim: ApplicantClaim; cvId: string; index: number }) {
  const qc = useQueryClient();
  const appeal = useSubmitClaimAppeal();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const len = reason.trim().length;

  const submit = () => {
    if (len < 10 || len > 2000) return;
    ensureGuestToken();
    setErr(null);
    appeal.mutate({ claimId: c.id, data: { reason: reason.trim(), language: "en" } }, {
      onSuccess: () => { setOpen(false); setReason(""); void qc.invalidateQueries({ queryKey: getGetDemoCvQueryKey(cvId) }); },
      onError: (e) => setErr(apiErrorMessage(e, "Your appeal could not be sent. Nothing was changed.")),
    });
  };

  return (
    <article className="fade-up rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} data-testid={`card-claim-${c.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data rounded-md bg-charcoal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{c.claimType}</span>
        <StatusBadge status={c.status} testId={`status-claim-${c.id}`} />
        {c.reviewCase && <ReviewCaseTag />}
      </div>
      <p className="mt-2.5 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]" data-testid={`text-claim-${c.id}`}>{c.claimText}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ExtractionTag method={c.extractionMethod} model={c.extractionModel} />
        {c.skill && <span className="text-xs text-navy">Skill: {c.skill.name}</span>}
      </div>

      <div className="mt-3">
        <div className="font-data mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence ({c.evidence.length})</div>
        {c.evidence.length === 0 ? <p className="text-xs text-muted-foreground">No evidence attached.</p> : <ul className="space-y-2">{c.evidence.map((e) => <EvidenceItem key={e.id} ev={e} />)}</ul>}
      </div>

      <div className="mt-3 rounded-xl bg-mist/60 p-3" data-testid={`panel-decision-${c.id}`}>
        <div className="flex items-center gap-1.5 text-xs font-bold text-navy"><Scale className="h-3.5 w-3.5" /> Reviewer decision</div>
        {c.latestDecision ? (
          <>
            <div className="mt-1 text-sm font-semibold">{decisionLabel(c.latestDecision.decision)}{c.latestDecision.viaAppeal && <span className="ml-2 text-xs font-normal text-royal">changed after appeal</span>}</div>
            <p className="mt-1 text-sm [overflow-wrap:anywhere]" data-testid={`text-rationale-${c.id}`}>{c.latestDecision.rationale}</p>
            <div className="font-data mt-1 text-[10.5px] text-muted-foreground">{fmtDate(c.latestDecision.decidedAt)} · by a human reviewer</div>
          </>
        ) : <p className="mt-1 text-sm text-muted-foreground">No decision yet. A human reviewer will look at this claim.</p>}
      </div>

      {c.myAppeal && (
        <div className="mt-3 rounded-xl border p-3" data-testid={`panel-my-appeal-${c.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold">Your appeal</span><AppealBadge status={c.myAppeal.status} testId={`status-my-appeal-${c.id}`} /></div>
          <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{c.myAppeal.reason}</p>
          <div className="font-data mt-1 text-[10.5px] text-muted-foreground">Sent {fmtDate(c.myAppeal.submittedAt)}{c.myAppeal.resolvedAt ? ` · resolved ${fmtDate(c.myAppeal.resolvedAt)}` : ""}</div>
          {c.myAppeal.resolution && <p className="mt-2 rounded-lg bg-cream p-2 text-sm [overflow-wrap:anywhere]" data-testid={`text-appeal-resolution-${c.id}`}><span className="font-semibold">Reviewer's response: </span>{c.myAppeal.resolution}</p>}
        </div>
      )}

      {c.canAppeal && !open && (
        <button type="button" className={cn(btn.ghost, "mt-3 px-4 py-2")} onClick={() => setOpen(true)} data-testid={`button-open-appeal-${c.id}`}>Disagree? Appeal this decision</button>
      )}
      {c.canAppeal && open && (
        <form className="mt-3 rounded-xl border-2 border-royal/30 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid={`form-appeal-${c.id}`}>
          <label htmlFor={`appeal-${c.id}`} className="text-sm font-bold">Why should a reviewer look again?</label>
          <p className="text-xs text-muted-foreground">A different human reviewer will read your reason. Be specific (10 to 2000 characters).</p>
          <textarea id={`appeal-${c.id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={4} className="mt-2 w-full rounded-xl border-2 border-primary/15 bg-white p-2.5 text-sm outline-none focus:border-royal/60" data-testid={`input-appeal-${c.id}`} />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className={cn("font-data text-[10.5px]", len > 0 && len < 10 ? "text-destructive" : "text-muted-foreground")}>{len}/2000{len > 0 && len < 10 ? " · at least 10" : ""}</span>
            <div className="flex gap-2">
              <button type="button" className={cn(btn.ghost, "px-3 py-2")} onClick={() => { setOpen(false); setErr(null); }} data-testid={`button-cancel-appeal-${c.id}`}>Cancel</button>
              <button type="submit" className={cn(btn.primary, "px-4 py-2")} disabled={len < 10 || appeal.isPending} data-testid={`button-submit-appeal-${c.id}`}>{appeal.isPending ? "Sending..." : "Send appeal"}</button>
            </div>
          </div>
          {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid={`status-appeal-error-${c.id}`}>{err}</p>}
        </form>
      )}
    </article>
  );
}
