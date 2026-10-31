import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useHealthCheck } from "@workspace/api-client-react";
import { useTargetRole, useProfile } from "@/lib/store";
import { FolderShell, FolderTabs } from "@/components/folder";
import { cn } from "@/lib/utils";
import { GuideChat } from "@/components/guide-chat";
import { RadarAssistiveBubble } from "@/components/radar-bubble";

export function Shell({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const [profile] = useProfile();
  const [lastRole] = useTargetRole();
  const health = useHealthCheck();
  const reduce = useReducedMotion();
  const roleFromRadar = loc.startsWith("/roles/") && new URLSearchParams(window.location.search).get("from") === "radar";

  const steps = [
    { n: 1, label: "Profile", href: "/profile", active: loc.startsWith("/profile"), done: !!profile },
    { n: 2, label: "Matches", href: "/matches", active: loc.startsWith("/matches") || (loc.startsWith("/roles") && !roleFromRadar), done: !!lastRole },
    { n: 3, label: "Pathway", href: lastRole ? `/pathway/${lastRole.id}` : "/matches", active: loc.startsWith("/pathway"), done: false },
  ];
  const isHome = loc === "/";

  const page = (
    <motion.div
      key={loc}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformOrigin: "top center" }}
    >
      {children}
    </motion.div>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:gap-4 sm:px-4 sm:py-4 md:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" data-testid="link-home">
          <img src="/logo.png" alt="CTRL CV" className="h-9 w-auto object-contain" />
          <div className="min-w-0 leading-none">
            <div className="font-display text-[18px] font-black tracking-tight text-foreground sm:text-[20px]">CTRL CV</div>
            <div className="font-data mt-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:mt-0.5 sm:text-[10px] sm:tracking-[0.2em]">Future Skills</div>
          </div>
        </Link>
        <nav className="ml-auto flex max-w-full flex-wrap items-center gap-1 text-xs sm:gap-2 sm:text-sm">
          <Link href="/sdgs" className={cn("rounded-full px-2.5 py-1.5 font-semibold transition active:scale-95 hover:bg-mist sm:px-3.5 sm:py-1.5", loc === "/sdgs" && "bg-charcoal text-white hover:bg-charcoal")} data-testid="link-sdgs">SDGs</Link>
          <Link href="/about" className={cn("rounded-full px-2.5 py-1.5 font-semibold transition active:scale-95 hover:bg-mist sm:px-3.5 sm:py-1.5", loc === "/about" && "bg-charcoal text-white hover:bg-charcoal")} data-testid="link-about">Sources</Link>
          <span className="font-data ml-2 hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] text-muted-foreground sm:flex" data-testid="status-health">
            <span className={cn("h-2 w-2 rounded-full", health.data ? "bg-royal" : health.isError ? "bg-destructive" : "bg-accent")} />
            {health.data ? "Data live" : health.isError ? "Offline" : "Connecting"}
          </span>
        </nav>
      </header>

      {isHome ? (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-2 md:px-8">{page}</main>
      ) : (
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-2 pb-12 pt-3 sm:px-4 md:px-8">
          <FolderTabs steps={steps} />
          <FolderShell firstTabActive={steps[0].active}>{page}</FolderShell>
        </main>
      )}

      <footer className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-8">
        <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>Estimates, not guarantees. This tool supports your decision; it does not make hiring decisions.</span>
          <span className="font-data rounded-full bg-mist px-3 py-1 text-navy">UN SDG 4 · SDG 8 · Malaysia</span>
        </div>
      </footer>
      <RadarAssistiveBubble />
      <GuideChat />
    </div>
  );
}
