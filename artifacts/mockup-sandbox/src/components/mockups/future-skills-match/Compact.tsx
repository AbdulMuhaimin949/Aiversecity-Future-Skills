import "./_group.css";
import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, Check, Compass, Star, Wrench } from "lucide-react";

const factors = [
  { label: "Skill coverage", value: 31, weight: 45, contribution: "14.1" },
  { label: "Proficiency alignment", value: 28, weight: 25, contribution: "7.1" },
  { label: "Education, experience & seniority readiness", value: 50, weight: 15, contribution: "7.5" },
  { label: "Interests, learning time & demand", value: 88, weight: 15, contribution: "13.1" },
];

export function Compact() {
  const [targetSelected, setTargetSelected] = useState(false);
  const [notice, setNotice] = useState("");

  return (
    <main className="mockup-paper min-h-screen px-3 py-4 font-sans text-foreground sm:px-6 sm:py-7">
      <article className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-7">
        <div className="mb-3 inline-flex -rotate-2 rounded-full px-3 py-1 font-data text-[10px] font-bold tracking-widest shadow-sm" style={{ backgroundColor: "#18191c", color: "#fff" }}>
          TOP #01 MATCH
        </div>
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
          Bioprocess Fermentation Engineer
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Healthcare, Biotech &amp; Food Security · Mid</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <ArrowRight className="h-3 w-3" aria-hidden="true" /> Steady +2.5%
          </span>
        </div>

        <section className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3" aria-label="Career outlook">
          <MetricCard value="48%" label="AI Risk" detail="AI may affect tasks" />
          <MetricCard value="76%" label="Job Safety" detail="AI may help with work" />
          <MetricCard value="+2.5%" label="Demand Forecast" detail="Steady growth" />
        </section>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          AI Risk describes how much AI may affect tasks, not a prediction of job loss. Job Safety describes how much AI may help with the work, not a guarantee of employment.
        </p>

        <section className="mt-5" aria-labelledby="key-insights-heading">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="key-insights-heading" className="font-display text-lg font-bold">Key Insights</h2>
            <span className="font-data inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-charcoal" style={{ backgroundColor: "#dce8f5" }} aria-label="Match score 42 out of 100">
              Match score <strong>42</strong>
            </span>
          </div>
          <div className="grid gap-3 rounded-2xl p-4 sm:grid-cols-[0.95fr_0.95fr_1.35fr] sm:gap-0 sm:px-5 sm:py-4" style={{ backgroundColor: "rgba(220, 232, 245, 0.7)" }}>
            <Insight icon={<Wrench className="h-4 w-4" />} title="Skills" className="sm:pr-4">
              1/6 required and 3/4 preferred on your profile.
            </Insight>
            <Insight icon={<BarChart3 className="h-4 w-4" />} title="Demand" className="sm:border-l sm:border-border sm:px-4">
              +2.5% projected under High Impact; this sector matches your interests.
            </Insight>
            <Insight icon={<Compass className="h-4 w-4" />} title="Next steps" className="sm:border-l sm:border-border sm:pl-4">
              8 skill gaps · about 131 learning hours. Start with Medical Device Regulatory Affairs, Telemedicine &amp; Digital Health Operations, or Public Health Epidemiology.
            </Insight>
          </div>
        </section>

        <section className="mt-5" aria-label="Match score breakdown">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="font-display text-lg font-bold">How your match score is built</h2>
            <span className="text-[11px] text-muted-foreground">Factor results · share of final score</span>
          </div>
          <div className="mt-3 space-y-3">
            {factors.map((factor) => (
              <div key={factor.label}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-semibold">{factor.label}</span>
                  <span className="font-data shrink-0 text-muted-foreground">{factor.value}%</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${factor.label}: ${factor.value} out of 100 factor score, ${factor.weight}% weight`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${factor.value}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {factor.weight}% weight <span className="mx-1">·</span> contributes {factor.contribution} of 100 possible match points
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setNotice("Pathway builder selected for Bioprocess Fermentation Engineer.")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Build my pathway <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={targetSelected}
            onClick={() => {
              setTargetSelected((selected) => !selected);
              setNotice(targetSelected ? "Removed as your target pathway." : "Selected as your target pathway.");
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {targetSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : <Star className="h-4 w-4" aria-hidden="true" />}
            {targetSelected ? "Target pathway selected" : "Select as my target pathway"}
          </button>
          <button
            type="button"
            onClick={() => setNotice("Role details opened for Bioprocess Fermentation Engineer.")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Role detail <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {notice && (
          <p className="mt-3 rounded-lg bg-mist/70 px-3 py-2 text-xs text-muted-foreground" role="status">
            {notice}
          </p>
        )}
      </article>
    </main>
  );
}

function MetricCard({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="flex min-h-[78px] items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div>
        <div className="font-display text-2xl font-extrabold leading-none text-charcoal">{value}</div>
        <div className="mt-1 text-sm font-semibold">{label}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
      </div>
      <span className="h-8 w-8 shrink-0 rounded-full border-[5px] border-mist border-r-primary" aria-hidden="true" />
    </div>
  );
}

function Insight({ icon, title, className = "", children }: { icon: ReactNode; title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-charcoal">
        <span className="text-navy" aria-hidden="true">{icon}</span>{title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground sm:text-[13px]">{children}</p>
    </div>
  );
}
