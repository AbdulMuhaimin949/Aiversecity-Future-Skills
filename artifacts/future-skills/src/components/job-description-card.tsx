// artifacts/future-skills/src/components/job-description-card.tsx
// Role scope card: official MASCO description + AI collaboration breakdown (values from existing role data)

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Briefcase, Sparkles, Bot, BrainCircuit, ChevronDown, GraduationCap, Award, Info } from "lucide-react";
import { useGetOccupation, getGetOccupationQueryKey } from "@workspace/api-client-react";
import { Skel } from "@/components/kit";
import { cn } from "@/lib/utils";

interface JobDescriptionCardProps {
  occupationId: string;
  defaultExpanded?: boolean;
}

/** Turns pipeline codes such as "SDG_09" into readable text without changing the meaning. */
function cleanDescription(text: string): string {
  return text.replace(/SDG_0?(\d+)/g, "UN SDG $1");
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10" aria-hidden="true">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn("h-full rounded-full", className)}
      />
    </div>
  );
}

export function JobDescriptionCard({ occupationId, defaultExpanded = true }: JobDescriptionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const q = useGetOccupation(occupationId, {
    query: { enabled: !!occupationId, queryKey: getGetOccupationQueryKey(occupationId) },
  });
  const occ = q.data;

  if (q.isLoading) return <Skel className="h-44 w-full rounded-2xl" />;
  if (!occ) return null;

  const exposurePct = Math.round(occ.aiExposure * 100);
  const augmentationPct = Math.round(occ.aiAugmentation * 100);
  const coreSkills = occ.skills.filter((s) => s.importance === "Required").slice(0, 5);
  const skillNames = coreSkills.map((s) => s.name);
  const skillList = skillNames.length > 2 ? `${skillNames.slice(0, 2).join(", ")} and more` : skillNames.join(" and ");

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200/80 bg-white/95 shadow-xs dark:border-sky-900/40 dark:bg-card/90" data-testid="job-description-card">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-50/70 dark:hover:bg-muted/40 sm:px-5"
        aria-expanded={isExpanded}
        data-testid="button-toggle-job-description"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-data text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                MASCO {occ.mascoCode} · {occ.sector}
              </span>
              {occ.mycolStatus === "CRITICAL_SHORTAGE" && (
                <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" title="Listed as a critical occupation by TalentCorp MyCOL">
                  Talent shortage in Malaysia
                </span>
              )}
            </div>
            <h3 className="font-display text-base font-bold text-foreground sm:text-lg">About this role</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="hidden sm:inline">{isExpanded ? "Collapse" : "View details"}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100 dark:border-border/60"
          >
            <div className="space-y-4 p-4 sm:p-5">
              {/* Official description */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Official job description · MASCO 2020
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{cleanDescription(occ.description)}</p>
              </div>

              {/* Quick facts */}
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-muted/40">
                  <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground"><GraduationCap className="h-3 w-3" />Education</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{occ.minEducation}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-muted/40">
                  <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground"><Award className="h-3 w-3" />Experience</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    {occ.minExperienceYears === 0 ? "None needed" : `${occ.minExperienceYears} yrs`}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">({occ.careerLevel})</span>
                  </dd>
                </div>
                <div className="col-span-2 rounded-lg bg-slate-50 p-2.5 dark:bg-muted/40 sm:col-span-1">
                  <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Core skills</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {coreSkills.length === 0 && <span className="text-xs text-muted-foreground">Not available</span>}
                    {coreSkills.map((s) => (
                      <span key={s.skillId} className="rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-border dark:bg-card">{s.name}</span>
                    ))}
                  </dd>
                </div>
              </dl>

              {/* AI collaboration */}
              <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 via-slate-50/40 to-white p-3.5 dark:border-blue-900/30 dark:from-blue-950/20 dark:to-card">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    How AI works with this role
                  </span>
                  <span className="font-data text-[10px] text-muted-foreground">Based on Anthropic Economic Index &amp; ILO research</span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20" data-testid="card-human-led">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" />Where you lead</span>
                      <span className="font-data text-sm font-bold text-emerald-800 dark:text-emerald-300">{augmentationPct}%</span>
                    </div>
                    <Bar pct={augmentationPct} className="bg-emerald-500" />
                    <p className="mt-2 text-[11px] leading-relaxed text-emerald-950/80 dark:text-emerald-200/80">
                      AI can support this role's work, but people still make the decisions: judging quality, understanding what the client or team needs, explaining your choices and taking responsibility for the result.
                    </p>
                  </div>

                  <div className="rounded-lg border border-blue-200/70 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20" data-testid="card-ai-helps">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300"><Bot className="h-3.5 w-3.5" />Where AI speeds you up</span>
                      <span className="font-data text-sm font-bold text-blue-800 dark:text-blue-300">{exposurePct}%</span>
                    </div>
                    <Bar pct={exposurePct} className="bg-blue-500" />
                    <p className="mt-2 text-[11px] leading-relaxed text-blue-950/80 dark:text-blue-200/80">
                      {skillList
                        ? `AI tools can draft, check and speed up routine work in areas like ${skillList}. Learn to use them well and review their output.`
                        : "AI tools can draft, check and speed up routine work in this role. Learn to use them well and review their output."}
                    </p>
                  </div>
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  These are role-level scores, not a prediction that you will lose or keep a job. They show how much of the role's work AI may touch, and how much still needs a person.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
