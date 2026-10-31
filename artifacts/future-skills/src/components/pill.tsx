import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Floating tilted charcoal badge that overlaps card corners. */
export function CharcoalPill({ children, tilt = -3, className, testId }: { children: ReactNode; tilt?: number; className?: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{ transform: `rotate(${tilt}deg)` }}
      className={cn("font-data inline-flex items-center gap-1.5 rounded-xl bg-charcoal px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_6px_14px_-6px_rgba(24,25,28,0.6)]", className)}
    >
      {children}
    </span>
  );
}
