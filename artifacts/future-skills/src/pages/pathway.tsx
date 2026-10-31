import { useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Check, ExternalLink, UserPlus, ArrowRight } from "lucide-react";
import { useBuildPathway } from "@workspace/api-client-react";
import { ErrorState, Meter, PageHead, SdgChip, Skel, VerifyBadge, btn } from "@/components/kit";
import { useDoneSteps, useTargetRole, usePathwaySdgs, useProfile } from "@/lib/store";
import { RoleMetrics, RolePassPanel } from "@/components/role-pass-panel";
import { TopSpotlight, useTopMatches } from "@/components/top-spotlight";
import { CharcoalPill } from "@/components/pill";
import { JobDescriptionCard } from "@/components/job-description-card";
import { cn } from "@/lib/utils";
import { MotionSection } from "@/components/motion";
import { SyntheticLabsPanel } from "@/components/synthetic-demo";

export default function PathwayPage() {
  const { occupationId = "" } = useParams<{ occupationId: string }>();
  const [profile] = useProfile();
  const [done, setDone] = useDoneSteps(occupationId);
  const [, setSdgs] = usePathwaySdgs();
  const b = useBuildPathway();
  const top = useTopMatches();
  const [, nav] = useLocation();
  const [, setLastRole] = useTargetRole();
  const setTargetRef = useRef(setLastRole);
  setTargetRef.current = setLastRole;
  const runRef = useRef(b.mutate);
  runRef.current = b.mutate;
  const setSdgsRef = useRef(setSdgs);
  setSdgsRef.current = setSdgs;

  const run = () => {
    if (!profile) return;
    runRef.current(
      { data: { occupationId, skills: profile.skills.map((s) => ({ skillId: s.skillId, proficiency: s.proficiency })), weeklyLearningHours: profile.weeklyLearningHours } },
      { onSuccess: (p) => { setSdgsRef.current(p.sdgContribution); setTargetRef.current({ id: occupationId, title: p.title }); } },
    );
  };
  const runStable = useRef(run);
  runStable.current = run;
  useEffect(() => { runStable.current(); }, [occupationId, profile]);

  if (!profile)
    return (
      <div className="grid-paper mx-auto max-w-xl rounded-lg border bg-card p-10 text-center">
        <UserPlus className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display mt-4 text-3xl font-bold">A pathway needs a starting point</h1>
        <p className="mt-2 text-muted-foreground">Save a profile first so we can skip what you already know.</p>
        <Link href="/profile" className={btn.primary + " mt-6"} data-testid="link-go-profile">Build my profile <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );

  const p = b.data;
  const todo = p?.steps.filter((s) => !s.alreadyCovered) ?? [];
  const doneCount = todo.filter((s) => done.includes(s.order)).length;
  const hoursDone = todo.filter((s) => done.includes(s.order)).reduce((a, s) => a + s.hours, 0);
  const toggle = (o: number) => setDone(done.includes(o) ? done.filter((x) => x !== o) : [...done, o]);

  return (
    <div>
      <Link href="/matches" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> Back to matches</Link>
      <PageHead step={3} kicker="Reskilling pathway" title={p ? `Your route to ${p.title}` : "Building your route..."}>
        {p && (
            <div className="font-data grid min-w-0 grid-cols-3 gap-px overflow-hidden rounded-md border bg-border text-center">
            {[[`${Math.round(p.currentScore)}`, "match now"], [`${p.totalHours}h`, "learning"], [`${p.estimatedWeeks}wk`, `at ${p.weeklyLearningHours}h/wk`]].map(([v, l]) => (
              <div key={l} className="min-w-0 bg-card px-2 py-2 sm:px-4"><div className="text-xl font-semibold">{v}</div><div className="text-[10px] leading-tight text-muted-foreground">{l}</div></div>
            ))}
          </div>
        )}
      </PageHead>

      {p && (() => {
        const t3 = top.matches.slice(0, 3);
        const mine = top.matches.find((x) => x.occupationId === occupationId);
        const rank = t3.findIndex((x) => x.occupationId === occupationId);
        return (
          <div className="mb-8" data-testid="section-pathway-pass">
            {t3.length > 0 ? (
              <TopSpotlight matches={t3} selectedId={occupationId} onSelect={(x) => { setLastRole({ id: x.occupationId, title: x.title }); nav(`/pathway/${x.occupationId}`); }}>
                <PassRow occupationId={occupationId} mine={mine} rank={rank} score={p.currentScore} demand={mine?.demandChangePct} title={p.title} />
              </TopSpotlight>
            ) : (
              <div className="rounded-[26px] bg-royal p-3"><div className="rounded-[18px] bg-white p-4 sm:p-6"><PassRow occupationId={occupationId} mine={mine} rank={-1} score={p.currentScore} demand={undefined} title={p.title} /></div></div>
            )}
          </div>
        );
      })()}

      {b.isError && <ErrorState message={(b.error as { data?: { error?: string } })?.data?.error} onRetry={run} />}
      {b.isPending && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-28" />)}</div>}

      {p && !b.isPending && (
        <MotionSection className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-5 rounded-md border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><span className="font-semibold">Your progress</span><span className="font-data">{doneCount}/{todo.length} steps · {hoursDone}h</span></div>
              <Meter value={todo.length ? doneCount / todo.length : 1} className="mt-2 h-2" />
            </div>
            <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-border">
              {p.steps.map((s, i) => {
                const isDone = s.alreadyCovered || done.includes(s.order);
                return (
                  <motion.li key={s.order} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="relative pl-14" data-testid={`card-step-${s.order}`}>
                    <button
                      disabled={s.alreadyCovered}
                      onClick={() => toggle(s.order)}
                      aria-label={isDone ? "Mark not done" : "Mark done"}
                      data-testid={`button-toggle-step-${s.order}`}
                      className={cn("font-data absolute left-0 top-3 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all", isDone ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}
                    >
                      {isDone ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="h-5 w-5" /></motion.span> : s.order}
                    </button>
                    <div className={cn("rounded-lg border bg-card p-4 transition-opacity", isDone && "opacity-70")}>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-data rounded bg-muted px-1.5 py-0.5">Week {s.startWeek}{s.endWeek !== s.startWeek ? `–${s.endWeek}` : ""}</span>
                        <span className="font-data">{s.hours}h</span>
                        <span className={cn("font-data font-semibold", s.resource.cost === 0 ? "text-primary" : "")}>{s.resource.cost === 0 ? `Free · ${s.resource.currency} 0` : `${s.resource.currency} ${s.resource.cost.toFixed(2)}`}</span>
                        <VerifyBadge status={s.resource.verificationStatus} />
                        {s.alreadyCovered && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">Already covered</span>}
                      </div>
                      <div className="font-display mt-2 text-lg font-bold leading-tight">{s.resource.title}</div>
                      <div className="text-xs text-muted-foreground">{s.resource.provider} · {s.resource.deliveryMode} · {s.resource.level} · {s.resource.sourceId}</div>
                      <div className="mt-3 flex flex-wrap gap-1">{s.targetSkills.map((t) => <span key={t.skillId} className="rounded-sm border px-1.5 py-0.5 text-xs">{t.name}</span>)}</div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <SdgChip sdg={s.sdg} compact />
                        <a href={s.resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary" data-testid={`link-resource-${s.order}`}>Open course <ExternalLink className="h-3.5 w-3.5" /></a>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
            {p.steps.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No catalogue steps needed — your profile already covers this role's mapped skills.</div>}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-lg border border-destructive/30 bg-card p-5">
              <h3 className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4 text-destructive" /> Gaps with no free course yet</h3>
              {p.uncoveredGaps.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Every gap is covered by a catalogue resource.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">We did not invent courses for these. Ask a career advisor or employer about on-the-job options.</p>
                  <div className="mt-3 flex flex-wrap gap-1">{p.uncoveredGaps.map((g) => <span key={g.skillId} className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{g.name}</span>)}</div>
                </>
              )}
            </div>
            <SyntheticLabsPanel skillIds={[...p.uncoveredGaps.map((g) => g.skillId), ...todo.flatMap((s) => s.targetSkills.map((t) => t.skillId))]} />
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold">SDG contribution of this path</h3>
              <ul className="mt-3 space-y-3">
                {p.sdgContribution.map((s) => <li key={s.targetCode}><SdgChip sdg={s} /><p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p></li>)}
              </ul>
              <Link href="/sdgs" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary" data-testid="link-sdgs-pathway">See the SDG map <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <p className="rounded-md border-l-4 border-accent bg-card p-4 text-xs text-muted-foreground" data-testid="text-disclaimer">{p.disclaimer}</p>
          </aside>
        </MotionSection>
      )}
    </div>
  );
}

function PassRow({ occupationId, mine, rank, score, demand, title }: { occupationId: string; mine?: import("@workspace/api-client-react").RoleMatch; rank: number; score: number; demand?: number; title: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <RolePassPanel occupationId={occupationId} match={mine} fallbackScore={score} topRank={rank === 0 ? 1 : undefined} />
      <div className="min-w-0 space-y-5">
        {rank >= 0 ? <CharcoalPill tilt={2} testId="pill-pathway-rank">{`Your #${rank + 1} match`}</CharcoalPill> : <CharcoalPill tilt={2}>Pathway role</CharcoalPill>}
        <h2 className="font-display text-3xl font-extrabold leading-[0.98] md:text-5xl">{title}</h2>
        {demand !== undefined ? <RoleMetrics occupationId={occupationId} demandPct={demand} /> : <p className="text-sm text-muted-foreground">Flip the pass to see the required skills you already hold, the SDGs this role serves and its source barcode.</p>}
        <JobDescriptionCard occupationId={occupationId} />
      </div>
    </div>
  );
}
