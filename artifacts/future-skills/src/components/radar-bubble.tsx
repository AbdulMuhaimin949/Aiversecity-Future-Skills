import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Maximize2,
  Radar as RadarIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  getGetRadarQueryKey,
  useGetRadar,
  type Radar,
  type Scenario,
} from "@workspace/api-client-react";
import { SCENARIO_NAMES } from "@/components/kit";
import { useScenario } from "@/lib/store";
import { cn } from "@/lib/utils";

const SCENARIOS: { id: Scenario; short: string }[] = [
  { id: "baseline", short: "Low Impact" },
  { id: "moderate", short: "Moderate" },
  { id: "fast", short: "High Impact" },
];

type Tab = "rising" | "slowing" | "skills";

/** Animated high-tech Radar scanner scope with rotating beam, range rings and target blips */
function AnimatedRadarScope({ size = 32 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full border border-sky-400/50 bg-gradient-to-br from-slate-950 via-[#0B254E] to-[#0A1628] shadow-[inset_0_0_10px_rgba(56,189,248,0.45)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Concentric range rings */}
      <span className="pointer-events-none absolute inset-[3px] rounded-full border border-sky-400/30" />
      <span className="pointer-events-none absolute inset-[7px] rounded-full border border-dashed border-sky-400/40" />

      {/* Crosshair axes */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-sky-400/25" />
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sky-400/25" />

      {/* Detected signal blips */}
      <span className="absolute top-[20%] right-[22%] h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
      <span className="absolute bottom-[24%] left-[26%] h-1 w-1 rounded-full bg-cyan-300 opacity-90 shadow-[0_0_5px_#38bdf8]" />

      {/* Center origin beacon */}
      <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />

      {/* Continuous 360° sweeping radar beam */}
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-0 origin-center rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(56,189,248,0.9) 0deg, rgba(56,189,248,0.25) 45deg, transparent 75deg, transparent 360deg)",
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 2.2 }}
        />
      )}
    </div>
  );
}

/**
 * AssistiveTouch-style draggable floating Radar bubble.
 * Lets users inspect rising & slowing roles/skills from any screen without
 * interrupting the 1 Profile -> 2 Matches -> 3 Pathway flow.
 */
export function RadarAssistiveBubble() {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("rising");
  const [scenario, setScenario] = useScenario();
  const reduce = useReducedMotion();

  // Draggable position state (persisted in session)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const updateDefault = () => {
      setPos((prev) => {
        if (prev) {
          const maxX = window.innerWidth - 72;
          const maxY = window.innerHeight - 88;
          return {
            x: Math.max(12, Math.min(maxX, prev.x)),
            y: Math.max(72, Math.min(maxY, prev.y)),
          };
        }
        return {
          x: Math.max(16, window.innerWidth - 84),
          y: Math.max(120, Math.round(window.innerHeight * 0.42)),
        };
      });
    };
    updateDefault();
    window.addEventListener("resize", updateDefault);
    return () => window.removeEventListener("resize", updateDefault);
  }, []);

  const params = { scenario };
  const q = useGetRadar(params, {
    query: {
      queryKey: getGetRadarQueryKey(params),
      placeholderData: (p: Radar | undefined) => p,
    },
  });
  const r = q.data;

  const rising = r
    ? [...r.roles]
        .filter((x) => x.direction === "RISING")
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, 5)
    : [];
  const slowing = r
    ? [...r.roles]
        .filter((x) => x.direction === "SLOWING")
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, 5)
    : [];
  const skillsUp = r
    ? [...r.skills]
        .filter((x) => x.direction === "RISING")
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, 4)
    : [];
  const skillsDown = r
    ? [...r.skills]
        .filter((x) => x.direction === "SLOWING")
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, 4)
    : [];

  const isOnRadarPage = loc.startsWith("/radar");

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: pos.x,
      py: pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 6) {
      draggingRef.current = true;
    }
    if (draggingRef.current) {
      const maxX = window.innerWidth - 72;
      const maxY = window.innerHeight - 88;
      setPos({
        x: Math.max(12, Math.min(maxX, start.px + dx)),
        y: Math.max(72, Math.min(maxY, start.py + dy)),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragging = draggingRef.current;
    dragStartRef.current = null;
    draggingRef.current = false;

    if (wasDragging) {
      // Snap to nearest horizontal screen edge like iOS AssistiveTouch
      setPos((prev) => {
        if (!prev) return prev;
        const mid = window.innerWidth / 2;
        const snapX = prev.x + 32 < mid ? 16 : Math.max(16, window.innerWidth - 84);
        return { x: snapX, y: prev.y };
      });
    } else {
      setOpen((prev) => !prev);
    }
  };

  if (!pos) return null;

  const isLeftSide = pos.x < window.innerWidth / 2;

  return (
    <>
      {/* Draggable AssistiveTouch Bubble */}
      <motion.button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Open Future Skills Radar assistive menu"
        aria-expanded={open}
        data-testid="button-radar-assistive"
        title="Drag to move · Click for Future Skills Radar"
        className={cn(
          "group fixed z-50 flex h-[70px] w-[70px] select-none flex-col items-center justify-center rounded-[24px] border border-sky-400/40 bg-slate-950/90 text-white shadow-[0_12px_36px_-6px_rgba(11,79,158,0.7),0_0_16px_rgba(56,189,248,0.3)] backdrop-blur-xl transition-all hover:border-sky-300 hover:shadow-[0_16px_40px_-6px_rgba(14,165,233,0.85),0_0_24px_rgba(56,189,248,0.5)]",
          open && "border-sky-300 ring-4 ring-sky-400/40 bg-slate-900 shadow-[0_0_28px_rgba(56,189,248,0.6)]",
          isOnRadarPage && "border-sky-400 ring-2 ring-sky-400/30",
        )}
      >
        {/* Breathing ambient radar glow halo */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[26px] bg-sky-400/15 blur-sm animate-pulse [animation-duration:3s]"
        />

        {/* Glossy top-rim bevel highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-t-[20px] bg-gradient-to-b from-white/20 to-transparent"
        />

        {/* Animated Radar Scanner Core with rotating beam & targets */}
        <AnimatedRadarScope size={34} />

        {/* High-Tech Radar Label with live green indicator */}
        <span className="font-data relative z-10 mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.16em] text-sky-200 group-hover:text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          Radar
        </span>
      </motion.button>

      {/* AssistiveTouch Popover Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="radar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-charcoal/20 backdrop-blur-[1px]"
            />
            <motion.aside
              key="radar-hud"
              role="dialog"
              aria-label="Future Skills Radar quick view"
              data-testid="panel-radar-assistive"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                top: Math.max(16, Math.min(window.innerHeight - 520, pos.y - 140)),
                ...(isLeftSide
                  ? { left: Math.min(window.innerWidth - 376, pos.x + 76) }
                  : { right: Math.max(16, window.innerWidth - pos.x + 12) }),
              }}
              className="fixed z-50 flex max-h-[min(520px,calc(100dvh-32px))] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-[26px] border-2 border-sky bg-white shadow-[0_24px_50px_-12px_rgba(11,79,158,0.55)]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-navy via-royal to-sky p-4 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <AnimatedRadarScope size={36} />
                    <div>
                      <div className="font-data text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                        Market Pulse · Assistive Radar
                      </div>
                      <h3 className="font-display text-lg font-extrabold leading-tight">
                        Rising &amp; Slowing
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close Radar menu"
                    className="rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25"
                    data-testid="button-close-radar-assistive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Scenario Switcher */}
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-charcoal/35 p-1">
                  {SCENARIOS.map((s) => {
                    const active = scenario === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScenario(s.id)}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
                          active
                            ? "bg-white text-navy shadow-sm"
                            : "text-white/85 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        {s.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-navigation Tabs */}
              <div className="grid grid-cols-3 border-b bg-mist/50 p-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTab("rising")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 transition",
                    tab === "rising"
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Rising ({rising.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("slowing")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 transition",
                    tab === "slowing"
                      ? "bg-white text-destructive shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  Slowing ({slowing.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("skills")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg py-1.5 transition",
                    tab === "skills"
                      ? "bg-white text-navy shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 text-royal" />
                  Skills
                </button>
              </div>

              {/* Body List */}
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {q.isLoading && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Loading {SCENARIO_NAMES[scenario]} forecast...
                  </div>
                )}

                {!q.isLoading && tab === "rising" && (
                  <>
                    <p className="px-1 text-[11px] text-muted-foreground">
                      Fastest growing roles under <strong>{SCENARIO_NAMES[scenario]}</strong>:
                    </p>
                    {rising.map((role) => (
                      <Link
                        key={role.occupationId}
                        href={`/roles/${role.occupationId}?from=radar`}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 text-left transition hover:border-primary/40 hover:bg-mist/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-foreground">
                            {role.title}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {role.sector} · AI Risk {(role.aiExposure * 100).toFixed(0)}%
                          </div>
                        </div>
                        <span className="font-data inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          <ArrowUpRight className="h-3 w-3" />+{role.changePct.toFixed(1)}%
                        </span>
                      </Link>
                    ))}
                  </>
                )}

                {!q.isLoading && tab === "slowing" && (
                  <>
                    <p className="px-1 text-[11px] text-muted-foreground">
                      Roles facing strongest headwinds under <strong>{SCENARIO_NAMES[scenario]}</strong>:
                    </p>
                    {slowing.map((role) => (
                      <Link
                        key={role.occupationId}
                        href={`/roles/${role.occupationId}?from=radar`}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 text-left transition hover:border-destructive/40 hover:bg-destructive/5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-foreground">
                            {role.title}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {role.sector} · AI Risk {(role.aiExposure * 100).toFixed(0)}%
                          </div>
                        </div>
                        <span className="font-data inline-flex shrink-0 items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                          <ArrowDownRight className="h-3 w-3" />
                          {role.changePct > 0 ? `+${role.changePct.toFixed(1)}%` : `${role.changePct.toFixed(1)}%`}
                        </span>
                      </Link>
                    ))}
                  </>
                )}

                {!q.isLoading && tab === "skills" && (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Skills Gaining Demand
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {skillsUp.map((s) => (
                          <span
                            key={s.skillId}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-mist px-2.5 py-1 text-[11px] font-semibold text-navy"
                          >
                            {s.name}
                            <span className="font-data text-[10px] font-bold text-primary">
                              +{s.changePct.toFixed(1)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                        Skills Slowing Down
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {skillsDown.map((s) => (
                          <span
                            key={s.skillId}
                            className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/5 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                          >
                            {s.name}
                            <span className="font-data text-[10px] font-bold">
                              {s.changePct.toFixed(1)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Action */}
              <div className="border-t bg-mist/40 p-3">
                <Link
                  href="/radar"
                  onClick={() => setOpen(false)}
                  data-testid="link-open-full-radar"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-royal active:scale-98"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Open Full Interactive Radar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
