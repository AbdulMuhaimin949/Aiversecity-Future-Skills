import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChartNoAxesColumnIncreasing, ChevronDown, Globe, Pencil, TrendingUp, UserPlus, Wrench } from "lucide-react";
import { useMatchRoles, type RoleMatch } from "@workspace/api-client-react";
import { DirectionBadge, ErrorState, Meter, PageHead, ResilienceBadge, ResilienceLegend, ScenarioSwitch, SDG_COLORS, SdgChip, Skel, btn } from "@/components/kit";
import { profileDisplayLabel, useTargetRole, useProfile, useScenario } from "@/lib/store";
import { SelectTargetButton } from "@/components/target-role";
import { RoleMetrics } from "@/components/role-pass-panel";
import { SdgIcon } from "@/components/sdg-icons";
import { TopSpotlight } from "@/components/top-spotlight";
import { CharcoalPill } from "@/components/pill";
import { cn } from "@/lib/utils";

export default function MatchesPage() {
  const [profile] = useProfile();
  const [scenario, setScenario] = useScenario();
  const m = useMatchRoles();
  const mutateRef = useRef(m.mutate);
  mutateRef.current = m.mutate;
  const prevRanks = useRef<Record<string, number>>({});
  const [moves, setMoves] = useState<Record<string, number>>({});
  const [nonce, setNonce] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [selectedSdg, setSelectedSdg] = useState<number | null>(null);
  const [, setLastRole] = useTargetRole();

  useEffect(() => {
    if (!profile) return;
    mutateRef.current(
      {
        data: {
          skills: profile.skills.map((s) => ({ skillId: s.skillId, proficiency: s.proficiency })),
          educationLevel: profile.educationLevel,
          yearsExperience: profile.yearsExperience,
          interestSectors: profile.interestSectors,
          weeklyLearningHours: profile.weeklyLearningHours,
          scenario,
          limit: 12,
        },
      },
      {
        onSuccess: (res) => {
          const mv: Record<string, number> = {};
          res.matches.forEach((x) => {
            const p = prevRanks.current[x.occupationId];
            if (p !== undefined) mv[x.occupationId] = p - x.rank;
          });
          setMoves(mv);
          prevRanks.current = Object.fromEntries(res.matches.map((x) => [x.occupationId, x.rank]));
        },
      },
    );
  }, [profile, scenario, nonce]);

  if (!profile)
    return (
      <div className="grid-paper mx-auto max-w-xl rounded-lg border bg-card p-10 text-center">
        <UserPlus className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display mt-4 text-3xl font-bold">First, tell us who you are today</h1>
        <p className="mt-2 text-muted-foreground">Matches are calculated from your skills, education and interests. It takes about a minute — or load a synthetic persona.</p>
        <Link href="/profile" className={btn.primary + " mt-6"} data-testid="link-go-profile">Build my profile <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );

  const res = m.data;
  return (
    <div>
      <PageHead step={2} kicker="Explainable role matches" title="Roles you could grow into">
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ScenarioSwitch value={scenario} onChange={setScenario} />
          <Link href="/profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" data-testid="link-edit-profile"><Pencil className="h-3 w-3" /> {profileDisplayLabel(profile.label) ?? "My profile"} · {profile.skills.length} skills</Link>
        </div>
      </PageHead>

      <p className="mb-6 rounded-md border bg-card p-3 text-sm text-muted-foreground" data-testid="text-experience-basis">
        Based on <strong className="text-foreground">{profile.yearsExperience} {profile.yearsExperience === 1 ? "year" : "years"}</strong> of professional work experience in your profile (not independently verified).{" "}
        {profile.yearsExperience < 1 ? "With under a year of work, entry-level roles fit best." : profile.yearsExperience >= 3 ? "With 3 or more years, mid-level and senior roles score higher on readiness." : "Mid-level roles are a stretch; entry and early mid-level roles fit best."}
        {profile.interestSectors.length > 0 && <> Roles in your {profile.interestSectors.length} chosen interest {profile.interestSectors.length === 1 ? "sector are" : "sectors are"} listed first.</>}
        {" "}You choose your target: select any role below, not only the top match.
      </p>

      {m.isError && <ErrorState message={(m.error as { data?: { error?: string } })?.data?.error} onRetry={() => setNonce((n) => n + 1)} />}

      {res && res.matches.length > 0 && (() => {
        const sdgSummary = Array.from(
          res.matches.reduce((acc, role) => {
            role.sdgs.forEach((s) => {
              const prev = acc.get(s.goalNumber);
              if (prev) prev.count += 1;
              else acc.set(s.goalNumber, { goalNumber: s.goalNumber, goalTitle: s.goalTitle, count: 1 });
            });
            return acc;
          }, new Map<number, { goalNumber: number; goalTitle: string; count: number }>()).values(),
        ).sort((a, b) => a.goalNumber - b.goalNumber);

        const filteredMatches = selectedSdg === null
          ? res.matches
          : res.matches.filter((x) => x.sdgs.some((s) => s.goalNumber === selectedSdg));
        const activeMatches = filteredMatches.length > 0 ? filteredMatches : res.matches;
        const top = activeMatches.slice(0, 3);
        const sel = top.find((x) => x.occupationId === selId) ?? top[0];
        const activeSdgNote = selectedSdg !== null
          ? sel.sdgs.find((s) => s.goalNumber === selectedSdg) ?? sel.sdgs[0]
          : sel.sdgs[0];

        return (
          <>
            {sdgSummary.length > 0 && (
              <div className="mb-6 rounded-2xl border bg-card p-3.5 shadow-2xs" data-testid="bar-sdg-filter">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Globe className="h-3.5 w-3.5" /> Filter choices by UN Sustainable Development Goal (SDG Impact)
                  </span>
                  {selectedSdg !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedSdg(null)}
                      className="text-xs font-semibold text-muted-foreground hover:text-primary"
                      data-testid="button-clear-sdg-filter"
                    >
                      Show all {res.matches.length} roles
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter role matches by UN SDG">
                  <button
                    type="button"
                    onClick={() => setSelectedSdg(null)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                      selectedSdg === null
                        ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                        : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    data-testid="button-sdg-filter-all"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>All Goals ({res.matches.length})</span>
                  </button>
                  {sdgSummary.map((g) => {
                    const active = selectedSdg === g.goalNumber;
                    return (
                      <button
                        key={g.goalNumber}
                        type="button"
                        onClick={() => setSelectedSdg(active ? null : g.goalNumber)}
                        className={cn(
                          "inline-flex items-center gap-2 overflow-hidden rounded-xl border pr-3 text-xs font-semibold transition",
                          active
                            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-xs"
                            : "bg-background text-foreground hover:bg-muted",
                        )}
                        data-testid={`button-sdg-filter-${g.goalNumber}`}
                      >
                        <span
                          className="font-data inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-white"
                          style={{ background: SDG_COLORS[g.goalNumber] ?? "#0B4F9E" }}
                        >
                          <SdgIcon goal={g.goalNumber} className="h-4 w-4 shrink-0 text-white" />
                          <span>SDG {g.goalNumber}</span>
                        </span>
                        <span className="max-w-[220px] truncate">{g.goalTitle}</span>
                        <span className="font-data text-[10px] text-muted-foreground">({g.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <motion.div key={`${scenario}-${sel.occupationId}-${selectedSdg ?? "all"}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mb-8">
              <TopSpotlight matches={top} selectedId={sel.occupationId} onSelect={(x) => setSelId(x.occupationId)}>
                <div className="min-w-0 space-y-5" data-testid="panel-spotlight">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {sel.rank === 1 && <CharcoalPill tilt={-3} testId="pill-top-match">TOP #01 MATCH</CharcoalPill>}
                        <span className="rounded-full border border-border bg-background px-3 py-1 font-data text-[11px] font-semibold text-foreground">
                          Match score · {Math.round(sel.score)}%
                        </span>
                        {sel.sdgs.map((s) => (
                          <SdgChip key={s.targetCode} sdg={s} compact />
                        ))}
                      </div>
                      <h2 className="font-display text-3xl font-extrabold leading-[0.98] md:text-5xl" data-testid="text-spotlight-title">{sel.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{sel.sector} · {sel.careerLevel}</span>
                        <DirectionBadge d={sel.direction} pct={sel.demandChangePct} />
                      </div>
                      {activeSdgNote && (
                        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-foreground" data-testid="text-spotlight-sdg-rationale">
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs"
                            style={{ background: SDG_COLORS[activeSdgNote.goalNumber] ?? "#0B4F9E" }}
                          >
                            <SdgIcon goal={activeSdgNote.goalNumber} className="h-4 w-4 text-white" />
                          </span>
                          <div className="min-w-0 leading-relaxed">
                            <span className="font-bold text-primary">UN SDG {activeSdgNote.goalNumber} ({activeSdgNote.targetCode} · {activeSdgNote.goalTitle}): </span>
                            <span className="text-muted-foreground">{activeSdgNote.rationale}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <RoleMetrics occupationId={sel.occupationId} demandPct={sel.demandChangePct} variant="cards" />
                    <details className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5" data-testid={`details-metric-context-${sel.occupationId}`}>
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        What these indicators mean
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        AI Risk describes how much AI may affect tasks, not a prediction of job loss. Job Safety describes how much AI may help with the work, not a guarantee of employment.
                      </p>
                    </details>
                    <div className="rounded-2xl bg-mist/60 p-3 sm:p-4">
                      <SummaryHighlights match={sel} view="spotlight" />
                    </div>
                    <MatchScoreBreakdown match={sel} />
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/pathway/${sel.occupationId}`} onClick={() => setLastRole({ id: sel.occupationId, title: sel.title })} className={btn.primary} data-testid="link-spotlight-pathway">Build my pathway <ArrowRight className="h-4 w-4" /></Link>
                      <SelectTargetButton occupationId={sel.occupationId} title={sel.title} />
                      <Link href={`/roles/${sel.occupationId}`} className={btn.ghost} data-testid="link-spotlight-detail">Role detail</Link>
                    </div>
                </div>
              </TopSpotlight>
            </motion.div>

            <motion.ol layout className={cn("space-y-3 transition-opacity", m.isPending && "opacity-50")}>
              <AnimatePresence initial={true}>
                {activeMatches.map((x, i) => (
                  <MatchCard key={x.occupationId} m={x} i={i} move={moves[x.occupationId]} />
                ))}
              </AnimatePresence>
            </motion.ol>
          </>
        );
      })()}

      {!res && m.isPending && <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-28" />)}</div>}

      {res && res.matches.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No roles matched. Try adding more skills or interest sectors on your profile.</div>
      )}

      {res && res.matches.length > 0 && <ResilienceLegend className="mt-6" />}

      {res && <p className="mt-8 rounded-md border-l-4 border-accent bg-card p-4 text-sm text-muted-foreground" data-testid="text-disclaimer">{res.disclaimer}</p>}
    </div>
  );
}

const PARTS = [
  { key: "skillOverlap", label: "Skill coverage" },
  { key: "proficiencyAlignment", label: "Proficiency alignment" },
  { key: "readiness", label: "Education, experience & seniority readiness" },
  { key: "interestAndTrend", label: "Interests, learning time & demand" },
] as const;

function SummaryHighlights({ match, view }: { match: RoleMatch; view: "spotlight" | "details" }) {
  const compact = view === "spotlight";
  return (
    <ul
      className={cn(
        "min-w-0 text-sm",
        compact ? "grid gap-3 sm:grid-cols-3 sm:gap-0" : "list-disc space-y-1 pl-4",
      )}
      aria-label={`${match.title} match highlights`}
      data-testid={`list-highlights-${view}-${match.occupationId}`}
    >
      {match.explanation.split("\n").map((highlight, index) => {
        const colon = highlight.indexOf(":");
        const label = colon >= 0 ? highlight.slice(0, colon) : "";
        const detail = colon >= 0 ? highlight.slice(colon + 1).trim() : highlight;
        const summary = compact ? compactInsight(label, detail) : undefined;
        const Icon = label === "Skills" ? Wrench : label === "Demand" ? TrendingUp : ChartNoAxesColumnIncreasing;
        return (
          <li
            key={`${index}-${label}`}
            className={cn(compact && "min-w-0 rounded-xl bg-white/70 p-3 sm:rounded-none sm:bg-transparent sm:px-3 sm:first:pl-1 sm:last:pr-1 sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:border-border/70")}
          >
            {compact ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>{label || "Insight"}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{summary?.text ?? detail}</p>
                {summary?.firstSuggestion && (
                  <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                    Start with {summary.firstSuggestion}
                  </p>
                )}
                {!!summary?.otherSuggestions?.length && (
                  <details className="mt-2 text-xs" data-testid={`details-more-insights-${match.occupationId}`}>
                    <summary className="cursor-pointer font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {summary.otherSuggestions.length} more suggestions
                    </summary>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
                      {summary.otherSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <>
                {label && <span className="font-semibold">{label}: </span>}
                {detail}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function compactInsight(label: string, detail: string): { text: string; firstSuggestion?: string; otherSuggestions?: string[] } {
  if (label === "Skills") {
    return { text: detail.replace(" and ", " · ").replace(/ on your profile\.?$/, "") };
  }
  if (label === "Demand") {
    return { text: detail.replace(" projected under ", " forecast · ").replace(/; this sector matches your interests\.?$/, " · matches your interests") };
  }
  if (label === "Next steps") {
    const [summary, suggestionText] = detail.split(/\s*·\s*Start with\s*/i);
    const suggestions = suggestionText?.split(/;\s*/).map((suggestion) => suggestion.trim()).filter(Boolean) ?? [];
    return {
      text: (summary ?? detail).replace(/about\s+(\d+)\s+learning hours?/i, "~$1 learning hours"),
      firstSuggestion: suggestions[0],
      otherSuggestions: suggestions.slice(1),
    };
  }
  return { text: detail };
}

function MatchScoreBreakdown({ match }: { match: RoleMatch }) {
  return (
    <section aria-label={`${match.title} match score breakdown`} data-testid={`score-breakdown-${match.occupationId}`}>
      <h3 className="text-base font-bold">How your match score is built</h3>
      <div className="mt-3 space-y-3.5">
        {PARTS.map(({ key, label }) => {
          const result = match.breakdown[key];
          const weight = match.breakdown.weights[key];
          const resultOutOf100 = Math.round(result * 100);
          const contribution = result * weight * 100;
          return (
            <div key={key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs sm:text-sm">
                <span className="font-semibold">{label}</span>
                <span className="font-data whitespace-nowrap text-primary">{resultOutOf100}%</span>
              </div>
              <Meter value={result} ariaLabel={`${label}: ${resultOutOf100} out of 100 factor score`} className="mt-1" />
            </div>
          );
        })}
      </div>
      <details className="mt-4 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5" data-testid={`details-score-method-${match.occupationId}`}>
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          View scoring details
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Each factor is scored from 0 to 100. Its weight is the share it contributes to your final match score.
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {PARTS.map(({ key, label }) => {
            const weight = match.breakdown.weights[key];
            const contribution = match.breakdown[key] * weight * 100;
            return (
              <li key={key} className="flex flex-wrap justify-between gap-x-3">
                <span>{label}</span>
                <span className="font-data">{Math.round(weight * 100)}% weight · {contribution.toFixed(1)} points</span>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

function MatchCard({ m, i, move }: { m: RoleMatch; i: number; move?: number }) {
  const [open, setOpen] = useState(false);
  const [, setLast] = useTargetRole();
  const reduce = useReducedMotion();
  return (
    <motion.li layout initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0, layout: { duration: 0 } } : { layout: { type: "spring", stiffness: 300, damping: 32 }, delay: i * 0.04 }} className="overflow-hidden rounded-2xl border bg-card" data-testid={`card-match-${m.occupationId}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`match-details-${m.occupationId}`}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:gap-6 md:p-5"
        data-testid={`button-expand-${m.occupationId}`}
      >
        <div className="font-data w-8 text-sm font-bold text-primary">{String(m.rank).padStart(2, "0")}</div>
        <ScoreRing score={m.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold leading-tight">{m.title}</span>
            {move !== undefined && move !== 0 && (
              <motion.span key={move} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("font-data rounded px-1.5 text-[11px] font-semibold", move > 0 ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground")}>
                {move > 0 ? `up ${move}` : `down ${-move}`}
              </motion.span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{m.sector} · {m.careerLevel}{m.mycolStatus === "CRITICAL_SHORTAGE" ? " · Talent shortage in Malaysia" : ""}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DirectionBadge d={m.direction} pct={m.demandChangePct} />
            <span className="text-xs text-muted-foreground">{m.metSkills.length} held · {m.gapSkills.length} gaps</span>
            {m.sdgs.slice(0, 2).map((s) => (
              <SdgChip key={s.targetCode} sdg={s} compact />
            ))}
          </div>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`match-details-${m.occupationId}`} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}>
            <div className="grid min-w-0 gap-6 border-t p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:p-5">
              <div className="space-y-5">
                <SummaryHighlights match={m} view="details" />
                <MatchScoreBreakdown match={m} />
                <details className="rounded-lg border bg-background/50 p-3" data-testid={`details-context-${m.occupationId}`}>
                  <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Context &amp; data sources ({m.sourceIds.length})
                  </summary>
                  <div className="mt-3 space-y-3 text-xs">
                    {m.sdgs.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 font-semibold">Related UN Sustainable Development Goals</h4>
                        <div className="flex flex-wrap gap-1.5">{m.sdgs.map((s) => <SdgChip key={s.targetCode} sdg={s} />)}</div>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold">Forecast evidence references</h4>
                      <p className="mt-0.5 text-muted-foreground">These IDs identify the sources used for the role’s forecast and evidence.</p>
                      {m.sourceIds.length > 0 ? (
                        <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={`${m.title} forecast evidence references`}>
                          {m.sourceIds.map((sourceId) => (
                            <li key={sourceId} className="font-data max-w-full break-all rounded bg-muted px-2 py-1">{sourceId}</li>
                          ))}
                        </ul>
                      ) : <p className="mt-1 text-muted-foreground">No source references are available.</p>}
                    </div>
                  </div>
                </details>
              </div>
              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap gap-2 rounded-xl bg-muted/40 p-3">
                  <Link href={`/pathway/${m.occupationId}`} onClick={() => setLast({ id: m.occupationId, title: m.title })} className={btn.primary} data-testid={`link-pathway-${m.occupationId}`}>Build my pathway <ArrowRight className="h-4 w-4" /></Link>
                  <SelectTargetButton occupationId={m.occupationId} title={m.title} />
                  <Link href={`/roles/${m.occupationId}`} className={btn.ghost} data-testid={`link-detail-${m.occupationId}`}>Role detail</Link>
                </div>
                <section aria-label="Skills to improve">
                  <h3 className="font-display text-lg font-bold">What to work on</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.gapSkills.length === 0
                      ? "Nice work. Your profile already meets every skill for this role."
                      : `${m.gapSkills.length} skill${m.gapSkills.length === 1 ? "" : "s"} to build. Required skills matter most, so start there.`}
                  </p>
                  <div className="mt-3 space-y-4">
                    <SkillGroup
                      title="Required skills to improve"
                      skills={m.gapSkills.filter((skill) => skill.importance === "Required")}
                      emptyMessage="Great, no required skill gaps."
                    />
                    <SkillGroup
                      title="Nice-to-have skills to improve"
                      skills={m.gapSkills.filter((skill) => skill.importance === "Preferred")}
                      emptyMessage="No nice-to-have skill gaps."
                    />
                  </div>
                </section>
                <details className="rounded-xl border bg-background/50 p-3" aria-label="Skills already on your profile" data-testid={`details-held-${m.occupationId}`}>
                  <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    What you already have ({m.metSkills.length})
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">Your level out of 5 is shown next to each skill. A skill can be on your profile and still need a higher level, as shown in the list above.</p>
                  {m.metSkills.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">No matching skills on your profile yet.</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {m.metSkills.map((skill) => (
                        <li key={skill.skillId} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
                          <span className="font-semibold">{skill.name}</span>
                          <span className="font-data text-muted-foreground">{Number.isInteger(skill.currentProficiency) ? skill.currentProficiency : skill.currentProficiency.toFixed(1)}/5</span>
                          <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", skill.importance === "Required" ? "bg-primary/10 text-primary" : "bg-accent/30 text-accent-foreground")}>{skill.importance === "Required" ? "Required" : "Nice-to-have"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

type SkillDetail = RoleMatch["metSkills"][number] | RoleMatch["gapSkills"][number];

function SkillGroup({ title, skills, emptyMessage }: { title: string; skills: SkillDetail[]; emptyMessage: string }) {
  return (
    <section>
      <h4 className="mb-2 flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="font-data rounded-full bg-muted px-1.5 py-0.5 normal-case tracking-normal">{skills.length}</span>
      </h4>
      {skills.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li key={skill.skillId} className="min-w-0 rounded-lg border bg-background/50 p-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{skill.name}</span>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    skill.importance === "Required" ? "bg-primary/10 text-primary" : "bg-accent/30 text-accent-foreground",
                  )}>{skill.importance}</span>
                  <ResilienceBadge r={skill.aiResilience} score={skill.resilienceScore} exposure={skill.avgExposure} augmentation={skill.avgAugmentation} compact />
                </div>
              </div>
              <SkillProficiency skill={skill} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkillProficiency({ skill }: { skill: SkillDetail }) {
  const current = Math.max(0, Math.min(5, skill.currentProficiency));
  const required = Math.max(0, Math.min(5, skill.requiredProficiency));
  const formatLevel = (level: number) => Number.isInteger(level) ? String(level) : level.toFixed(1);
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="text-xs text-muted-foreground">
        Current <span className="font-data font-semibold text-foreground">{formatLevel(skill.currentProficiency)}/5</span>
        <span className="mx-1.5">·</span>
        Required <span className="font-data font-semibold text-foreground">{formatLevel(skill.requiredProficiency)}/5</span>
      </p>
      <div
        className="flex shrink-0 gap-0.5"
        role="img"
        aria-label={`Current proficiency ${formatLevel(skill.currentProficiency)} out of 5; required proficiency ${formatLevel(skill.requiredProficiency)} out of 5`}
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const className = current < required
            ? level <= current ? "bg-primary" : level <= required ? "bg-destructive/60" : "bg-border"
            : level <= required ? "bg-primary" : level <= current ? "bg-primary/40" : "bg-border";
          return <span key={level} aria-hidden="true" className={cn("h-3.5 w-2.5 rounded-[2px]", className)} />;
        })}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const c = 2 * Math.PI * 22;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`${Math.round(score)} out of 100 match score`}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r="22" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <motion.circle cx="26" cy="26" r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
      </svg>
      <span className="font-data absolute inset-0 flex items-center justify-center text-sm font-semibold" aria-hidden="true" data-testid="text-score">{Math.round(score)}</span>
    </div>
  );
}
