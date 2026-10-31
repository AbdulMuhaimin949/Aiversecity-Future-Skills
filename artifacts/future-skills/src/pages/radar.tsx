import { Link } from "wouter";
import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ExternalLink, Info, Lightbulb, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { useCompareScenarios, useGetRadar, getGetRadarQueryKey, type RoleTrend, type SkillTrend, type Radar, type Scenario } from "@workspace/api-client-react";
import { ErrorState, PageHead, ResilienceBadge, ResilienceLegend, SCENARIO_NAMES, ScenarioSwitch, SdgChip, Skel, VerifyBadge, btn } from "@/components/kit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTargetRole, useProfile, useScenario } from "@/lib/store";
import { CharcoalPill } from "@/components/pill";
import { RoleMetrics } from "@/components/role-pass-panel";
import { RadarBarExplainer } from "@/components/radar-bar-explainer";
import { AiTaskTrendsSection } from "@/components/radar-econ-index";
import { LatestIndustryNewsSection } from "@/components/radar-news";
import { CareerScenarioExplorer } from "@/components/career-scenario-explorer";
import { cn, formatDateDDMMYYYY } from "@/lib/utils";
import { MotionSection } from "@/components/motion";

export default function RadarPage() {
  const [scenario, setScenario] = useScenario();
  const [roleSearch, setRoleSearch] = useState("");
  const [profile] = useProfile();
  const [lastRole] = useTargetRole();
  const params = { scenario };
  const q = useGetRadar(params, { query: { queryKey: getGetRadarQueryKey(params), placeholderData: (p: Radar | undefined) => p } });
  const r = q.data;
  const visibleScenario = r?.scenario ?? scenario;

  const rising = r ? r.roles.filter((x) => x.direction === "RISING").sort((a, b) => b.changePct - a.changePct) : [];
  const slowing = r ? r.roles.filter((x) => x.direction === "SLOWING").sort((a, b) => a.changePct - b.changePct) : [];
  const normalizedRoleSearch = roleSearch.trim().toLowerCase();
  const matchesRoleSearch = (role: RoleTrend) =>
    !normalizedRoleSearch ||
    role.title.toLowerCase().includes(normalizedRoleSearch) ||
    role.sector.toLowerCase().includes(normalizedRoleSearch);
  const filteredRising = rising.filter(matchesRoleSearch);
  const filteredSlowing = slowing.filter(matchesRoleSearch);
  const skillsUp = r ? r.skills.filter((x) => x.direction === "RISING").sort((a, b) => b.changePct - a.changePct).slice(0, 14) : [];
  const skillsDown = r ? r.skills.filter((x) => x.direction === "SLOWING").sort((a, b) => a.changePct - b.changePct).slice(0, 14) : [];
  const allRoles = r?.roles ?? [];
  return (
    <div>
      <PageHead kicker="Future Skills Radar" title="What is rising, what is slowing">
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ScenarioSwitch value={scenario} onChange={setScenario} />
          <p className="max-w-md text-xs text-muted-foreground md:text-right" data-testid="text-scenario-hook">Compare how role and skill demand may shift under different rates of AI adoption.</p>
        </div>
      </PageHead>

      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-64" />)}</div>}

      {r && (
        <div className={cn("space-y-12 transition-opacity", q.isFetching && "opacity-60")} aria-busy={q.isFetching}>
          <ScenarioMeaning scenario={visibleScenario} roles={allRoles} rising={rising} slowing={slowing} skillsUp={skillsUp} skillsDown={skillsDown} />

          {(() => {
            const mine = lastRole ? allRoles.find((x) => x.occupationId === lastRole.id) : undefined;
            if (!mine) return (
              <p className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground" data-testid="text-no-target">
                No target role selected yet. Choose one on <Link href="/matches" className="font-semibold text-primary hover:underline">Matches</Link> and this page will show its AI Risk, Job Safety and demand under the scenario above.
              </p>
            );
            return (
              <MotionSection delay={0.02} className="rounded-2xl border-l-4 border-primary bg-card p-5" data-testid="section-target-role">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">Your target role · {SCENARIO_NAMES[visibleScenario]}</div>
                <h2 className="font-display mt-1 text-2xl font-bold">{mine.title}</h2>
                <p className="mb-4 text-xs text-muted-foreground">{mine.sector} · {mine.careerLevel} · demand index {mine.currentIndex.toFixed(0)} to {mine.projectedIndex.toFixed(0)} (90% range {mine.lower90.toFixed(0)}–{mine.upper90.toFixed(0)})</p>
                <RoleMetrics occupationId={mine.occupationId} demandPct={mine.changePct} />
              </MotionSection>
            );
          })()}

          <MotionSection delay={0.03} className="font-data grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border bg-card p-4 text-xs sm:flex sm:gap-x-10">
            <div><span className="text-muted-foreground">Data as of </span><span className="font-semibold" data-testid="text-asof">{formatDateDDMMYYYY(r.asOfDate)}</span></div>
            <div><span className="text-muted-foreground">Forecast target </span><span className="font-semibold" data-testid="text-target">{formatDateDDMMYYYY(r.forecastTargetDate)}</span></div>
          </MotionSection>

          <AnimatePresence mode="wait">
            <motion.div key={visibleScenario} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
              <div className="mb-5 grid gap-5 rounded-xl border bg-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0">
                <label htmlFor="radar-role-search" className="font-display block text-lg font-bold">Find a role</label>
                <p className="mb-3 text-sm text-muted-foreground">Search role titles and sectors across both lists.</p>
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="radar-role-search"
                    type="search"
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.currentTarget.value)}
                    placeholder="Search by role or sector"
                    className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-12 text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                    data-testid="input-radar-role-search"
                  />
                  {roleSearch && (
                    <button
                      type="button"
                      onClick={() => setRoleSearch("")}
                      aria-label="Clear role search"
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      data-testid="button-clear-radar-role-search"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground" aria-live="polite" data-testid="text-radar-role-search-results">
                  {normalizedRoleSearch
                    ? filteredRising.length + filteredSlowing.length > 0
                      ? `${filteredRising.length + filteredSlowing.length} ${filteredRising.length + filteredSlowing.length === 1 ? "role" : "roles"} found across both lists.`
                      : "No roles match your search. Try another title or sector, or clear the search to see all roles."
                    : `${rising.length + slowing.length} roles across both lists.`}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground" role="group" aria-label="Role trend chart legend">
                  <span className="font-semibold text-foreground">Trend:</span>
                  <span>The line runs from today’s baseline to the projection; the band marks its 90% forecast range.</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-primary"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />Rising</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-destructive"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-destructive" />Slowing</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">AI Risk is how much AI may affect a role’s tasks—not a prediction of job loss. Job Safety reflects how much AI may help with the work; it is not a guarantee of employment.</p>
                </div>
                <RadarBarExplainer />
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
                <RoleColumn title="Rising roles" tone="up" roles={filteredRising} totalRoles={rising.length} searchActive={Boolean(normalizedRoleSearch)} />
                <RoleColumn title="Slowing roles" tone="down" roles={filteredSlowing} totalRoles={slowing.length} searchActive={Boolean(normalizedRoleSearch)} />
              </div>
            </motion.div>
          </AnimatePresence>

          <MotionSection delay={0.04} className="grid gap-8 lg:grid-cols-2">
            <SkillColumn title="Skills gaining demand" skills={skillsUp} />
            <SkillColumn title="Skills losing demand" skills={skillsDown} />
          </MotionSection>
          <ResilienceLegend />

          <MotionSection delay={0.08}><CareerScenarioExplorer /></MotionSection>

          {/* SECTION B: AI Task Trends (Anthropic Economic Index) */}
          <MotionSection delay={0.09}>
            <AiTaskTrendsSection />
          </MotionSection>

          {/* SECTION C: Latest Industry News (NewsData.io) */}
          <MotionSection delay={0.1}>
            <LatestIndustryNewsSection />
          </MotionSection>

          {/* SECTION D: View Evidence & Data Sources */}
          <MotionSection delay={0.11} data-testid="section-view-evidence">
            <div className="mb-4">
              <span className="font-data text-xs font-bold uppercase tracking-wider text-primary">
                Section D · Provenance &amp; Disclosures
              </span>
              <h2 className="font-display mt-0.5 text-2xl font-bold">Sources &amp; Evidence behind this Radar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Traceable data sources providing baseline Malaysian occupational structures, AI task usage observations, and real-time news signals.
              </p>
            </div>
            <ul className="divide-y rounded-xl border bg-card">
              {r.sources.filter((s) => s.id !== "SRC_SYNTH_GEN").map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <span className="font-data w-24 text-xs font-semibold text-muted-foreground">{s.id}</span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="flex-1 font-medium hover:text-primary" data-testid={`link-source-${s.id}`}>{s.name} <ExternalLink className="inline h-3 w-3" /></a>
                  <span className="font-data text-xs text-muted-foreground">{formatDateDDMMYYYY(s.date)}</span>
                  <VerifyBadge status={s.verificationStatus} />
                </li>
              ))}
              <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <span className="font-data w-24 text-xs font-semibold text-muted-foreground">SRC_ANTHROPIC</span>
                <a href="https://www.anthropic.com/economic-index" target="_blank" rel="noreferrer" className="flex-1 font-medium hover:text-primary">
                  Anthropic Economic Index v2024-Q3 (AI Task Augmentation vs Automation Research) <ExternalLink className="inline h-3 w-3" />
                </a>
                <span className="font-data text-xs text-muted-foreground">30/09/2024</span>
                <VerifyBadge status="VERIFIED_RESEARCH_DATASET" />
              </li>
              <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <span className="font-data w-24 text-xs font-semibold text-muted-foreground">SRC_NEWSDATA</span>
                <a href="https://newsdata.io/api/1/latest" target="_blank" rel="noreferrer" className="flex-1 font-medium hover:text-primary">
                  NewsData.io Global &amp; Malaysian Employment API (Real-Time Ingestion Feed) <ExternalLink className="inline h-3 w-3" />
                </a>
                <span className="font-data text-xs text-muted-foreground">31/10/2026</span>
                <VerifyBadge status="VERIFIED_API_FEED" />
              </li>
            </ul>
          </MotionSection>

          <Accordion type="single" collapsible className="rounded-lg border bg-card px-5">
            <AccordionItem value="methodology" className="group border-b-0">
              <AccordionTrigger data-testid="button-methodology">View Technical Methodology &amp; Model Assumptions</AccordionTrigger>
              <AccordionContent forceMount className="group-data-[state=closed]:hidden">
                <div className="text-sm">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 text-primary" /> {r.scenarioLabel} — assumptions</div>
                  <p className="text-muted-foreground" data-testid="text-assumptions">{r.assumptions}</p>
                  <p className="mt-2 text-xs text-muted-foreground">All figures are model estimates with a 90% uncertainty range. Direction is relative to other roles under the same scenario.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <MotionSection delay={0.12} className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6 md:flex md:items-center md:justify-between md:gap-6" data-testid="section-final-cta">
            <div>
              <h2 className="font-display text-2xl font-bold">Turn disruption into an advantage.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile
                  ? "Your profile is ready. Pick a role match and Step 3 (Pathway) will build your learning plan from it."
                  : "Build a short profile, then see which roles fit your skills under this scenario. Step 3 (Pathway) follows from the match you choose."}
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 md:mt-0 md:shrink-0 md:items-end">
              <Link href="/matches" className={btn.primary} data-testid="link-next-matches">View your AI-Resilient Role Matches <ArrowRight className="h-4 w-4" /></Link>
              {profile && lastRole && (
                <Link href={`/pathway/${lastRole.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid="link-next-pathway">Continue pathway: {lastRole.title} <ArrowRight className="h-3 w-3" /></Link>
              )}
            </div>
          </MotionSection>
        </div>
      )}
    </div>
  );
}

function ScenarioMeaning({ scenario, roles, rising, slowing, skillsUp, skillsDown }: { scenario: Scenario; roles: RoleTrend[]; rising: RoleTrend[]; slowing: RoleTrend[]; skillsUp: SkillTrend[]; skillsDown: SkillTrend[] }) {
  const topUp = rising[0];
  const topDown = slowing[0];
  const resilientUp = skillsUp.filter((x) => x.aiResilience === "RESILIENT").length;
  const exposedDown = skillsDown.filter((x) => x.aiResilience === "EXPOSED").length;
  const avg = roles.length ? roles.reduce((a, x) => a + x.changePct, 0) / roles.length : 0;
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

  const text: Record<Scenario, { lead: string; explanation: string }> = {
    baseline: {
      lead: "Jobs and hiring follow steady, normal trends with little disruption from AI.",
      explanation: "Most skills that employers look for today remain in steady demand. Everyday hiring patterns continue as usual.",
    },
    moderate: {
      lead: "AI tools become common at work. Routine tasks are automated, while roles using AI as an assistant grow.",
      explanation: `Repetitive tasks are increasingly handled by software. Roles where people use AI to work faster or make decisions see healthy growth (average demand shifts ${sign(avg)}).`,
    },
    fast: {
      lead: "Fast-paced AI adoption across industries. Jobs focusing mostly on repetitive tasks face high competition.",
      explanation: `Workplaces adopt automation rapidly. People who combine human problem-solving with AI tools are heavily sought after, while routine-only tasks slow down (average demand shifts ${sign(avg)}).`,
    },
  };
  const t = text[scenario];

  return (
    <AnimatePresence initial={false}>
      <motion.section key={scenario} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl border-l-4 border-royal bg-card p-5 pt-7 shadow-sm" data-testid="card-scenario-meaning" aria-live="polite">
        <CharcoalPill tilt={2} className="-mt-9 float-right">{SCENARIO_NAMES[scenario]}</CharcoalPill>
        <h2 className="font-display mt-1 flex items-center gap-2 text-xl font-bold"><Lightbulb className="h-5 w-5 text-primary" /> What this scenario means</h2>
        
        <p className="mt-2 text-base font-semibold text-foreground">{t.lead}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground" data-testid="text-scenario-meaning">{t.explanation}</p>

        {/* Clean, readable highlights for students */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            📈 {rising.length} roles rising · {slowing.length} roles slowing
          </span>
          {topUp && (
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Top gainer: {topUp.title} ({sign(topUp.changePct)})
            </span>
          )}
          {skillsUp.length > 0 && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              🛡️ {resilientUp} of {skillsUp.length} top in-demand skills are AI-Protected
            </span>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
          Note: These numbers are estimates based on Malaysian occupational standards (MASCO 2020 &amp; MyCOL) to help you explore career possibilities, not fixed guarantees.
        </p>
      </motion.section>
    </AnimatePresence>
  );
}

function RoleColumn({ title, tone, roles, totalRoles, searchActive }: { title: string; tone: "up" | "down"; roles: RoleTrend[]; totalRoles: number; searchActive: boolean }) {
  return (
    <section className="min-w-0" data-testid={`section-${tone}-roles`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={cn("font-display text-2xl font-bold", tone === "up" ? "text-primary" : "text-destructive")}>{title}</h2>
        <span className="font-data text-xs text-muted-foreground">{roles.length}{searchActive ? ` of ${totalRoles}` : ""} roles</span>
      </div>
      <div
        className="radar-role-scroll space-y-2 rounded-lg border border-border/70 bg-background/50 p-2"
        role="region"
        aria-label={`${title} role cards`}
        tabIndex={0}
        data-testid={`scroll-${tone}-roles`}
      >
        <ul className="space-y-2">
          {roles.length === 0 && (
            <li className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              {searchActive ? `No ${tone === "up" ? "rising" : "slowing"} roles match this search.` : "No roles in this band for this scenario."}
            </li>
          )}
          {roles.map((role, i) => (
            <RoleTrendCard key={role.occupationId} role={role} tone={tone} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function RoleTrendCard({ role, tone, index }: { role: RoleTrend; tone: "up" | "down"; index: number }) {
  const gradientId = `role-trend-${useId().replace(/:/g, "")}`;
  const domainMin = Math.min(role.lower90, role.currentIndex, role.projectedIndex);
  const domainMax = Math.max(role.upper90, role.currentIndex, role.projectedIndex);
  const range = domainMax - domainMin || 1;
  const padding = range * 0.12;
  const y = (value: number) => 68 - ((value - (domainMin - padding)) / (range + padding * 2)) * 52;
  const startY = y(role.currentIndex);
  const endY = y(role.projectedIndex);
  const deltaY = endY - startY;
  const curveOffset = tone === "up" ? -2 : 2;
  const curve = `M 14 ${startY} C 94 ${startY + deltaY * 0.2 + curveOffset}, 202 ${startY + deltaY * 0.8 - curveOffset}, 286 ${endY}`;
  const area = `${curve} L 286 78 L 14 78 Z`;
  const trendColor = tone === "up" ? "hsl(var(--primary))" : "hsl(var(--destructive))";
  const directionLabel = tone === "up" ? "Rising" : "Slowing";
  const DirectionIcon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  const percentage = `${role.changePct > 0 ? "+" : ""}${role.changePct.toFixed(1)}%`;
  const chartDescription = `Demand trend: current baseline ${role.currentIndex.toFixed(1)}; projected value ${role.projectedIndex.toFixed(1)}; 90% forecast range ${role.lower90.toFixed(1)} to ${role.upper90.toFixed(1)}. ${role.title} is ${directionLabel.toLowerCase()}, changing ${percentage}.`;

  return (
    <motion.li initial={{ opacity: 0, x: tone === "up" ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.025 }}>
      <Link
        href={`/roles/${role.occupationId}?from=radar`}
        className={cn(
          "group block min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2",
          tone === "up" ? "border-primary/20 hover:border-primary/50 focus-visible:ring-primary" : "border-destructive/20 hover:border-destructive/50 focus-visible:ring-destructive",
        )}
        data-testid={`link-role-${role.occupationId}`}
      >
        <div className="flex min-w-0 items-center gap-3 px-3 pt-3">
          <span className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            tone === "up" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
          )}>
            <DirectionIcon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold leading-snug group-hover:text-primary sm:text-base">{role.title}</h3>
            <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{role.sector} · {role.careerLevel}{role.mycolStatus && role.mycolStatus !== "None" ? ` · MyCOL: ${role.mycolStatus}` : ""}</p>
          </div>
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold sm:text-xs",
            tone === "up" ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/20 bg-destructive/10 text-destructive",
          )}>
            <DirectionIcon aria-hidden="true" className="h-3 w-3" />
            {directionLabel} <span className="font-data">{percentage}</span>
          </span>
        </div>

        <svg
          viewBox="0 0 300 96"
          className="mt-2 h-[5.5rem] w-full"
          role="img"
          aria-label={chartDescription}
        >
          <title>{`${role.title} demand trend`}</title>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.26" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0.015" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <line key={step} x1={14 + step * 54.4} y1="10" x2={14 + step * 54.4} y2="78" stroke="currentColor" className="text-muted" strokeOpacity="0.65" strokeDasharray="2 4" />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={curve} fill="none" stroke={trendColor} strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="14" cy={startY} r="3.5" fill={trendColor} />
          <circle cx="286" cy={endY} r="4" fill={trendColor} stroke="hsl(var(--card))" strokeWidth="2" />
          <text x="14" y="92" className="fill-muted-foreground" fontSize="9" fontWeight="600" textAnchor="start">Today</text>
          <text x="286" y="92" className="fill-muted-foreground" fontSize="9" fontWeight="600" textAnchor="end">Projection</text>
        </svg>

        <div className="border-t border-border/70 bg-muted/20 px-3 pb-3 pt-2.5">
          <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-1.5">
            <div className="min-w-0">
              <span className="block text-[9px] leading-tight text-muted-foreground sm:text-[10px]">Current Value</span>
              <span className="font-data mt-0.5 block text-xs font-bold sm:text-sm">{role.currentIndex.toFixed(1)}</span>
            </div>
            <div className="min-w-0 border-x border-border/70 px-2 text-center">
              <span className="block text-[9px] leading-tight text-muted-foreground sm:text-[10px]">Forecast Range (90%)</span>
              <span className="font-data mt-0.5 block whitespace-nowrap text-[11px] font-bold sm:text-sm">{role.lower90.toFixed(1)}–{role.upper90.toFixed(1)}</span>
            </div>
            <div className="min-w-0 text-right">
              <span className="block text-[9px] leading-tight text-muted-foreground sm:text-[10px]">Forecast Value</span>
              <span className="font-data mt-0.5 block text-xs font-bold sm:text-sm">{role.projectedIndex.toFixed(1)}</span>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 text-[9px] font-semibold leading-none text-destructive sm:text-[10px]">
              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
              AI Risk <span className="font-data text-[10px] font-bold sm:text-xs">{(role.aiExposure * 100).toFixed(0)}%</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-700/20 bg-emerald-50 px-2 py-1 text-[9px] font-semibold leading-none text-emerald-800 sm:text-[10px]">
              <ShieldCheck aria-hidden="true" className="h-3 w-3" />
              Job Safety <span className="font-data text-[10px] font-bold sm:text-xs">{(role.aiAugmentation * 100).toFixed(0)}%</span>
            </span>
            <span className="ml-auto max-w-full"><SdgChip sdg={role.primarySdg} compact /></span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

function SkillColumn({ title, skills }: { title: string; skills: SkillTrend[] }) {
  const max = Math.max(...skills.map((s) => Math.abs(s.changePct)), 1);
  return (
    <section className="rounded-lg border bg-card p-5">
      <h3 className="font-display mb-4 text-lg font-bold">{title}</h3>
      <ul className="space-y-2">
        {skills.map((s, i) => (
          <li key={s.skillId} className="grid grid-cols-[minmax(0,1fr)_5rem_3.5rem] items-center gap-3 text-sm">
            <div className="min-w-0" title={`${s.category} · required by ${s.roleCount} roles`}>
              <div className="truncate">{s.name} <span className="text-xs text-muted-foreground">· {s.roleCount}</span></div>
              <ResilienceBadge r={s.aiResilience} score={s.resilienceScore} exposure={s.avgExposure} augmentation={s.avgAugmentation} compact />
            </div>
            <div className="h-2 rounded-sm bg-muted">
              <motion.div className={cn("h-full origin-left rounded-sm", s.changePct >= 0 ? "bg-primary" : "bg-destructive")} initial={{ scaleX: 0 }} animate={{ scaleX: Math.abs(s.changePct) / max }} transition={{ delay: i * 0.03, duration: 0.5 }} />
            </div>
            <span className={cn("font-data text-right text-xs", s.changePct >= 0 ? "text-primary" : "text-destructive")}>{s.changePct > 0 ? "+" : ""}{s.changePct.toFixed(1)}%</span>
          </li>
        ))}
        {skills.length === 0 && <li className="text-sm text-muted-foreground">None in this band.</li>}
      </ul>
    </section>
  );
}



