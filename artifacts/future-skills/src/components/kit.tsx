import { motion, useReducedMotion } from "framer-motion";
import { useRef, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, RotateCw, ShieldCheck, FlaskConical, Shield, TriangleAlert } from "lucide-react";
import type { AiResilience, Direction, Scenario, SdgTag } from "@workspace/api-client-react";
import { CharcoalPill } from "@/components/pill";
import { SdgIcon } from "@/components/sdg-icons";
import { cn } from "@/lib/utils";

export const SDG_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942",
  9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D", 17: "#19486A",
};

export function SdgChip({ sdg, compact }: { sdg: SdgTag; compact?: boolean }) {
  return (
    <span
      title={`${sdg.goalTitle} (${sdg.targetCode}) — ${sdg.rationale}`}
      className="inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-md border bg-card pr-2 text-xs font-medium shadow-2xs"
      data-testid={`chip-sdg-${sdg.goalNumber}`}
    >
      <span
        className="font-data inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold text-white"
        style={{ background: SDG_COLORS[sdg.goalNumber] ?? "#0B4F9E" }}
      >
        <SdgIcon goal={sdg.goalNumber} className="h-3.5 w-3.5 shrink-0 text-white" />
        <span>SDG {sdg.goalNumber}</span>
      </span>
      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{compact ? sdg.targetCode : sdg.goalTitle}</span>
    </span>
  );
}

const DIR = {
  RISING: { label: "Rising", cls: "text-primary bg-primary/10 border-primary/30", Icon: ArrowUpRight },
  STEADY: { label: "Steady", cls: "text-amber-700 bg-accent/20 border-accent/50", Icon: ArrowRight },
  SLOWING: { label: "Slowing", cls: "text-destructive bg-destructive/10 border-destructive/30", Icon: ArrowDownRight },
} as const;

export function DirectionBadge({ d, pct }: { d: Direction; pct?: number }) {
  const { label, cls, Icon } = DIR[d];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-semibold", cls)}>
      <Icon className="h-3 w-3" />
      {label}
      {pct !== undefined && <span className="font-data">{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</span>}
    </span>
  );
}

export function VerifyBadge({ status }: { status: string }) {
  const verified = status.toUpperCase().includes("VERIFIED");
  const synthetic = /SYNTHETIC|PLACEHOLDER/i.test(status);
  return (
    <span
      className={cn(
        "font-data inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        verified && !synthetic ? "border-primary/40 bg-primary/10 text-primary" : synthetic ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted text-muted-foreground",
      )}
      data-testid="status-verification"
    >
      {verified && !synthetic ? <ShieldCheck className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
      {status.replace(/_/g, " ")}
    </span>
  );
}

const SCEN: { id: Scenario; label: string; hint: string }[] = [
  { id: "baseline", label: "Low Impact", hint: "Today's hiring baseline" },
  { id: "moderate", label: "Moderate Impact", hint: "Quick adoption of automation" },
  { id: "fast", label: "High Impact", hint: "Rapid transformation across all sectors" },
];

/** Friendly display names. The scenario ids (baseline / moderate / fast) are unchanged. */
export const SCENARIO_NAMES: Record<Scenario, string> = Object.fromEntries(SCEN.map((s) => [s.id, s.label])) as Record<Scenario, string>;

export function ScenarioSwitch({ value, onChange }: { value: Scenario; onChange: (s: Scenario) => void }) {
  const reduce = useReducedMotion();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectByKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const next = (index + direction + SCEN.length) % SCEN.length;
    onChange(SCEN[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <div className="inline-flex max-w-full rounded-2xl border bg-card p-1" role="radiogroup" aria-label="AI disruption scenario">
      {SCEN.map((s, i) => (
        <button
          key={s.id}
          ref={(node) => { buttons.current[i] = node; }}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          tabIndex={value === s.id ? 0 : -1}
          onKeyDown={(event) => selectByKeyboard(event, i)}
          onClick={() => onChange(s.id)}
          data-testid={`button-scenario-${s.id}`}
          className={cn("relative min-w-0 rounded-xl px-2.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4", value === s.id ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground")}
        >
          {value === s.id && <motion.span layoutId="scen-pill" className="absolute inset-0 rounded-xl bg-primary" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="relative block text-sm font-semibold">{s.label}</span>
          <span className="relative block text-[10px] opacity-75">{s.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-5" data-testid="status-error">
      <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Could not load this data</div>
      <p className="text-sm text-muted-foreground">{message ?? "The data service did not respond. Nothing was changed."}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted" data-testid="button-retry">
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

export function PageHead({ step, kicker, title, children }: { step?: number; kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="fade-up mb-8 flex min-w-0 flex-col gap-4 pb-2 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <CharcoalPill tilt={-3}>{step ? `Step ${step} / 3` : "CTRL CV"}</CharcoalPill>
          <span className="font-data text-xs font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</span>
        </div>
        <h1 className="font-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[0.98] [overflow-wrap:anywhere] md:text-6xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Meter({ value, className, ariaLabel }: { value: number; className?: string; ariaLabel?: string }) {
  return (
    <div
      role={ariaLabel ? "progressbar" : undefined}
      aria-label={ariaLabel}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
      aria-valuenow={ariaLabel ? Math.round(Math.max(0, Math.min(1, value)) * 100) : undefined}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <motion.div className="h-full origin-left rounded-full bg-primary" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(1, value)) }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} />
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_4px_0_0_#07356c] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_0_#07356c] disabled:opacity-50 disabled:shadow-none",
  ghost: "inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/20 bg-card px-5 py-2.5 text-sm font-bold text-primary transition hover:-translate-y-0.5 hover:bg-mist active:scale-[.97] disabled:opacity-50",
  accent: "inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground transition hover:brightness-105 active:scale-[.97]",
};

const RES = {
  RESILIENT: { label: "AI-Resilient / Job Safety", cls: "text-primary bg-primary/10 border-primary/30", Icon: Shield },
  EXPOSED: { label: "Exposed / Routine", cls: "text-destructive bg-destructive/10 border-destructive/30", Icon: TriangleAlert },
} as const;

export function ResilienceBadge({ r, score, exposure, augmentation, compact }: { r: AiResilience; score?: number; exposure?: number; augmentation?: number; compact?: boolean }) {
  const v = RES[r];
  const detail = exposure !== undefined && augmentation !== undefined
    ? `Roles needing this skill: average AI Risk ${(exposure * 100).toFixed(0)}%, Job Safety ${(augmentation * 100).toFixed(0)}%${score !== undefined ? `, resilience score ${score.toFixed(2)}` : ""}. Relative to other skills; describes roles, not specific tasks.`
    : v.label;
  return (
    <span title={detail} className={cn("inline-flex shrink-0 items-center gap-1 rounded border font-medium", compact ? "px-1 py-px text-[10px]" : "px-1.5 py-0.5 text-[11px]", v.cls)} data-testid={`badge-resilience-${r.toLowerCase()}`}>
      <v.Icon className="h-3 w-3" /> {v.label}
    </span>
  );
}

export function ResilienceLegend({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md border bg-card p-3 text-xs text-muted-foreground", className)} data-testid="legend-resilience">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <ResilienceBadge r="RESILIENT" compact /> <ResilienceBadge r="EXPOSED" compact />
      </div>
      <p className="mt-2">
        Skill scores compare mean Job Safety with a scenario-weighted AI Risk penalty across roles that need the skill: mean(Job Safety) − scenario weight × mean(AI Risk × (1 − Job Safety)). The penalty is zero in Low Impact and grows in Moderate Impact and High Impact. The top half of skills is marked AI-Resilient; the rest, Exposed. These relative badges describe roles, not specific tasks.
      </p>
    </div>
  );
}
