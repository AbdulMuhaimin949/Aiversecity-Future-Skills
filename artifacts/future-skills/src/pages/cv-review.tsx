import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Search } from "lucide-react";
import { getListDemoCvsQueryKey, useGetCvReviewStatus, useListDemoCvs } from "@workspace/api-client-react";
import { ErrorState, PageHead, Skel } from "@/components/kit";
import { FictionBanner, Pager, apiErrorMessage } from "@/components/cv-kit";
import { cn } from "@/lib/utils";

export default function CvReviewPage() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [casesOnly, setCasesOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const status = useGetCvReviewStatus();
  const params = { search: search || undefined, reviewCasesOnly: casesOnly || undefined, page };
  const list = useListDemoCvs(params, { query: { queryKey: getListDemoCvsQueryKey(params), placeholderData: (p) => p } });

  return (
    <div className="space-y-6" data-testid="page-cv-review">
      <PageHead kicker="CV claim check" title="See how a human checks a CV">
        {status.data && (
          <div className="font-data flex gap-2 text-xs" data-testid="text-dataset-stats">
            <span className="rounded-full bg-white px-3 py-1.5">{status.data.demoCvCount} fictional CVs</span>
            <span className="rounded-full bg-mist px-3 py-1.5 text-navy">{status.data.reviewCaseCount} review cases</span>
          </div>
        )}
      </PageHead>

      <FictionBanner>AI may extract claims with quotes; a human reviewer makes every decision, and you can see the reasoning and appeal it.</FictionBanner>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-primary/15 bg-white px-3 py-2 focus-within:border-royal/60">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search CVs</span>
          <input value={input} onChange={(e) => setInput(e.target.value.slice(0, 100))} placeholder="Search by name, ID or role" className="min-w-0 flex-1 bg-transparent text-sm outline-none" data-testid="input-search-cvs" />
        </label>
        <button type="button" role="switch" aria-checked={casesOnly} onClick={() => { setCasesOnly((v) => !v); setPage(1); }}
          className={cn("inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-[.97]", casesOnly ? "bg-charcoal text-white" : "border-2 border-primary/20 bg-white text-navy")}
          data-testid="toggle-review-cases">
          <span className={cn("h-2.5 w-2.5 rounded-full", casesOnly ? "bg-sky" : "bg-mist")} /> Review cases only
        </button>
      </div>

      {list.isError && <ErrorState message={apiErrorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-32 rounded-2xl" />)}</div>}
      {list.data && list.data.items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed bg-white/70 p-8 text-center" data-testid="status-empty">
          <div className="font-display text-xl font-bold">No fictional CVs match</div>
          <p className="mt-1 text-sm text-muted-foreground">Try a shorter search or turn off the review-case filter.</p>
        </div>
      )}
      {list.data && list.data.items.length > 0 && (
        <>
          <ul className={cn("grid gap-3 md:grid-cols-2", list.isFetching && "opacity-70")}>
            {list.data.items.map((cv) => (
              <li key={cv.id}>
                <Link href={`/cv-review/${cv.id}`} className="group flex h-full flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-royal/40 active:scale-[.99]" data-testid={`card-cv-${cv.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-data text-[10.5px] text-muted-foreground">{cv.externalId} · fictional</div>
                      <div className="font-display truncate text-lg font-extrabold" data-testid={`text-candidate-${cv.id}`}>{cv.candidateName}</div>
                      <div className="truncate text-xs text-muted-foreground">{[cv.targetOccupation?.title, cv.education, cv.state, cv.yearsExperience != null ? `${cv.yearsExperience} yrs` : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-royal transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="font-data mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
                    <span className="rounded-full bg-mist px-2 py-0.5 text-navy">{cv.claimCount} claims</span>
                    <span className="rounded-full bg-cream px-2 py-0.5">{cv.pendingCount} awaiting</span>
                    <span className="rounded-full bg-cream px-2 py-0.5">{cv.decidedCount} decided</span>
                    {cv.reviewCaseCount > 0 && <span className="rounded-full border border-dashed border-navy/40 px-2 py-0.5 text-navy">{cv.reviewCaseCount} review cases</span>}
                    {cv.aiExtracted && <span className="rounded-full bg-charcoal px-2 py-0.5 text-white">AI extracted</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
