import { getGetOccupationQueryKey, useGetOccupation, type RoleMatch } from "@workspace/api-client-react";
import { ArrowUpRight } from "lucide-react";
import { ErrorState, Skel } from "@/components/kit";
import { LanyardPass } from "@/components/lanyard-pass";
import { MetricCircle } from "@/components/metric-circle";
import { profileDisplayLabel, useProfile, type StoredProfile } from "@/lib/store";

/** Wires a LanyardPass to real data: occupation detail (MASCO, skills, sources) + optional match result. */
export function RolePassPanel({ occupationId, match, fallbackScore, topRank, profileOverride, holderName, autoSwing, passClassName }: { occupationId: string; match?: RoleMatch; fallbackScore?: number; topRank?: number; profileOverride?: StoredProfile | null; holderName?: string; autoSwing?: boolean; passClassName?: string }) {
  const [storedProfile] = useProfile();
  const profile = profileOverride === undefined ? storedProfile : profileOverride;
  const profileLabel = profileDisplayLabel(profile?.label);
  const q = useGetOccupation(occupationId, { query: { enabled: !!occupationId, queryKey: getGetOccupationQueryKey(occupationId) } });
  const o = q.data;
  if (q.isLoading) return <div data-testid="skeleton-role-pass"><Skel className="mx-auto h-[560px] w-full max-w-[320px] rounded-[24px]" /></div>;
  if (q.isError || !o) return <ErrorState onRetry={() => q.refetch()} />;

  const metIds = match ? new Set(match.metSkills.map((s) => s.skillId)) : new Set(profile?.skills.map((s) => s.skillId) ?? []);
  const required = o.skills.filter((s) => s.importance === "Required");
  const list = required.length ? required : o.skills;
  const sourceIds = match?.sourceIds?.length ? match.sourceIds : o.sources.map((s) => s.id);
  return (
    <LanyardPass
      key={occupationId}
      name={holderName ?? profileLabel ?? "Your name"}
      title={o.title}
      sector={o.sector}
      score={match?.score ?? fallbackScore}
      mascoCode={o.mascoCode}
      skills={list.map((s) => ({ id: s.skillId, name: s.name, met: metIds.has(s.skillId) }))}
      sdgs={match?.sdgs ?? o.sdgs}
      sourceIds={sourceIds}
      topRank={topRank}
      autoSwing={autoSwing}
      className={passClassName}
    />
  );
}

/** AI Risk / Job Safety role values plus the demand forecast supplied by the caller. */
export function RoleMetrics({ occupationId, demandPct, variant = "circles" }: { occupationId: string; demandPct: number; variant?: "circles" | "cards" }) {
  const q = useGetOccupation(occupationId, { query: { enabled: !!occupationId, queryKey: getGetOccupationQueryKey(occupationId) } });
  const o = q.data;
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" data-testid="metrics-role">
        {o ? <MetricTile value={o.aiExposure * 100} label="AI Risk" /> : <Skel className="h-[76px] rounded-xl" />}
        {o ? <MetricTile value={o.aiAugmentation * 100} label="Job Safety" /> : <Skel className="h-[76px] rounded-xl" />}
        <MetricTile value={demandPct} label="Demand forecast" signed />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-4" data-testid="metrics-role">
      {o ? <MetricCircle value={o.aiExposure * 100} label="AI Risk" testId="metric-exposure" /> : <Skel className="h-24 w-24 rounded-full" />}
      {o ? <MetricCircle value={o.aiAugmentation * 100} label="Job Safety" testId="metric-augmentation" /> : <Skel className="h-24 w-24 rounded-full" />}
      <MetricCircle value={demandPct} signed label="Demand forecast" testId="metric-demand" />
      <p className="basis-full text-[11px] leading-relaxed text-muted-foreground">AI Risk: how much AI may affect tasks, not a prediction of job loss. Job Safety: how much AI may help with the work, not a guarantee of employment.</p>
    </div>
  );
}

function MetricTile({ value, label, signed = false }: { value: number; label: string; signed?: boolean }) {
  const digits = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 1;
  const formatted = `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`;
  const ringAngle = Math.max(0, Math.min(100, Math.abs(value))) * 3.6;
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm sm:px-4" data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="min-w-0">
        <p className="font-display text-2xl font-extrabold leading-none text-foreground">
          {formatted}<span className="text-base font-bold text-primary">%</span>
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {signed ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-primary" aria-hidden="true">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      ) : (
        <span
          className="h-8 w-8 shrink-0 rounded-full p-[4px]"
          style={{ background: `conic-gradient(hsl(var(--primary)) ${ringAngle}deg, hsl(var(--muted)) 0deg)` }}
          role="img"
          aria-label={`${label} indicator`}
        >
          <span className="block h-full w-full rounded-full border-2 border-card bg-card" />
        </span>
      )}
    </div>
  );
}
