import { Link } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, Radar, Route, Target } from "lucide-react";
import { useState } from "react";
import { useGetOverview, useListSectors } from "@workspace/api-client-react";
import { ErrorState, Skel, btn } from "@/components/kit";
import { CharcoalPill } from "@/components/pill";
import { MotionSection } from "@/components/motion";
import { RolePassPanel } from "@/components/role-pass-panel";
import { useProfile } from "@/lib/store";
import { formatDateDDMMYYYY } from "@/lib/utils";

export default function Home() {
  const ov = useGetOverview();
  const sectors = useListSectors();
  const [profile] = useProfile();
  const reduce = useReducedMotion();
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const o = ov.data;

  const stats = o
    ? [
        { v: o.occupationCount.toLocaleString(), l: "future-facing roles" },
        { v: o.skillCount.toLocaleString(), l: "canonical skills" },
        { v: o.trendObservationCount.toLocaleString(), l: "trend observations" },
        { v: o.sourceCount.toLocaleString(), l: "cited sources" },
      ]
    : [];
  const displayedStats: Array<{ v: string; l: string } | null> = ov.isLoading
    ? Array.from({ length: 4 }, () => null)
    : stats;

  const steps = [
    { n: "01", t: "Profile", d: "Upload a PDF CV from any industry, load a synthetic persona, or pick skills by hand.", I: FileText, tone: "bg-navy text-white" },
    { n: "02", t: "Matches", d: "Ranked roles with matched skills and clear gaps right after scanning your CV.", I: Target, tone: "bg-royal text-white" },
    { n: "03", t: "Pathway", d: "A week-by-week reskilling plan using free HRD Corp e-LATiH courses.", I: Route, tone: "bg-sky text-charcoal" },
    { n: "LIVE", t: "Radar", d: "Floating market pulse: check which roles and skills are rising or slowing anytime.", I: Radar, tone: "bg-charcoal text-white" },
  ];

  const topSectors = [...(sectors.data ?? [])].sort((a, b) => b.averageChangePct - a.averageChangePct);
  const activeSector = topSectors.find((sector) => sector.name === selectedSector) ?? topSectors[0];

  return (
    <div className="space-y-24">
      <MotionSection className="grid gap-12 pt-4 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        <div className="fade-up">
          <CharcoalPill tilt={-3} className="mb-6 px-4 py-2 text-xs">A career compass for Malaysia's AI era</CharcoalPill>
          <h1 className="font-display text-[clamp(2.6rem,6.4vw,5.4rem)] font-black leading-[0.9]">
            Wondering how AI<br />may change your work?<br />
            <span className="relative inline-block text-royal">
              Look at the evidence.
              <svg className="absolute -bottom-3 left-0 h-3 w-full" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden><path d="M2 8 Q75 0 150 7 T298 5" fill="none" stroke="#18191C" strokeWidth="4" strokeLinecap="round" /></svg>
            </span>
          </h1>
          <p className="mt-9 max-w-xl text-lg text-muted-foreground">
            From who you are today to where you can be next. Every forecast shows its source, date and uncertainty range, and you stay in charge of the decision.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={profile ? "/matches" : "/profile"} className={btn.primary + " px-7 py-3.5 text-base"} data-testid="link-start">
              {profile ? "Continue to my matches" : "Start with my profile"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/radar" className={btn.ghost + " px-7 py-3.5 text-base"} data-testid="link-radar">Explore the radar</Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md px-2 pb-10 pt-12 sm:px-4 sm:pb-11 sm:pt-12" data-testid="panel-lobby-dataset">
          <div aria-hidden className="absolute inset-x-10 bottom-12 top-11 rotate-[-4deg] rounded-[26px] bg-navy shadow-lg" />
          <div aria-hidden className="absolute inset-x-6 bottom-12 top-9 rotate-[3deg] rounded-[26px] bg-royal shadow-lg" />
          <div aria-hidden className="absolute left-[10%] top-3 z-[5] h-9 w-[36%] rounded-t-[15px] bg-royal" />
          <div className="absolute left-[10%] top-3 z-20 flex h-9 w-[36%] items-center justify-center px-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/95">
            <span>The dataset</span>
          </div>
          <CharcoalPill tilt={-3} className="absolute -left-1 -top-1 z-30 [--r:-3deg]">2026 Edition</CharcoalPill>

          <div className="relative z-10 mx-1 rounded-[26px] bg-sky p-2.5 shadow-[0_28px_40px_-24px_rgba(11,79,158,0.7)] sm:mx-2">
            <div className="rounded-[19px] border border-primary/15 bg-white p-4 sm:p-5">
              <div className="font-data mb-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <span>The dataset</span>
                {o && <span className="normal-case tracking-normal">As of {formatDateDDMMYYYY(o.latestObservationDate)}</span>}
              </div>
              {ov.isError ? (
                <ErrorState onRetry={() => ov.refetch()} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {displayedStats.map((s, i) => (
                      <div key={i} className="rounded-xl bg-mist p-3 sm:p-3.5">
                        {s ? (
                          <>
                            <div className="font-display text-2xl font-extrabold sm:text-3xl" data-testid={`text-stat-${i}`}>{s.v}</div>
                            <div className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{s.l}</div>
                          </>
                        ) : <Skel className="h-10" />}
                      </div>
                    ))}
                  </div>
                  {o && (
                    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                      Forecast to <span className="font-data text-foreground">{formatDateDDMMYYYY(o.forecastTargetDate)}</span> · {o.syntheticProfileCount} synthetic demo personas, no real personal data.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <aside aria-label="Your three steps" className="absolute bottom-0 right-0 z-20 -rotate-3 rounded-xl bg-charcoal px-3 py-2.5 text-[10px] font-medium leading-[1.55] text-white shadow-lg sm:right-1" data-testid="checklist-hero-steps">
            {["Profile", "Matches", "Pathway"].map((step) => (
              <div key={step} className="flex items-center gap-1.5">
                <Check className="h-2.5 w-2.5 text-sky" strokeWidth={3} />
                <span>{step}</span>
              </div>
            ))}
          </aside>
        </div>
      </MotionSection>

      <MotionSection delay={0.04}>
        <h2 className="font-display mb-8 text-4xl font-extrabold md:text-5xl">Three steps. Plus live Radar.</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.li key={s.n} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -6, rotate: i % 2 ? 1 : -1 }} className={"group relative rounded-[24px] p-6 pt-8 " + s.tone}>
              <span className="font-data absolute -top-3 left-5 rounded-lg bg-charcoal px-2.5 py-1 text-[11px] font-bold text-white">{s.n}</span>
              <s.I className="h-6 w-6 opacity-90" />
              <div className="font-display mt-10 text-2xl font-extrabold">{s.t}</div>
              <p className="mt-1 text-sm opacity-95">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </MotionSection>

      <MotionSection delay={0.08} className="grid gap-10 rounded-[28px] bg-sky p-3 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-[20px] bg-white p-5 sm:p-6 lg:col-span-2">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,360px)] lg:items-stretch">
            <div className="flex min-w-0 flex-col lg:h-[600px] lg:min-h-0" data-testid="sector-overview-column">
              <h2 className="font-display text-3xl font-extrabold">Industries in Demand</h2>
              <p className="mt-2 text-sm text-muted-foreground">Average projected demand change, baseline scenario. Estimates; see the radar for ranges and assumptions.</p>
              <Link href="/radar" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary" data-testid="link-sectors-radar">Compare scenarios <ArrowRight className="h-3.5 w-3.5" /></Link>
              <div
                className="mt-6 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2"
                role="region"
                aria-label="Industries in Demand"
                tabIndex={0}
                data-testid="sector-list-scroll"
              >
                {sectors.isLoading && Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-9" />)}
                {sectors.isError && <ErrorState onRetry={() => sectors.refetch()} />}
                {topSectors.map((s, i) => {
                  const max = Math.max(...topSectors.map((x) => Math.abs(x.averageChangePct)), 1);
                  const width = `${(Math.abs(s.averageChangePct) / max) * 100}%`;
                  const positive = s.averageChangePct >= 0;
                  const active = activeSector?.name === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${s.name}, ${s.averageChangePct > 0 ? "+" : ""}${s.averageChangePct.toFixed(1)}% average projected demand change, ${s.occupationCount} occupations`}
                      data-name-revealed={selectedSector === s.name}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse" || event.pointerType === "pen") setSelectedSector(s.name); }}
                      onFocus={() => setSelectedSector(s.name)}
                      onClick={() => setSelectedSector(s.name)}
                      data-testid={`button-sector-${i}`}
                      className={`industry-row group grid w-full grid-cols-[minmax(0,1fr)_minmax(72px,0.9fr)_3.5rem] items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:grid-cols-[minmax(0,1fr)_minmax(100px,1fr)_3.75rem] sm:gap-3 sm:text-sm ${active ? "bg-mist/70" : "hover:bg-mist/50"}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5" aria-hidden="true">
                        <span className="industry-name-viewport min-w-0 flex-1">
                          <span className="industry-name-track">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">· {s.occupationCount}</span>
                      </span>
                      <span className="industry-demand-track h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span
                          className={`block h-full origin-left rounded-full transition-transform duration-500 ease-out ${positive ? "bg-royal" : "bg-destructive"} ${active ? "scale-x-[1.04]" : "scale-x-100"}`}
                          style={{ width, transitionDuration: reduce ? "0ms" : undefined }}
                        />
                      </span>
                      <span className={`font-data text-right ${positive ? "text-primary" : "text-destructive"}`}>{positive ? "+" : ""}{s.averageChangePct.toFixed(1)}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 lg:min-h-[600px]" aria-live="polite" aria-label="Selected sector role pass" data-testid="sector-role-preview">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {activeSector ? `A role in ${activeSector.name}` : "Sector role preview"}
              </p>
              {sectors.isLoading ? (
                <Skel className="mx-auto h-[560px] w-full max-w-[320px] rounded-[24px]" />
              ) : sectors.isError ? (
                <p className="rounded-xl bg-mist p-4 text-sm text-muted-foreground">The role preview is unavailable until sector data loads.</p>
              ) : activeSector ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeSector.featuredOccupationId}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
                  >
                    <RolePassPanel occupationId={activeSector.featuredOccupationId} holderName="YOU" passClassName="max-w-[360px]" />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <p className="rounded-xl bg-mist p-4 text-sm text-muted-foreground">No sector roles are available to preview.</p>
              )}
            </div>
          </div>
        </div>
      </MotionSection>

      {o && (
        <MotionSection delay={0.12} className="relative rounded-[24px] border-l-8 border-accent bg-white p-6 text-sm text-muted-foreground">
          <CharcoalPill tilt={2} className="absolute -top-3 right-5">Honest by design</CharcoalPill>
          <p className="mt-1">{o.disclaimer}</p>
          <Link href="/about" className="mt-3 inline-flex items-center gap-1 font-bold text-primary" data-testid="link-about-home">Data sources and AI disclosure <ArrowRight className="h-3.5 w-3.5" /></Link>
        </MotionSection>
      )}
    </div>
  );
}
