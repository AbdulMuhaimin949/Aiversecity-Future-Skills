import type { ReactNode } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import { ChevronLeft, ChevronRight, FileText, FlaskConical, KeyRound, LogIn, LogOut, Quote, ShieldAlert } from "lucide-react";
import { getGetReviewerMeQueryKey, useGetReviewerMe, type ClaimEvidence, type ClaimStatus, type ExtractionMethod, type ReviewerDecision, type AppealStatus, type ReviewerMe } from "@workspace/api-client-react";
import { btn, ErrorState, Skel } from "@/components/kit";
import { cn } from "@/lib/utils";

export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Nothing was changed."): string {
  const e = err as { data?: { error?: string } | null; status?: number; message?: string } | null;
  if (e?.data?.error) return e.data.error;
  if (e && typeof e.status !== "number") return "Could not reach the service. Check your connection and try again.";
  return fallback;
}
export function apiStatus(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : undefined;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

const STATUS: Record<ClaimStatus, { label: string; cls: string }> = {
  pending_review: { label: "Awaiting review", cls: "bg-mist text-navy border-royal/30" },
  evidence_sufficient: { label: "Evidence sufficient", cls: "bg-navy text-white border-navy" },
  more_evidence_requested: { label: "More evidence requested", cls: "bg-accent/20 text-amber-800 border-accent/60" },
  escalated: { label: "Escalated", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  accepted: { label: "Accepted", cls: "bg-navy text-white border-navy" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};
export function StatusBadge({ status, testId }: { status: ClaimStatus; testId?: string }) {
  const s = STATUS[status];
  return <span className={cn("font-data inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", s.cls)} data-testid={testId}>{s.label}</span>;
}

export const DECISIONS: { id: ReviewerDecision; label: string; hint: string }[] = [
  { id: "EVIDENCE_SUFFICIENT", label: "Evidence sufficient", hint: "The evidence supports the claim as written." },
  { id: "REQUEST_MORE_EVIDENCE", label: "Request more evidence", hint: "The claim may be true but the evidence does not show it yet." },
  { id: "ESCALATED", label: "Escalate", hint: "Needs a second, more senior look." },
];
export const decisionLabel = (d: ReviewerDecision) => DECISIONS.find((x) => x.id === d)?.label ?? d;

const APPEAL: Record<AppealStatus, string> = {
  submitted: "Submitted", under_review: "Under review", upheld: "Upheld", rejected: "Not upheld", withdrawn: "Withdrawn",
};
export function AppealBadge({ status, testId }: { status: AppealStatus; testId?: string }) {
  const open = status === "submitted" || status === "under_review";
  return (
    <span className={cn("font-data inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
      open ? "border-accent/60 bg-accent/15 text-amber-800" : status === "upheld" ? "border-royal bg-royal text-white" : "border-border bg-muted text-muted-foreground")} data-testid={testId}>
      Appeal: {APPEAL[status]}
    </span>
  );
}

export function ExtractionTag({ method, model }: { method: ExtractionMethod; model: string | null }) {
  const label = method === "synthetic_fixture" ? "From the demo dataset"
    : method === "ai_model" ? `Extracted by AI${model ? ` (${model})` : ""}`
    : method === "rule_based" ? "Rule-based extraction" : "Added manually";
  return <span className="font-data text-[10.5px] uppercase tracking-wide text-muted-foreground" data-testid="text-extraction-method">{label}</span>;
}

export function ReviewCaseTag() {
  return (
    <span className="font-data inline-flex rounded-full border border-dashed border-navy/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy" title="One of the dataset's curated review cases. No expected answer is shown; the reviewer decides." data-testid="tag-review-case">
      Curated review case
    </span>
  );
}

export function EvidenceItem({ ev }: { ev: ClaimEvidence }) {
  if (ev.kind === "cv_quote") {
    return (
      <li className="flex gap-2.5 rounded-xl border bg-cream/60 p-3" data-testid={`evidence-${ev.id}`}>
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-royal" />
        <div className="min-w-0">
          <div className="font-data mb-1 text-[10px] font-semibold uppercase tracking-wider text-navy">Verbatim from the CV text</div>
          <blockquote className="text-sm italic [overflow-wrap:anywhere]">"{ev.quote}"</blockquote>
          {ev.description && <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>}
        </div>
      </li>
    );
  }
  return (
    <li className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgba(24,25,28,0.03)_8px_16px)] p-3" data-testid={`evidence-${ev.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-data text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" data-testid={`text-placeholder-${ev.id}`}>Fictional placeholder · not a real document · never verified</span>
      </div>
      <div className="mt-1.5 flex items-start gap-2 text-sm">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <div className="font-semibold text-foreground/80">{ev.documentTitle ?? "Untitled simulated document"}</div>
          {ev.issuerName && <div className="text-xs text-muted-foreground">Fictional issuer: {ev.issuerName}</div>}
          {ev.description && <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>}
        </div>
      </div>
    </li>
  );
}

export function FictionBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-navy/30 bg-white p-4 text-sm" data-testid="banner-fictional">
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
      <div>
        <div className="font-bold">Demo only. Every CV here is fictional.</div>
        <p className="text-muted-foreground">Candidates, CV text and evidence are invented for this demo. Simulated documents are placeholders, not real credentials, and are never verified. {children}</p>
      </div>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-5 flex items-center justify-between gap-2" data-testid="pager">
      <button type="button" className={cn(btn.ghost, "px-3")} disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="button-prev-page"><ChevronLeft className="h-4 w-4" /> Prev</button>
      <span className="font-data text-xs text-muted-foreground" data-testid="text-page">Page {page} / {pages} · {total} total</span>
      <button type="button" className={cn(btn.ghost, "px-3")} disabled={page >= pages} onClick={() => onPage(page + 1)} data-testid="button-next-page">Next <ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export function SignOutButton() {
  const { signOut } = useClerk();
  return (
    <button type="button" className={cn(btn.ghost, "px-4 py-2")} onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" })} data-testid="button-sign-out">
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}

/** Renders children only for signed-in reviewers or administrators. */
export function ReviewerGate({ children }: { children: (me: ReviewerMe) => ReactNode }) {
  const me = useGetReviewerMe({ query: { queryKey: getGetReviewerMeQueryKey(), staleTime: 30_000 } });
  if (me.isLoading) return <div className="space-y-3"><Skel className="h-24" /><Skel className="h-64" /></div>;
  if (me.isError || !me.data) return <ErrorState message={apiErrorMessage(me.error)} onRetry={() => me.refetch()} />;
  if (!me.data.signedIn) return <SignedOutCard />;
  if (!me.data.isReviewer && !me.data.isAdmin) return <NotReviewerCard email={me.data.email} />;
  return <>{children(me.data)}</>;
}

export function SignedOutCard() {
  return (
    <div className="mx-auto max-w-xl rounded-[22px] bg-white p-6 text-center shadow-sm sm:p-8" data-testid="card-signed-out">
      <KeyRound className="mx-auto h-10 w-10 text-royal" />
      <h2 className="font-display mt-3 text-2xl font-extrabold">Team sign in</h2>
      <p className="mt-2 text-sm text-muted-foreground">The reviewer desk is for approved reviewers and admins. Only admins can manage the knowledge base. Applicants do not need an account; use the CV check instead.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/sign-in" className={btn.primary} data-testid="link-sign-in"><LogIn className="h-4 w-4" /> Team sign in</Link>
        <Link href="/cv-review" className={btn.ghost} data-testid="link-cv-check">Go to CV check</Link>
      </div>
    </div>
  );
}

export function NotReviewerCard({ email }: { email: string | null }) {
  return (
    <div className="mx-auto max-w-xl rounded-[22px] bg-white p-6 text-center shadow-sm sm:p-8" data-testid="card-not-reviewer">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
      <h2 className="font-display mt-3 text-2xl font-extrabold">Reviewer access not granted</h2>
      <p className="mt-2 text-sm text-muted-foreground">You are signed in{email ? <> as <span className="font-data font-semibold text-foreground" data-testid="text-email">{email}</span></> : null}, but an administrator must grant you the reviewer role before you can view the queue or decide claims.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <SignOutButton />
      </div>
    </div>
  );
}
