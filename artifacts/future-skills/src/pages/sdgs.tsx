import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListSdgSummary } from "@workspace/api-client-react";
import { ErrorState, PageHead, SDG_COLORS, Skel } from "@/components/kit";
import { SdgIcon } from "@/components/sdg-icons";
import { useTargetRole, usePathwaySdgs } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function SdgsPage() {
  const q = useListSdgSummary();
  const [mine] = usePathwaySdgs();
  const [lastRole] = useTargetRole();
  const touched = new Set(mine.map((s) => s.goalNumber));

  return (
    <div>
      <PageHead kicker="UN Sustainable Development Goals" title="Where the work connects">
        <p className="max-w-sm text-sm text-muted-foreground">
          {touched.size > 0 && lastRole ? <>Highlighted: goals your pathway to <strong className="text-foreground">{lastRole.title}</strong> contributes to.</> : <>Build a pathway to see which goals your next role contributes to.</>}
        </p>
      </PageHead>
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {q.isLoading && Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-48" />)}
        {[...(q.data ?? [])].sort((a, b) => Number(touched.has(b.goalNumber)) - Number(touched.has(a.goalNumber)) || a.goalNumber - b.goalNumber).map((s, i) => {
          const on = touched.has(s.goalNumber);
          return (
            <motion.div key={s.goalNumber} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.2 }} className={cn("overflow-hidden rounded-lg border bg-card transition-shadow", on && "ring-2 ring-offset-2 ring-offset-background")} style={on ? ({ "--tw-ring-color": SDG_COLORS[s.goalNumber] } as React.CSSProperties) : undefined} data-testid={`card-sdg-${s.goalNumber}`}>
              <div className="flex items-center justify-between p-4 text-white" style={{ background: SDG_COLORS[s.goalNumber] }}>
                <span className="font-display text-5xl font-extrabold leading-none">{s.goalNumber}</span>
                <div className="flex items-center gap-3">
                  {on && <span className="font-data rounded bg-white/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Your pathway</span>}
                  <SdgIcon goal={s.goalNumber} className="h-12 w-12 shrink-0 text-white" />
                </div>
              </div>
              <div className="p-4">
                <div className="font-display font-bold leading-tight">{s.goalTitle}</div>
                <div className="font-data mt-2 flex gap-4 text-xs text-muted-foreground"><span>{s.occupationCount} roles</span><span>{s.skillCount} skills</span><span>{s.targets.length} targets</span></div>
                <div className="mt-2 flex flex-wrap gap-1">{s.targets.slice(0, 8).map((t) => <span key={t} className="font-data rounded-sm bg-muted px-1 text-[10px]">{t}</span>)}</div>
                {s.exampleRoles.length > 0 && <p className="mt-3 text-xs text-muted-foreground">e.g. {s.exampleRoles.slice(0, 3).join(", ")}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
      {q.data && q.data.length === 0 && <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No SDG mappings available.</div>}
      {touched.size === 0 && <div className="mt-8 text-center"><Link href="/matches" className="text-sm font-semibold text-primary" data-testid="link-matches-sdg">Find a role and build a pathway</Link></div>}
    </div>
  );
}
