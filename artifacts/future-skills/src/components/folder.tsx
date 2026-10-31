import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type FolderStep = { n: number; label: string; href: string; active: boolean; done: boolean };

/** Notched blue folder ears: navy (back) / royal (middle) / sky (active front). */
export function FolderTabs({ steps }: { steps: FolderStep[] }) {
  const activeIdx = steps.findIndex((s) => s.active);
  return (
    <ol className="relative flex items-end pl-1 sm:pl-3" data-testid="nav-steps">
      {steps.map((s, i) => {
        const dist = activeIdx < 0 ? i : Math.abs(i - activeIdx);
        const tone = s.active ? "bg-sky text-charcoal" : i % 2 === 0 ? "bg-navy text-white" : "bg-royal text-white";
        return (
          <li key={s.n} className={cn("min-w-0 flex-1", i > 0 && "-ml-1.5 sm:-ml-5")} style={{ zIndex: s.active ? 30 : 20 - dist }}>
            <motion.div whileHover={{ y: s.active ? 0 : -4 }} whileTap={{ scale: 0.97 }} animate={{ y: s.active ? 0 : 5 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}>
              <Link
                href={s.href}
                data-testid={`link-step-${s.label.toLowerCase()}`}
                style={{ clipPath: "polygon(0 100%, 2.5% 38%, 7% 0, 88% 0, 93% 38%, 100% 100%)" }}
                className={cn("group relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pb-2 pt-2 sm:min-h-0 sm:flex-row sm:gap-2.5 sm:px-7 sm:pb-2.5 sm:pt-3", s.active && "pt-3 sm:pt-5", tone)}
              >
                <span className={cn("font-data flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-[11px]", s.active ? "bg-charcoal text-white" : "bg-white/20 text-white")}>
                  {s.done && !s.active ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n}
                </span>
                <span className="font-display max-w-full truncate text-[10px] font-bold leading-tight sm:text-base">{s.label}</span>
              </Link>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}

/** Front folder: sky shell, 28px radius, holding a cream dot-grid panel for white cards. */
export function FolderShell({ children, firstTabActive }: { children: ReactNode; firstTabActive?: boolean }) {
  return (
    <div className={cn("relative z-0 rounded-[28px] rounded-tl-none bg-sky p-2.5 shadow-[0_24px_40px_-24px_rgba(11,79,158,0.65)] sm:p-4", !firstTabActive && "rounded-tl-none")} data-testid="folder-shell">
      <div className="dot-panel min-h-[60vh] min-w-0 rounded-[20px] p-3 sm:p-6 md:p-9">{children}</div>
    </div>
  );
}
