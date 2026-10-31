import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FileUp, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import {
  useListSampleProfiles,
  useListSectors,
  useListSkills,
  type ProfileInputEducationLevel,
  type SampleProfile,
} from "@workspace/api-client-react";
import { ErrorState, PageHead, Skel, btn } from "@/components/kit";
import { CvScan, type CvScanApply } from "@/components/cv-scan";
import { MotionSection } from "@/components/motion";
import { profileDisplayLabel, resetCareerSelection, useProfile, type StoredSkill } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EDU: ProfileInputEducationLevel[] = ["SPM", "Diploma/DKM", "Bachelor", "Master/PhD"];
const PROF = ["", "Aware", "Basic", "Working", "Strong", "Expert"];

function mapEdu(e: string): ProfileInputEducationLevel {
  const s = e.toLowerCase();
  if (s.includes("spm")) return "SPM";
  if (s.includes("master") || s.includes("phd")) return "Master/PhD";
  if (s.includes("bachelor") || s.includes("degree")) return "Bachelor";
  if (s.includes("diploma") || s.includes("dkm") || s.includes("skm")) return "Diploma/DKM";
  return "SPM";
}

export default function ProfilePage() {
  const [saved, setSaved] = useProfile();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"cv" | "persona" | "manual">("cv");
  const [skills, setSkills] = useState<StoredSkill[]>(saved?.skills ?? []);
  const [edu, setEdu] = useState<ProfileInputEducationLevel>(saved?.educationLevel ?? "Bachelor");
  const [years, setYears] = useState(saved?.yearsExperience ?? 2);
  const [sectorsSel, setSectorsSel] = useState<string[]>(saved?.interestSectors ?? []);
  const [hours, setHours] = useState(saved?.weeklyLearningHours ?? 6);
  const [label, setLabel] = useState(profileDisplayLabel(saved?.label));
  const [scanApplied, setScanApplied] = useState(false);

  const merge = (incoming: StoredSkill[]) =>
    setSkills((prev) => {
      const m = new Map(prev.map((s) => [s.skillId, s]));
      incoming.forEach((s) => m.set(s.skillId, { ...s, proficiency: Math.max(m.get(s.skillId)?.proficiency ?? 0, s.proficiency) }));
      return [...m.values()];
    });

  const loadPersona = (p: SampleProfile) => {
    resetCareerSelection();
    setScanApplied(false);
    setSkills(p.skills.map((s) => ({ skillId: s.skillId, name: s.name, category: s.category, proficiency: s.proficiency })));
    setEdu(mapEdu(p.education));
    setYears(p.yearsExperience);
    setSectorsSel(p.interestSectors);
    setHours(Math.max(1, Math.min(60, p.weeklyLearningHours)));
    setLabel(`Synthetic persona ${p.profileId}`);
    toast({ title: "Synthetic persona loaded", description: `${p.skills.length} skills, ${p.personaSegment}. Review and adjust below.` });
  };

  const applyScan = (a: CvScanApply) => {
    // A new CV replaces the previous profile: skills from an earlier upload or persona must not stack.
    resetCareerSelection();
    setSkills(a.skills);
    setEdu(a.education ?? "Bachelor");
    setYears(Math.max(0, Math.min(50, a.years ?? 0)));
    if (a.sectors?.length) setSectorsSel(a.sectors);
    setLabel(a.personName);
    setScanApplied(true);
    toast({ title: "CV scan loaded", description: `${a.skills.length} skills from this CV replace any earlier skills. Check proficiency and remove anything that is wrong.` });
  };

  const save = () => {
    setSaved({ skills, educationLevel: edu, yearsExperience: years, interestSectors: sectorsSel, weeklyLearningHours: hours, label });
    nav("/matches");
  };

  return (
    <div>
      <PageHead step={1} kicker="Who you are today" title="Build your skills profile">
        <p className="max-w-sm text-sm text-muted-foreground">
          Your name and profile details stay in this browser. CV files and text are processed for scanning and are not stored.
        </p>
      </PageHead>

      <ol className="mb-8 grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-3" aria-label="Steps to see your matches">
        <li className="flex items-start gap-3">
          <span className="font-data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
          <span className="text-sm"><strong className="block">Add your skills</strong><span className="text-muted-foreground">Scan a CV, load a demo persona, or pick skills yourself.</span></span>
        </li>
        <li className="flex items-start gap-3">
          <span className="font-data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
          <span className="text-sm"><strong className="block">Review your details</strong><span className="text-muted-foreground">Check skills, education, experience and learning hours; sectors are optional.</span></span>
        </li>
        <li className="flex items-start gap-3">
          <span className="font-data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
          <span className="text-sm"><strong className="block">Save your profile</strong><span className="text-muted-foreground">Continue to role matches when your skills are ready.</span></span>
        </li>
      </ol>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-6">
          <MotionSection aria-labelledby="profile-method-title">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-data flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <h2 id="profile-method-title" className="font-display text-lg font-bold">Choose how to add skills</h2>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-md border bg-card p-1">
            {([["cv", "Scan CV (PDF)", FileUp], ["persona", "Demo persona", UserRound], ["manual", "Pick skills", Search]] as const).map(([id, l, I]) => (
              <button key={id} onClick={() => setTab(id)} data-testid={`tab-${id}`} className={cn("relative flex min-w-0 flex-col items-center justify-center gap-1 rounded px-1 py-2 text-[11px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:px-2 sm:text-sm", tab === id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {tab === id && <motion.span layoutId="intake-tab" className="absolute inset-0 rounded bg-primary" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <I className="relative h-4 w-4 shrink-0" /><span className="relative min-w-0 max-w-full break-words text-center sm:text-left">{l}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {tab === "persona" && <Personas onPick={loadPersona} />}
              {tab === "cv" && <CvScan onApply={applyScan} />}
              {tab === "manual" && <SkillPicker selected={skills} onAdd={(s) => merge([s])} />}
            </motion.div>
          </AnimatePresence>
          </MotionSection>

          <MotionSection delay={0.04} className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="font-data flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              <div>
                <h3 className="font-display text-lg font-bold">Review and complete your details</h3>
                <p className="text-xs text-muted-foreground">Check education, experience and weekly learning hours. Interest sectors are optional.</p>
              </div>
            </div>
            {scanApplied && (
              <p className="mb-4 rounded-md border border-primary/25 bg-primary/5 p-3 text-sm text-foreground" role="status" data-testid="text-after-cv-scan">
                Your CV filled in some details where it could. Check the skills and proficiency levels, then review education, years of experience and weekly learning hours. Fill in anything the scan missed; choose interest sectors if you like.
              </p>
            )}
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">Highest education</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EDU.map((e) => (
                    <button key={e} onClick={() => setEdu(e)} data-testid={`button-edu-${e}`} className={cn("rounded border px-3 py-2 text-sm font-medium transition", edu === e ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Range label="Years of professional work experience" value={years} min={0} max={50} onChange={setYears} suffix="yrs" id="years" />
                <Range label="Weekly learning hours" value={hours} min={1} max={60} onChange={setHours} suffix="h/wk" id="hours" />
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">Count paid jobs and internships only. Study, projects and extracurricular activities do not count. This is what you state or the CV scan found; it is not independently verified.</p>
              <SectorPick value={sectorsSel} onChange={setSectorsSel} />
            </div>
          </MotionSection>
        </div>

        <MotionSection delay={0.08} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-bold">Your skills</div>
                <label htmlFor="profile-holder-name" className="mt-1 block text-[11px] font-medium text-muted-foreground">Name on role pass</label>
                <input
                  id="profile-holder-name"
                  value={label ?? ""}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={120}
                  placeholder={skills.length > 0 ? "Enter your name" : "Not started"}
                  className="mt-1 w-full min-w-0 rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  data-testid="input-profile-holder-name"
                />
              </div>
              <span className="font-data rounded bg-primary px-2 py-1 text-sm font-semibold text-primary-foreground" data-testid="text-skill-count">{skills.length}</span>
            </div>
            <div className="touch-scroll max-h-[46vh] space-y-1 overflow-y-auto p-2">
              {skills.length === 0 && (
                <div className="grid-paper m-2 rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Upload a CV, load a persona, or pick skills. They will appear here so you can adjust proficiency.
                </div>
              )}
              <AnimatePresence initial={false}>
                {skills.map((s) => (
                  <motion.div key={s.skillId} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{s.category} · {PROF[s.proficiency]}</div>
                    </div>
                    <Dots value={s.proficiency} onChange={(v) => setSkills((p) => p.map((x) => (x.skillId === s.skillId ? { ...x, proficiency: v } : x)))} id={s.skillId} />
                    <button onClick={() => setSkills((p) => p.filter((x) => x.skillId !== s.skillId))} className="rounded p-1 text-muted-foreground hover:text-destructive" data-testid={`button-remove-${s.skillId}`} aria-label="Remove skill"><X className="h-3.5 w-3.5" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="space-y-2 border-t bg-primary/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="font-data flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span>Ready to see your matches?</span>
              </div>
              <button onClick={save} disabled={skills.length === 0} className={btn.primary + " min-h-14 w-full px-5 py-4 text-base sm:text-lg"} data-testid="button-save-profile">
                Save and see my matches <ArrowRight className="h-4 w-4" />
              </button>
              {skills.length > 0 && (
                <button onClick={() => { setSkills([]); setLabel(undefined); setSaved(null); resetCareerSelection(); }} className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-destructive" data-testid="button-clear-profile">
                  <Trash2 className="h-3 w-3" /> Clear profile
                </button>
              )}
            </div>
          </div>
        </MotionSection>
      </div>
    </div>
  );
}

function Dots({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Proficiency">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} title={PROF[n]} data-testid={`button-prof-${id}-${n}`} className={cn("h-4 w-2.5 rounded-[2px] transition-all hover:scale-y-125", n <= value ? "bg-primary" : "bg-border")} />
      ))}
    </div>
  );
}

function Range({ label, value, min, max, onChange, suffix, id }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; suffix: string; id: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <span className="font-data text-sm text-primary">{value} {suffix}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" data-testid={`input-${id}`} />
    </div>
  );
}

function SectorPick({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const q = useListSectors();
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">Interest sectors <span className="font-normal text-muted-foreground">(optional)</span></label>
      {q.isLoading && <Skel className="h-16" />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      <div className="flex flex-wrap gap-1.5">
        {q.data?.map((s) => {
          const on = value.includes(s.name);
          return (
            <button key={s.name} onClick={() => onChange(on ? value.filter((x) => x !== s.name) : [...value, s.name])} data-testid={`button-sector-${s.name}`} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50")}>
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Personas({ onPick }: { onPick: (p: SampleProfile) => void }) {
  const q = useListSampleProfiles();
  if (q.isLoading) return <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-32" />)}</div>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground"><span className="font-data rounded bg-accent/30 px-1.5 py-0.5 font-semibold text-foreground">SYNTHETIC</span> These personas are generated for demonstration. They are not real people.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((p, i) => (
          <button key={p.profileId} onClick={() => onPick(p)} data-testid={`button-persona-${p.profileId}`} className="fade-up group rounded-lg border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between">
              <span className="font-data text-[11px] uppercase tracking-wider text-primary">{p.personaSegment}</span>
              <span className="font-data text-[10px] text-muted-foreground">{p.profileId}</span>
            </div>
            <div className="font-display mt-2 font-bold leading-tight">{p.currentRoleTitle ?? `${p.fieldOfStudy} graduate`}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.education} · {p.yearsExperience} yrs · {p.state}</div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span>{p.skills.length} skills · {p.weeklyLearningHours} h/wk</span>
              <span className="font-semibold text-primary opacity-0 transition group-hover:opacity-100">Load</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SkillPicker({ selected, onAdd }: { selected: StoredSkill[]; onAdd: (s: StoredSkill) => void }) {
  const q = useListSkills();
  const [term, setTerm] = useState("");
  const [lvl, setLvl] = useState(3);
  const have = useMemo(() => new Set(selected.map((s) => s.skillId)), [selected]);
  const results = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = q.data ?? [];
    return (t ? list.filter((s) => s.name.toLowerCase().includes(t) || s.category.toLowerCase().includes(t) || s.synonyms.some((y) => y.toLowerCase().includes(t))) : list).slice(0, 40);
  }, [q.data, term]);
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={`Search ${q.data?.length ?? ""} skills, e.g. "data", "Bahasa", "welding"`} className="w-full rounded-md border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="input-skill-search" />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Add at</span>
          <Dots value={lvl} onChange={setLvl} id="new" />
          <span className="font-data w-14 text-primary">{PROF[lvl]}</span>
        </div>
      </div>
      <div className="touch-scroll mt-3 max-h-72 space-y-0.5 overflow-y-auto">
        {q.isLoading && Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="mb-1 h-9" />)}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {results.map((s) => (
          <button key={s.skillId} disabled={have.has(s.skillId)} onClick={() => onAdd({ skillId: s.skillId, name: s.name, category: s.category, proficiency: lvl })} data-testid={`button-add-${s.skillId}`} className="flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-40">
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span className="min-w-0 flex-1 font-medium">{s.name}</span>
            <span className="max-w-[40%] truncate text-right text-xs text-muted-foreground">{s.category}</span>
          </button>
        ))}
        {q.data && results.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No skill matches "{term}". Try a broader word.</div>}
      </div>
    </div>
  );
}
