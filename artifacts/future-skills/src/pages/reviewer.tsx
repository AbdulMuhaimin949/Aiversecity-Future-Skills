import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { ArrowRight, MessageSquareWarning, Search } from "lucide-react";
import { getGetReviewQueueQueryKey, useGetReviewQueue, type ReviewQueueFilter } from "@workspace/api-client-react";
import { ErrorState, PageHead, Skel } from "@/components/kit";
import { Pager, ReviewCaseTag, ReviewerGate, SignOutButton, StatusBadge, apiErrorMessage, fmtDate } from "@/components/cv-kit";
import { cn } from "@/lib/utils";

const TABS: { id: ReviewQueueFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "review_cases", label: "Review cases" },
  { id: "appeals", label: "Appeals" },
  { id: "decided", label: "Decided" },
];

export default function ReviewerPage() {
  return (
    <div className="space-y-6" data-testid="page-reviewer">
      <ReviewerGate>{(me) => <Queue email={me.email} displayName={me.displayName} />}</ReviewerGate>
    </div>
  );
}

function Queue({ email, displayName }: { email: string | null; displayName: string | null }) {
  const { user } = useUser();
  const [filter, setFilter] = useState<ReviewQueueFilter>("pending");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [input]);

  const params = { filter, search: search || undefined, page };
  const q = useGetReviewQueue(params, { query: { queryKey: getGetReviewQueueQueryKey(params), placeholderData: (p) => p } });
  const name = displayName ?? user?.firstName ?? email;

  return (
    <>
      <PageHead kicker="Reviewer desk" title="Claim review queue">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-data rounded-full bg-white px-3 py-1.5 text-xs" data-testid="text-reviewer-name">{name}</span>
          <SignOutButton />
        </div>
      </PageHead>
      <p className="-mt-4 max-w-3xl text-sm text-muted-foreground">All CVs are fictional demo data. You decide each claim on its evidence alone; review cases carry no expected answer. Every decision and rationale is visible to the applicant (your name is not).</p>

      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white p-1.5" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={filter === t.id} onClick={() => { setFilter(t.id); setPage(1); }}
            className={cn("flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition active:scale-[.97]", filter === t.id ? "bg-navy text-white" : "text-navy hover:bg-mist")}
            data-testid={`tab-${t.id}`}>
            {t.label}
            <span className={cn("font-data rounded-full px-1.5 text-[10.5px]", filter === t.id ? "bg-white/20" : "bg-mist")} data-testid={`count-${t.id}`}>{q.data?.counts[t.id] ?? "-"}</span>
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-2xl border-2 border-primary/15 bg-white px-3 py-2 focus-within:border-royal/60">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search queue</span>
        <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 100))} placeholder="Search candidate, CV ID or claim text" className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-testid="input-search-queue" />
      </label>

      {q.isError && <ErrorState message={apiErrorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-20 rounded-2xl" />)}</div>}
      {q.data && q.data.items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed bg-white/70 p-8 text-center" data-testid="status-empty-queue">
          <div className="font-display text-xl font-bold">Nothing here</div>
          <p className="mt-1 text-sm text-muted-foreground">{search ? "No claims match that search." : "This part of the queue is clear."}</p>
        </div>
      )}
      {q.data && q.data.items.length > 0 && (
        <>
          <ul className={cn("space-y-2", q.isFetching && "opacity-70")}>
            {q.data.items.map((it) => (
              <li key={it.claimId}>
                <Link href={`/reviewer/cvs/${it.cvId}`} className="group flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 transition hover:ring-royal/40 active:scale-[.995]" data-testid={`row-claim-${it.claimId}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-data text-[10.5px] text-muted-foreground">{it.cvExternalId}</span>
                      <span className="text-sm font-bold">{it.candidateName}</span>
                      <span className="font-data rounded bg-charcoal px-1.5 text-[9.5px] uppercase text-white">{it.claimType}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm [overflow-wrap:anywhere]">{it.claimText}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={it.status} />
                      {it.reviewCase && <ReviewCaseTag />}
                      {it.openAppealCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800"><MessageSquareWarning className="h-3 w-3" /> {it.openAppealCount} open appeal</span>}
                      <span className="font-data text-[10.5px] text-muted-foreground">{it.evidenceCount} evidence{it.lastDecisionAt ? ` · last ${fmtDate(it.lastDecisionAt)}` : ""}</span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-royal transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
