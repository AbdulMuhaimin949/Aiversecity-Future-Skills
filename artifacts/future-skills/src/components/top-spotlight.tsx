import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMatchRoles, type RoleMatch } from "@workspace/api-client-react";
import { useProfile, useScenario, type StoredProfile } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Same request the Matches page makes (stored profile + scenario). Returns the ranked list. */
export function useTopMatches(profileOverride?: StoredProfile | null): { matches: RoleMatch[]; pending: boolean } {
  const [storedProfile] = useProfile();
  const profile = profileOverride === undefined ? storedProfile : profileOverride;
  const [scenario] = useScenario();
  const m = useMatchRoles();
  const ref = useRef(m.mutate);
  ref.current = m.mutate;
  useEffect(() => {
    if (!profile) return;
    ref.current({
      data: {
        skills: profile.skills.map((s) => ({ skillId: s.skillId, proficiency: s.proficiency })),
        educationLevel: profile.educationLevel,
        yearsExperience: profile.yearsExperience,
        interestSectors: profile.interestSectors,
        weeklyLearningHours: profile.weeklyLearningHours,
        scenario,
        limit: 12,
      },
    });
  }, [profile, scenario]);
  return { matches: m.data?.matches ?? [], pending: m.isPending };
}

const TONES = [
  { tab: "bg-navy text-white", shell: "bg-navy" },
  { tab: "bg-royal text-white", shell: "bg-royal" },
  { tab: "bg-sky text-charcoal", shell: "bg-sky" },
] as const;

/** Stacked #1/#2/#3 folder ears + a coloured folder body that holds the pass and details. */
export function TopSpotlight({ matches, selectedId, onSelect, children }: { matches: RoleMatch[]; selectedId: string; onSelect: (m: RoleMatch) => void; children: ReactNode }) {
  const top = matches.slice(0, 3);
  const selIdx = top.findIndex((m) => m.occupationId === selectedId);
  const tone = TONES[selIdx >= 0 ? selIdx : 0];
  return (
    <section data-testid="section-top3" aria-label="Your top three matches">
      <ol className="relative z-10 -mb-px flex items-end px-2">
        {top.map((m, i) => {
          const active = i === selIdx;
          return (
            <li key={m.occupationId} className={cn("min-w-0 flex-1", i > 0 && "-ml-3")} style={{ zIndex: active ? 20 : 10 - i }}>
              <motion.button
                onClick={() => onSelect(m)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                animate={{ y: active ? 0 : 7 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                data-testid={`tab-top-${m.rank}`}
                aria-pressed={active}
                style={{ clipPath: "polygon(0 100%, 2% 34%, 6% 0, 90% 0, 95% 34%, 100% 100%)" }}
                className={cn("flex w-full flex-col items-start px-4 pb-2 pt-3 text-left sm:px-6", TONES[i].tab, active && "pt-4")}
              >
                <span className="font-data text-[10px] font-bold tracking-widest">#{i + 1}</span>
                <span className="font-display line-clamp-1 w-full text-xs font-bold sm:text-sm">{m.title}</span>
              </motion.button>
            </li>
          );
        })}
      </ol>
      <div className={cn("rounded-[26px] p-2.5 transition-colors duration-500 sm:p-3.5", tone.shell, selIdx === 0 && "rounded-tl-none")}>
        <div className="rounded-[18px] bg-white p-4 sm:p-6">{children}</div>
      </div>
    </section>
  );
}
