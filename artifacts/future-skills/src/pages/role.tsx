import { useState } from "react";
import { useParams, Link } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useGetOccupation, getGetOccupationQueryKey, type OccupationSkill, type Scenario } from "@workspace/api-client-react";
import { ErrorState, ScenarioSwitch, SdgChip, Skel, VerifyBadge, btn } from "@/components/kit";
import { SelectTargetButton } from "@/components/target-role";
import { useTargetRole, useProfile, useScenario } from "@/lib/store";
import { MetricCircle } from "@/components/metric-circle";
import { CharcoalPill } from "@/components/pill";
import { cn, formatDateDDMMYYYY } from "@/lib/utils";
import { MotionSection } from "@/components/motion";

const COLORS = { baseline: "hsl(211 94% 60%)", moderate: "hsl(42 96% 46%)", fast: "hsl(212 87% 33%)" } as const;
type Forecast = { scenario: Scenario; label: string; projectedIndex: number; changePct: number; lower90: number; upper90: number };
type AnalysisMetric = "exposure" | "augmentation" | "demand";

export default function RolePage() {
  const { occupationId = "" } = useParams<{ occupationId: string }>();
  const q = useGetOccupation(occupationId, { query: { enabled: !!occupationId, queryKey: getGetOccupationQueryKey(occupationId) } });
  const [scenario, setScenario] = useScenario();
  const [profile] = useProfile();
  const [, setLast] = useTargetRole();
  const reduce = useReducedMotion();
  const fromRadar = new URLSearchParams(window.location.search).get("from") === "radar";
  const o = q.data;

  if (q.isLoading) return <div className="space-y-4"><Skel className="h-24" /><Skel className="h-80" /><Skel className="h-48" /></div>;
  const status = (q.error as { status?: number } | null)?.status;
  if (status === 404) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-6" data-testid="status-role-not-found">
        <h1 className="font-display text-2xl font-extrabold">Role not found</h1>
        <p className="text-sm text-muted-foreground">We couldn't find an occupation with this link. It may be outdated or mistyped.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/radar" className={btn.primary} data-testid="link-not-found-radar">Go to Radar</Link>
          <Link href="/matches" className={btn.ghost} data-testid="link-not-found-matches">Go to Matches</Link>
        </div>
      </div>
    );
  }
  if (q.isError || !o) return <ErrorState message={(q.error as { data?: { error?: string } } | null)?.data?.error ?? "Role not found."} onRetry={() => q.refetch()} />;

  const mine = new Map(profile?.skills.map((s) => [s.skillId, s.proficiency]) ?? []);
  const hist = [...o.history].sort((a, b) => a.date.localeCompare(b.date));
  const last = hist[hist.length - 1];
  const fc = Object.fromEntries(o.forecasts.map((f) => [f.scenario, f]));
  const sel = fc[scenario];
  type Row = { date: string; hist?: number; baseline?: number; moderate?: number; fast?: number; band?: [number, number] };
  const data: Row[] = hist.map((h) => ({ date: h.date, hist: h.value }));
  if (last) {
    data[data.length - 1] = { ...data[data.length - 1], baseline: last.value, moderate: last.value, fast: last.value, band: [last.value, last.value] };
    data.push({ date: o.forecastTargetDate, baseline: fc.baseline?.projectedIndex, moderate: fc.moderate?.projectedIndex, fast: fc.fast?.projectedIndex, band: sel ? [sel.lower90, sel.upper90] : undefined });
  }
  const yearTicks = [...new Map(data.map((point) => [point.date.slice(0, 4), point.date])).values()];
  const req = o.skills.filter((s) => s.importance === "Required");
  const pref = o.skills.filter((s) => s.importance === "Preferred");

  return (
    <div className="space-y-8" data-testid="section-role-dashboard">
      <Link href={fromRadar ? "/radar" : "/matches"} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted-foreground transition hover:bg-mist hover:text-primary" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> {fromRadar ? "Back to Radar" : "Back to matches"}
      </Link>
      <MotionSection className="overflow-hidden rounded-[24px] border-2 border-sky/35 bg-card shadow-sm">
        <div className="grid gap-6 bg-gradient-to-br from-white via-white to-mist/70 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CharcoalPill tilt={-2} testId="pill-role-masco">MASCO {o.mascoCode}</CharcoalPill>
              <span className="font-data text-xs uppercase tracking-[0.14em] text-primary">{o.sector}</span>
            </div>
            <p className="font-data text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected occupation · {o.careerLevel}</p>
            <h1 className="font-display mt-2 text-4xl font-extrabold leading-[0.98] md:text-5xl" data-testid="text-role-title">{o.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{o.description}</p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-white/85 p-4 sm:p-5">
            <h2 className="font-display text-sm font-bold text-charcoal">Role outlook</h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={scenario} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.12 }} className="font-data mb-5 mt-1 text-[10px] uppercase tracking-wide text-muted-foreground" data-testid="text-role-scenario" aria-live="polite">Scenario · {fc[scenario]?.label ?? scenario}</motion.p>
            </AnimatePresence>
            <div className="flex flex-wrap items-start justify-around gap-x-3 gap-y-5" data-testid="metrics-role-detail">
              <MetricCircle value={o.aiExposure * 100} label="AI Risk" testId="metric-exposure" />
              <MetricCircle value={o.aiAugmentation * 100} label="Job Safety" testId="metric-augmentation" />
              {sel && <MetricCircle value={sel.changePct} signed label="Demand forecast" testId="metric-demand" />}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-primary/15 bg-primary/10 sm:grid-cols-4">
          {[
            ["Career level", o.careerLevel],
            ["Minimum education", o.minEducation],
            ["Minimum experience", `${o.minExperienceYears} yrs`],
            ["MyCOL status", o.mycolStatus],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 bg-card px-4 py-3 sm:px-5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 truncate font-data text-sm font-semibold" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </MotionSection>

      <MotionSection delay={0.03} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.85fr)]" aria-label="Demand outlook and AI disruption">
        <section className="min-w-0 rounded-[24px] border-2 border-primary/20 bg-card p-4 shadow-sm sm:p-6" data-testid="section-demand-chart">
          <div className="mb-5 space-y-4">
            <div>
              <p className="font-data text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Demand outlook</p>
              <h2 className="font-display mt-1 text-2xl font-bold">History to forecast</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Quarterly observations and baseline, moderate and fast projections through {formatDateDDMMYYYY(o.forecastTargetDate)}. The shaded band is the 90% range for the selected scenario.</p>
            </div>
            <div className="flex justify-start sm:justify-end">
              <ScenarioSwitch value={scenario} onChange={setScenario} />
            </div>
          </div>
          <ZoomableDemandChart data={data} yearTicks={yearTicks} scenario={scenario} fc={fc} reduce={!!reduce} title={o.title} />
          <div className="sr-only">
          <table className="w-px table-fixed" data-testid="chart-data-table" aria-label="Values represented in the demand chart">
            <caption>Quarterly demand observations and scenario forecast values for {o.title}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Observed demand</th>
                <th scope="col" data-testid="chart-series-baseline">Baseline forecast</th>
                <th scope="col" data-testid="chart-series-moderate">Moderate forecast</th>
                <th scope="col" data-testid="chart-series-fast">Fast forecast</th>
                <th scope="col">Selected 90% lower bound</th>
                <th scope="col">Selected 90% upper bound</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point, index) => {
                const forecastPoint = index === data.length - 1;
                return (
                  <tr key={point.date} data-testid={forecastPoint ? "chart-forecast-row" : "chart-history-row"}>
                    <th scope="row">{formatDateDDMMYYYY(point.date)}</th>
                    <td>{point.hist?.toFixed(2) ?? "—"}</td>
                    <td>{point.baseline?.toFixed(2) ?? "—"}</td>
                    <td>{point.moderate?.toFixed(2) ?? "—"}</td>
                    <td>{point.fast?.toFixed(2) ?? "—"}</td>
                    <td>{forecastPoint ? point.band?.[0].toFixed(2) ?? "—" : "—"}</td>
                    <td>{forecastPoint ? point.band?.[1].toFixed(2) ?? "—" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {o.forecasts.map((f) => (
              <button key={f.scenario} onClick={() => setScenario(f.scenario)} aria-pressed={f.scenario === scenario} className={cn("min-h-20 rounded-xl border bg-white p-3 text-left transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary", f.scenario === scenario && "border-primary ring-1 ring-primary")} data-testid={`button-forecast-${f.scenario}`}>
                <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[f.scenario] }} />{f.label}</div>
                <div className="font-data mt-1 text-lg">{f.projectedIndex.toFixed(1)} <span className={cn("text-sm", f.changePct >= 0 ? "text-primary" : "text-destructive")}>{f.changePct > 0 ? "+" : ""}{f.changePct.toFixed(1)}%</span></div>
                <div className="font-data text-[11px] text-muted-foreground">90%: {f.lower90.toFixed(1)} – {f.upper90.toFixed(1)}</div>
              </button>
            ))}
          </div>
        </section>

        <DisruptionAnalysis
          exposure={o.aiExposure}
          augmentation={o.aiAugmentation}
          forecasts={o.forecasts}
          scenario={scenario}
          onScenarioChange={setScenario}
        />
      </MotionSection>

      <MotionSection delay={0.06} className="grid gap-6 lg:grid-cols-2">
        <SkillList title="Required skills" skills={req} mine={mine} />
        <SkillList title="Preferred skills" skills={pref} mine={mine} />
      </MotionSection>

      <MotionSection delay={0.08}>
        <h2 className="font-display mb-4 text-2xl font-bold">Why this role matters for the SDGs</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {o.sdgs.map((s) => (
            <li key={s.targetCode} className="rounded-md border bg-card p-4"><SdgChip sdg={s} /><div className="font-data mt-2 text-xs text-muted-foreground">Target {s.targetCode}</div><p className="mt-1 text-sm">{s.rationale}</p></li>
          ))}
        </ul>
      </MotionSection>

      <MotionSection delay={0.1}>
        <h2 className="font-display mb-4 text-2xl font-bold">Sources</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {o.sources.filter((s) => s.id !== "SRC_SYNTH_GEN").map((s) => (
            <li key={s.id} className="grid gap-x-4 gap-y-2 p-4 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="font-data min-w-0 break-all text-[11px] leading-tight text-muted-foreground">{s.id}</span>
              <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 font-medium hover:text-primary [overflow-wrap:anywhere]">{s.name} <ExternalLink className="inline h-3 w-3" /></a>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="font-data whitespace-nowrap text-xs text-muted-foreground">{formatDateDDMMYYYY(s.date)}</span>
                <VerifyBadge status={s.verificationStatus} />
              </div>
            </li>
          ))}
        </ul>
      </MotionSection>

      <MotionSection delay={0.12} className="flex flex-wrap justify-end gap-2">
        <SelectTargetButton occupationId={o.occupationId} title={o.title} />
        <Link href={`/pathway/${o.occupationId}`} onClick={() => setLast({ id: o.occupationId, title: o.title })} className={btn.primary} data-testid="link-build-pathway">Build my pathway to this role <ArrowRight className="h-4 w-4" /></Link>
      </MotionSection>
    </div>
  );
}

type ChartRow = { date: string; hist?: number; baseline?: number; moderate?: number; fast?: number; band?: [number, number] };

/** Quarters of history shown before the forecast point. 0 = whole history. */
const ZOOM_LEVELS = [0, 12, 8, 4, 2] as const;
const ZOOM_LABELS = ["All years", "Last 3 years", "Last 2 years", "Last 1 year", "Forecast focus"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month and year of the observation date, e.g. "Sep 2026". Points are recorded at quarter-end dates. */
function quarterLabel(date: string) {
  const month = Number(date.slice(5, 7));
  return `${MONTHS[month - 1] ?? date.slice(5, 7)} ${date.slice(0, 4)}`;
}

/** Demand chart with zoom controls so the three scenario lines can be told apart near the forecast. */
function ZoomableDemandChart({ data, yearTicks, scenario, fc, reduce, title }: { data: ChartRow[]; yearTicks: string[] | { date: string }[] | unknown[]; scenario: Scenario; fc: Record<string, { label: string } | undefined>; reduce: boolean; title: string }) {
  const [zoom, setZoom] = useState(0);
  const quarters = ZOOM_LEVELS[zoom];
  const visible = quarters === 0 ? data : data.slice(Math.max(0, data.length - 1 - quarters));
  const zoomed = zoom > 0;

  const values = visible.flatMap((r) => [r.hist, r.baseline, r.moderate, r.fast, r.band?.[0], r.band?.[1]]).filter((v): v is number => typeof v === "number");
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(1, (hi - lo) * 0.12);
  const domain: [number, number] = zoomed ? [Math.floor(lo - pad), Math.ceil(hi + pad)] : [Math.floor(lo - pad), Math.ceil(hi + pad)];

  const ticks = zoomed ? visible.map((r) => r.date) : (yearTicks as string[]);
  const tickFormatter = (value: string) => (zoomed ? quarterLabel(value) : value.slice(0, 4));
  const btnCls = "inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-primary/25 bg-white px-2.5 text-sm font-semibold text-primary transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div data-testid="zoomable-demand-chart">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">Showing: <span className="font-semibold text-foreground">{ZOOM_LABELS[zoom]}</span>. Zoom in to see how far apart the three scenarios are.</p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Chart zoom">
          <button type="button" className={btnCls} onClick={() => setZoom((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))} disabled={zoom === ZOOM_LEVELS.length - 1} aria-label="Zoom in" data-testid="button-chart-zoom-in">+</button>
          <button type="button" className={btnCls} onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Zoom out" data-testid="button-chart-zoom-out">−</button>
          <button type="button" className={btnCls} onClick={() => setZoom(ZOOM_LEVELS.length - 1)} disabled={zoom === ZOOM_LEVELS.length - 1} data-testid="button-chart-zoom-forecast">Focus forecast</button>
          <button type="button" className={btnCls} onClick={() => setZoom(0)} disabled={zoom === 0} data-testid="button-chart-zoom-reset">Reset</button>
        </div>
      </div>
      <div className="h-[290px] min-w-0 rounded-2xl border border-primary/10 bg-gradient-to-b from-white to-mist/25 p-2 sm:h-[350px] sm:p-4" role="img" aria-label={`Quarterly demand history and three scenario forecasts for ${title}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visible} margin={{ top: 14, right: 12, left: -12, bottom: 8 }}>
            <defs>
              <linearGradient id="role-history-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.025} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={tickFormatter} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} minTickGap={zoomed ? 8 : 24} interval="preserveStartEnd" height={42} label={{ value: zoomed ? "Month (data recorded every 3 months)" : "Year", position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" domain={domain} allowDataOverflow tickLine={false} axisLine={false} width={42} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(11, 79, 158, 0.12)" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }} labelFormatter={(value) => formatDateDDMMYYYY(String(value))} formatter={(v: number | number[]) => (Array.isArray(v) ? `${v[0].toFixed(1)} – ${v[1].toFixed(1)}` : v.toFixed(1))} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area dataKey="band" stroke="none" fill={COLORS[scenario]} fillOpacity={0.18} name="Selected scenario 90% range" legendType="none" isAnimationActive={!reduce} />
            <Area type="monotone" dataKey="hist" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#role-history-fill)" activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }} dot={{ r: 2, fill: "hsl(var(--primary))" }} name="Observed demand" isAnimationActive={!reduce} />
            {(["baseline", "moderate", "fast"] as const).map((s) => (
              <Line key={s} type="monotone" dataKey={s} data-testid={`chart-line-${s}`} stroke={COLORS[s]} strokeWidth={s === scenario ? 3 : 1.5} strokeDasharray={s === scenario ? undefined : "5 4"} dot={{ r: s === scenario ? 4 : 3 }} activeDot={{ r: 5 }} name={fc[s]?.label ?? s} isAnimationActive={!reduce} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DisruptionAnalysis({
  exposure,
  augmentation,
  forecasts,
  scenario,
  onScenarioChange,
}: {
  exposure: number;
  augmentation: number;
  forecasts: Forecast[];
  scenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
}) {
  const [selectedMetric, setSelectedMetric] = useState<AnalysisMetric>("demand");
  const reduce = useReducedMotion();
  const selectedForecast = forecasts.find((forecast) => forecast.scenario === scenario);
  const metricRows: { id: AnalysisMetric; label: string; value: number; formatted: string }[] = [
    { id: "exposure", label: "AI Risk", value: exposure, formatted: `${(exposure * 100).toFixed(1)}%` },
    { id: "augmentation", label: "Job Safety", value: augmentation, formatted: `${(augmentation * 100).toFixed(1)}%` },
    { id: "demand", label: "Demand change", value: selectedForecast?.changePct ?? 0, formatted: selectedForecast ? `${selectedForecast.changePct > 0 ? "+" : ""}${selectedForecast.changePct.toFixed(1)}%` : "—" },
  ];
  const selectedMetricRow = metricRows.find((metric) => metric.id === selectedMetric)!;

  return (
    <section className="min-w-0 rounded-[24px] border-2 border-primary/20 bg-card p-4 shadow-sm sm:p-6" data-testid="section-ai-disruption">
      <p className="font-data text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Role analysis</p>
      <h2 className="font-display mt-1 text-2xl font-bold">AI disruption</h2>
      <p className="mt-1 text-sm text-muted-foreground">AI Risk describes how much AI may affect tasks—not a prediction of job loss. Job Safety reflects AI’s potential to help with the work, not a guarantee of employment.</p>

      <div className="mt-5 space-y-3" aria-label="Supported role metrics">
        {metricRows.map((metric) => (
          <button
            key={metric.id}
            type="button"
            onClick={() => setSelectedMetric(metric.id)}
            aria-pressed={selectedMetric === metric.id}
            className={cn("w-full rounded-xl border bg-white p-3 text-left transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary", selectedMetric === metric.id && "border-primary ring-1 ring-primary")}
            data-testid={`button-analysis-metric-${metric.id}`}
          >
            <span className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>{metric.label}</span>
              <span className={cn("font-data", metric.id === "demand" && metric.value < 0 && "text-destructive")}>{metric.formatted}</span>
            </span>
            {metric.id !== "demand" && (
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, metric.value * 100))}%` }} />
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={`${selectedMetric}-${scenario}`} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.16 }} className="mt-4 rounded-xl border border-primary/15 bg-mist/30 p-4" data-testid="panel-analysis-detail" aria-live="polite">
        <p className="font-data text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{selectedMetricRow.label} · selected detail</p>
        {selectedMetric === "exposure" && (
              <p className="font-display mt-1 text-3xl font-bold" data-testid="text-analysis-detail">{(exposure * 100).toFixed(1)}% <span className="font-sans text-sm font-medium text-muted-foreground">role value supplied by the data</span></p>
        )}
        {selectedMetric === "augmentation" && (
              <p className="font-display mt-1 text-3xl font-bold" data-testid="text-analysis-detail">{(augmentation * 100).toFixed(1)}% <span className="font-sans text-sm font-medium text-muted-foreground">role value supplied by the data</span></p>
        )}
        {selectedMetric === "demand" && selectedForecast && (
          <div className="mt-1" data-testid="text-analysis-detail">
            <p className={cn("font-display text-3xl font-bold", selectedForecast.changePct < 0 ? "text-destructive" : "text-primary")}>
              {selectedForecast.changePct > 0 ? "+" : ""}{selectedForecast.changePct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedForecast.label}: projected index {selectedForecast.projectedIndex.toFixed(1)} · 90% range {selectedForecast.lower90.toFixed(1)}–{selectedForecast.upper90.toFixed(1)}</p>
          </div>
        )}
      </motion.div>
      </AnimatePresence>

      <div className="mt-5">
        <h3 className="font-display text-base font-bold">Scenario demand change</h3>
        <p className="mt-1 text-xs text-muted-foreground">Select a forecast to update the dashboard scenario.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {forecasts.map((forecast) => (
            <button
              key={forecast.scenario}
              type="button"
              onClick={() => onScenarioChange(forecast.scenario)}
              aria-pressed={forecast.scenario === scenario}
              className={cn("min-w-0 rounded-xl border bg-white p-2 text-left transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary", forecast.scenario === scenario && "border-primary ring-1 ring-primary")}
              data-testid={`button-analysis-scenario-${forecast.scenario}`}
            >
              <span className="block truncate text-[10px] font-semibold leading-tight">{forecast.label}</span>
              <span className={cn("font-data mt-1 block text-sm font-bold", forecast.changePct < 0 ? "text-destructive" : "text-primary")}>
                {forecast.changePct > 0 ? "+" : ""}{forecast.changePct.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">Demand forecasts are model estimates. AI Risk and Job Safety use the role values supplied by the data; no other disruption scores are inferred.</p>
    </section>
  );
}

function SkillList({ title, skills, mine }: { title: string; skills: OccupationSkill[]; mine: Map<string, number> }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="font-display mb-3 text-lg font-bold">{title} <span className="font-data text-sm text-muted-foreground">{skills.length}</span></h3>
      <ul className="space-y-2">
        {skills.length === 0 && <li className="text-sm text-muted-foreground">None listed.</li>}
        {skills.map((s) => {
          const you = mine.get(s.skillId) ?? 0;
          return (
            <li key={s.skillId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="truncate">{s.name} <span className="text-xs text-muted-foreground">· {s.category}</span></span>
              <span className="flex gap-0.5" title={`Required ${s.requiredProficiency}, you ${you}`}>
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn("h-3.5 w-2 rounded-[2px]", n <= Math.min(you, s.requiredProficiency) ? "bg-primary" : n <= s.requiredProficiency ? "bg-destructive/50" : n <= you ? "bg-primary/40" : "bg-border")} />)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
