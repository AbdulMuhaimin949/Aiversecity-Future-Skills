import "./_group.css";
import { ArrowRight, ArrowUpRight, Star } from "lucide-react";
import { motion } from "framer-motion";

const factors = [
  { label: "Skill coverage", value: 31, weight: 45, contribution: "14.1" },
  { label: "Proficiency alignment", value: 28, weight: 25, contribution: "7.1" },
  { label: "Education, experience & seniority readiness", value: 50, weight: 15, contribution: "7.5" },
  { label: "Interests, learning time & demand", value: 88, weight: 15, contribution: "13.1" },
];

const highlights = [
  "Skills: 1/6 required and 3/4 preferred on your profile.",
  "Demand: +2.5% projected under High Impact; this sector matches your interests.",
  "Next steps: 8 skill gaps · about 131 learning hours · Start with Medical Device Regulatory Affairs; Telemedicine & Digital Health Operations; Public Health Epidemiology.",
];

export function Current() {
  return (
    <main className="mockup-paper min-h-screen p-4 font-sans text-foreground sm:p-6">
      <article className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-7">
        <div className="mb-4 inline-flex rounded-full bg-charcoal px-3 py-1 font-data text-[10px] font-bold tracking-widest text-white">
          TOP #01 MATCH
        </div>

        <h1 className="font-display text-3xl font-extrabold leading-[1.02] sm:text-5xl">
          Bioprocess Fermentation Engineer
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Healthcare, Biotech &amp; Food Security · Mid</span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            <ArrowRight className="h-3 w-3" /> Steady +2.5%
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-6">
          <MetricCircle value="48" label="AI Risk" />
          <MetricCircle value="76" label="Job Safety" />
          <MetricCircle value="+2.5" label="Demand Forecast" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          AI Risk: how much AI may affect tasks, not a prediction of job loss. Job Safety: how much AI may help with the work, not a guarantee of employment.
        </p>

        <section className="mt-6 flex items-start gap-4 rounded-2xl bg-mist/70 p-4 sm:p-5" aria-label="Match highlights">
          <ScoreRing score={42} />
          <ul className="min-w-0 list-disc space-y-1.5 pl-4 text-sm">
            {highlights.map((highlight) => {
              const colon = highlight.indexOf(":");
              return (
                <li key={highlight}>
                  <span className="font-semibold">{highlight.slice(0, colon)}:</span>
                  {highlight.slice(colon + 1)}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6" aria-label="Match score breakdown">
          <h2 className="text-sm font-bold">How your match score is built</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Each bar shows your result for that factor. The weight is its share of the final score.
          </p>
          <div className="mt-4 space-y-3">
            {factors.map((factor) => (
              <div key={factor.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                  <span className="font-semibold">{factor.label}</span>
                  <span className="font-data whitespace-nowrap">
                    {factor.value}/100 factor score · {factor.weight}% weight
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${factor.label}: ${factor.value} out of 100 factor score`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${factor.value}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Contributes {factor.contribution} of 100 possible match points
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
            Build my pathway <ArrowRight className="h-4 w-4" />
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary">
            <Star className="h-4 w-4" /> Select as my target pathway
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold">
            Role detail <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </article>
    </main>
  );
}

function MetricCircle({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-display flex h-24 w-24 items-center justify-center rounded-full bg-mist text-3xl font-extrabold leading-none text-charcoal">
        <span>{value}<span className="text-[0.55em] font-bold text-navy">%</span></span>
      </div>
      <span className="font-data -mt-2.5 whitespace-nowrap rounded-full bg-charcoal px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">
        {label}
      </span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 22;
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`${score} out of 100 match score`}>
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r="22" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <motion.circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <span className="font-data absolute inset-0 flex items-center justify-center text-sm font-semibold" aria-hidden="true">
        {score}
      </span>
    </div>
  );
}
