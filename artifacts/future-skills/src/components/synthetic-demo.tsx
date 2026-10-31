import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getGetSyntheticTrendScenarioQueryKey,
  getListSyntheticLearningResourcesQueryKey,
  useGetSyntheticTrendScenario,
  useListSyntheticLearningResources,
  type SyntheticLearningResource,
} from "@workspace/api-client-react";
import { Skel } from "@/components/kit";
import { cn } from "@/lib/utils";

/**
 * Fictional data from the synthetic hackathon add-on. Always rendered in its
 * own dashed "demo" frame, apart from the real forecasts and e-LATiH courses.
 */

export function SyntheticBadge({ label = "Synthetic demo data" }: { label?: string }) {
  return (
    <span className="font-data inline-flex items-center gap-1 rounded-sm border border-amber-600/40 bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800" data-testid="badge-synthetic">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function DemoFrame({ children, className, testId }: { children: ReactNode; className?: string; testId: string }) {
  return (
    <section className={cn("min-w-0 rounded-[24px] border-2 border-dashed border-amber-600/40 bg-[repeating-linear-gradient(135deg,transparent,transparent_12px,hsl(var(--accent)/0.06)_12px,hsl(var(--accent)/0.06)_24px)] p-4 sm:p-6", className)} data-testid={testId}>
      {children}
    </section>
  );
}

const AMBER = "hsl(32 95% 40%)";

export function SyntheticTrendPanel({ occupationId, title }: { occupationId: string; title: string }) {
  const reduce = useReducedMotion();
  const q = useGetSyntheticTrendScenario(occupationId, {
    query: { enabled: !!occupationId, queryKey: getGetSyntheticTrendScenarioQueryKey(occupationId), retry: false },
  });
  if (q.isLoading) return <Skel className="h-64" />;
  if (q.isError || !q.data || q.data.points.length === 0) return null;
  const t = q.data;
  const first = t.points[0]!;
  const last = t.points[t.points.length - 1]!;
  const change = first.index ? ((last.index - first.index) / first.index) * 100 : 0;

  return (
    <DemoFrame testId="section-synthetic-trend">
      <div className="flex flex-wrap items-center gap-2">
        <SyntheticBadge />
        <span className="font-data text-[10px] uppercase tracking-wide text-muted-foreground">{t.datasetId} · {t.geography.replace(/_/g, " ").toLowerCase()}</span>
      </div>
      <h2 className="font-display mt-2 text-2xl font-bold">Fictional demand scenario</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        A made-up quarterly demand index for {title} from the hackathon's synthetic dataset, for trying out the app.{" "}
        <strong className="font-semibold text-foreground" data-testid="text-synthetic-trend-disclaimer">{t.disclaimer}.</strong>{" "}
        It is not used in the demand outlook above or in matches and pathways.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
        <div className="h-[200px] min-w-0 rounded-2xl border border-amber-600/20 bg-white/80 p-2" role="img" aria-label={`Fictional quarterly demand index for ${title}, ${first.quarter} to ${last.quarter}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={t.points} margin={{ top: 10, right: 12, left: -16, bottom: 4 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [v.toFixed(2), "Fictional index"]} />
              <Line type="monotone" dataKey="index" stroke={AMBER} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: AMBER }} name="Fictional index" isAnimationActive={!reduce} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-1">
          <div className="rounded-xl border border-amber-600/20 bg-white/80 p-3">
            <dt className="text-xs text-muted-foreground">Latest fictional index</dt>
            <dd className="font-data text-lg font-semibold" data-testid="text-synthetic-trend-latest">{last.index.toFixed(1)} <span className="text-xs text-muted-foreground">{last.quarter}</span></dd>
          </div>
          <div className="rounded-xl border border-amber-600/20 bg-white/80 p-3">
            <dt className="text-xs text-muted-foreground">Change since {first.quarter}</dt>
            <dd className="font-data text-lg font-semibold">{change > 0 ? "+" : ""}{change.toFixed(1)}%</dd>
          </div>
        </dl>
      </div>
      <div className="relative h-px overflow-hidden">
        <table className="sr-only" data-testid="table-synthetic-trend">
          <caption>Fictional quarterly demand index for {title} (synthetic, not a real statistic)</caption>
          <thead><tr><th scope="col">Quarter</th><th scope="col">Fictional index</th></tr></thead>
          <tbody>{t.points.map((p) => <tr key={p.observationId}><th scope="row">{p.quarter}</th><td>{p.index.toFixed(2)}</td></tr>)}</tbody>
        </table>
      </div>
    </DemoFrame>
  );
}

/** One card per distinct lab title (the dataset repeats some titles with different ids). */
function groupLabs(resources: SyntheticLearningResource[]) {
  const byTitle = new Map<string, SyntheticLearningResource[]>();
  for (const r of resources) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);
  return [...byTitle.values()];
}

export function SyntheticLabsPanel({ skillIds, className }: { skillIds: string[]; className?: string }) {
  const ids = [...new Set(skillIds)].slice(0, 100);
  const params = { skillIds: ids.join(",") };
  const q = useListSyntheticLearningResources(params, {
    query: { enabled: ids.length > 0, queryKey: getListSyntheticLearningResourcesQueryKey(params), retry: false },
  });
  if (ids.length === 0) return null;
  if (q.isLoading) return <Skel className="h-40" />;
  if (q.isError || !q.data || q.data.resources.length === 0) return null;
  const groups = groupLabs(q.data.resources);
  const shown = groups.slice(0, 6);

  return (
    <DemoFrame className={cn("rounded-lg p-5 sm:p-5", className)} testId="section-synthetic-labs">
      <SyntheticBadge label="Fictional practice labs" />
      <h3 className="mt-2 font-semibold">Practice ideas for your gaps</h3>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="text-synthetic-labs-disclaimer">{q.data.disclaimer}</p>
      <ul className="mt-3 space-y-2">
        {shown.map((g) => {
          const r = g[0]!;
          const hours = [...new Set(g.map((x) => x.estimatedHours))].sort((a, b) => a - b);
          return (
            <li key={r.resourceId} className="rounded-md border border-amber-600/25 bg-white/85 p-3" data-testid={`card-synthetic-lab-${r.resourceId}`}>
              <div className="text-sm font-semibold leading-snug">{r.title}</div>
              <div className="font-data mt-1 text-[11px] text-muted-foreground">
                {r.level} · {hours.length > 1 ? `${hours[0]}–${hours[hours.length - 1]}` : hours[0]}h · {r.deliveryMode} · {g.map((x) => x.resourceId).join(", ")}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.targetSkills.map((s) => <span key={s.skillId} className="rounded-sm border px-1.5 py-0.5 text-[11px]">{s.name}</span>)}
                <span className="font-data rounded-sm bg-accent/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">Not an actual course</span>
              </div>
            </li>
          );
        })}
      </ul>
      {groups.length > shown.length && <p className="mt-2 text-xs text-muted-foreground">+{groups.length - shown.length} more fictional labs for these skills.</p>}
    </DemoFrame>
  );
}
