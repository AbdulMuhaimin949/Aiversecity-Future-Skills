import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { getGetReviewerMeQueryKey, useGetReviewerMe, type KnowledgeDocumentDecision, type KnowledgeStatus, type ReviewerMe } from "@workspace/api-client-react";
import { ErrorState, Skel } from "@/components/kit";
import { SignedOutCard, SignOutButton, apiErrorMessage } from "@/components/cv-kit";
import { cn } from "@/lib/utils";

/** Renders children only for signed-in admins. */
export function AdminGate({ children }: { children: (me: ReviewerMe) => ReactNode }) {
  const me = useGetReviewerMe({ query: { queryKey: getGetReviewerMeQueryKey(), staleTime: 30_000 } });
  if (me.isLoading) return <div className="space-y-3"><Skel className="h-24" /><Skel className="h-64" /></div>;
  if (me.isError || !me.data) return <ErrorState message={apiErrorMessage(me.error)} onRetry={() => me.refetch()} />;
  if (!me.data.signedIn) return <SignedOutCard />;
  if (!me.data.isAdmin) return <NotAdminCard email={me.data.email} />;
  return <>{children(me.data)}</>;
}

export function NotAdminCard({ email }: { email: string | null }) {
  return (
    <div className="mx-auto max-w-xl rounded-[22px] bg-white p-6 text-center shadow-sm sm:p-8" data-testid="card-not-admin">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
      <h2 className="font-display mt-3 text-2xl font-extrabold">Admins only</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You are signed in{email ? <> as <span className="font-data font-semibold text-foreground" data-testid="text-email">{email}</span></> : null}, but managing the AI Mentor knowledge base needs the admin role.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <SignOutButton />
      </div>
    </div>
  );
}

const STATUS: Record<KnowledgeStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "border-accent/60 bg-accent/15 text-amber-800" },
  approved: { label: "Approved", cls: "border-navy bg-navy text-white" },
  rejected: { label: "Rejected", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  retired: { label: "Retired", cls: "border-border bg-muted text-muted-foreground" },
};

export function KnowledgeStatusBadge({ status, prefix, testId }: { status: KnowledgeStatus; prefix?: string; testId?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("font-data inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", s.cls)} data-testid={testId}>
      {prefix ? `${prefix}: ` : ""}{s.label}
    </span>
  );
}

export const DOC_DECISIONS: { id: KnowledgeDocumentDecision; label: string; hint: string }[] = [
  { id: "approved", label: "Approve", hint: "Allow the AI Mentor to use it once embedded. Older approved versions with the same title are retired." },
  { id: "needs_changes", label: "Needs changes", hint: "Keep it pending and note what must change." },
  { id: "rejected", label: "Reject", hint: "Never retrieve this text. Stored embeddings are retained." },
  { id: "retired", label: "Retire", hint: "Stop retrieving it (for example, it is out of date). Stored embeddings are retained." },
];
export const docDecisionLabel = (d: KnowledgeDocumentDecision) =>
  ({ approved: "Approved", needs_changes: "Needs changes", rejected: "Rejected", retired: "Retired" })[d];

export function NotesField({ id, value, onChange, label = "Notes (kept in the audit trail)" }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const len = value.trim().length;
  return (
    <>
      <label htmlFor={id} className="mt-3 block text-xs font-bold">{label}</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value.slice(0, 2000))} rows={3} className="mt-1 w-full rounded-xl border-2 border-primary/15 bg-white p-2.5 text-sm outline-none focus:border-royal/60" data-testid={`input-${id}`} />
      <span className={cn("font-data text-[10.5px]", len > 0 && len < 10 ? "text-destructive" : "text-muted-foreground")}>{len}/2000{len > 0 && len < 10 ? " · at least 10" : ""}</span>
    </>
  );
}

export const LANGUAGE_LABEL: Record<string, string> = { ms: "Bahasa Melayu", en: "English", "zh-CN": "简体中文" };

/** Invalidates every knowledge-admin query (overview, document lists, document details). */
export function useInvalidateKnowledge() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/admin/knowledge") });
}
