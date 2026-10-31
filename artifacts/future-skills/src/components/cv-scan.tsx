import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, FileText, FileUp, GraduationCap, Briefcase, Compass, Loader2, ScanText } from "lucide-react";
import { useScanCv, type CvScanResult, type ProfileInputEducationLevel } from "@workspace/api-client-react";
import type { StoredSkill } from "@/lib/store";
import { btn } from "@/components/kit";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const PROF = ["", "Aware", "Basic", "Working", "Strong", "Expert"];

export type CvScanApply = {
  skills: StoredSkill[];
  education?: ProfileInputEducationLevel;
  years?: number;
  sectors?: string[];
  personName: string;
};

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
}

function errorText(err: unknown): string {
  const d = (err as { data?: { error?: string } } | null)?.data;
  if (d?.error) return d.error;
  return "The scan service did not respond. Nothing was changed — please try again.";
}

function pdfFilenameLabel(fileName: string | null): string | null {
  if (!fileName) return null;
  const basename = fileName.replace(/\\/gu, "/").split("/").pop() ?? "";
  const label = basename
    .replace(/\.pdf$/iu, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return label || null;
}

export function CvScan({ onApply }: { onApply: (a: CvScanApply) => void }) {
  const scan = useScanCv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [text, setText] = useState("");

  const sendFile = async (f: File) => {
    setLocalError(null);
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setLocalError("Please choose a PDF file (.pdf).");
    if (f.size > MAX_BYTES) return setLocalError("This PDF is larger than 5 MB. Please upload a smaller file.");
    try {
      const fileBase64 = await readAsBase64(f);
      scan.mutate({ data: { fileName: f.name, fileBase64 } });
    } catch {
      setLocalError("Could not read the file from your device.");
    }
  };

  const sendText = () => {
    setLocalError(null);
    scan.mutate({ data: { text: text.slice(0, 50000) } });
  };

  const error = localError ?? (scan.isError ? errorText(scan.error) : null);

  return (
    <div className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !scan.isPending && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void sendFile(f); }}
        data-testid="dropzone-cv"
        className={cn(
          "grid-paper relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-9 text-center transition",
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
          scan.isPending && "cursor-wait",
        )}
      >
        {scan.isPending ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="font-semibold">Scanning your CV…</div>
            <div className="text-xs text-muted-foreground">Reading the text, then matching skills, education and work dates</div>
          </>
        ) : (
          <>
            <FileUp className="h-8 w-8 text-primary" />
            <div className="font-display text-lg font-bold">Upload your CV (PDF)</div>
            <div className="text-sm text-muted-foreground">Drop it here or click to choose · any industry · max 5 MB</div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f); e.target.value = ""; }}
          data-testid="input-cv-pdf"
        />
      </div>

      <div className="flex flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 text-muted-foreground">Processed on our server and not stored. Use a CV with selectable text (not a photo/scan).</span>
        <button onClick={() => setShowPaste((v) => !v)} className="shrink-0 font-semibold text-primary" data-testid="button-toggle-paste">
          {showPaste ? "Hide text box" : "Or paste text"}
        </button>
      </div>

      {showPaste && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="e.g. Staff nurse with 6 years of ward experience. Medication administration, infection control, BLS certified. Diploma in Nursing..."
            className="w-full resize-y rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-cv"
          />
          <div className="flex justify-end">
            <button onClick={sendText} disabled={text.trim().length < 20 || scan.isPending} className={btn.primary} data-testid="button-scan-text">
              <ScanText className="h-4 w-4" /> Scan text
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" data-testid="status-scan-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      {scan.data && !scan.isPending && <ScanReview key={scan.data.characterCount + (scan.data.fileName ?? "")} r={scan.data} onApply={onApply} />}
    </div>
  );
}

function ScanReview({ r, onApply }: { r: CvScanResult; onApply: (a: CvScanApply) => void }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(r.skills.map((s) => s.skillId)));
  const [useEdu, setUseEdu] = useState(r.suggestedEducation !== null);
  const [useYears, setUseYears] = useState(r.suggestedYearsExperience !== null);
  const [useSectors, setUseSectors] = useState(r.suggestedSectors.length > 0);
  const [personName, setPersonName] = useState(r.personName?.trim() || pdfFilenameLabel(r.fileName) || "");
  const [applied, setApplied] = useState(false);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const apply = () => {
    onApply({
      skills: r.skills.filter((s) => picked.has(s.skillId)).map((s) => ({ skillId: s.skillId, name: s.name, category: s.category, proficiency: s.proficiency })),
      education: useEdu && r.suggestedEducation ? (r.suggestedEducation as ProfileInputEducationLevel) : undefined,
      years: useYears && r.suggestedYearsExperience !== null ? Math.round(r.suggestedYearsExperience) : undefined,
      sectors: useSectors ? r.suggestedSectors.map((s) => s.sector) : undefined,
      personName: personName.trim() || "CV profile",
    });
    setApplied(true);
  };

  const ai = r.engine === "AI_MODEL";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 border-t pt-4" data-testid="panel-scan-result">
      <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2" data-testid="scan-result-header">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-[1_1_12rem] break-words text-sm font-semibold [overflow-wrap:anywhere]" data-testid="text-scan-person-name">
          {r.personName ?? "Person name not identified"}
        </span>
        <span className="font-data min-w-0 max-w-full break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]" data-testid="text-scan-metadata">
          {r.pageCount !== null ? `${r.pageCount} page${r.pageCount === 1 ? "" : "s"} · ` : ""}{r.characterCount.toLocaleString()} characters
        </span>
        <span className={cn("font-data max-w-full shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", ai ? "bg-accent/40 text-foreground" : "bg-muted text-muted-foreground")} data-testid="text-scan-engine">
          {ai ? "AI model" : "Rule-based · no AI"}
        </span>
      </div>

      <div className="min-w-0 space-y-1.5">
        <label htmlFor="cv-person-name" className="block text-xs font-semibold">Name for your profile and role pass</label>
        <input
          id="cv-person-name"
          type="text"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          maxLength={120}
          placeholder="No name detected — enter a name or leave blank"
          className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          data-testid="input-cv-person-name"
        />
        {!r.personName && (
          <p className="text-xs text-muted-foreground">
            {r.fileName
              ? "No confident name was found. The filename is suggested below; you can edit it or enter a name."
              : "No confident name was found. You can enter a name, or leave this blank to use “CV profile”."}
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Suggestion
          icon={GraduationCap}
          title="Education"
          value={r.suggestedEducation ?? "Not found"}
          evidence={r.educationEvidence}
          on={useEdu}
          disabled={r.suggestedEducation === null}
          onToggle={() => setUseEdu((v) => !v)}
          id="edu"
        />
        <Suggestion
          icon={Briefcase}
          title="Work experience"
          value={r.suggestedYearsExperience !== null ? `${r.suggestedYearsExperience} yrs` : "Not found"}
          evidence={r.experienceEvidence}
          on={useYears}
          disabled={r.suggestedYearsExperience === null}
          onToggle={() => setUseYears((v) => !v)}
          id="years"
        />
        <Suggestion
          icon={Compass}
          title="Closest industries"
          value={r.suggestedSectors.length ? r.suggestedSectors.map((s) => s.sector).join(" · ") : "Not found"}
          evidence={r.suggestedSectors.length ? `Based on how many of your skills each industry's roles use (${r.suggestedSectors.map((s) => s.matchedSkillCount).join(", ")}).` : null}
          on={useSectors}
          disabled={!r.suggestedSectors.length}
          onToggle={() => setUseSectors((v) => !v)}
          id="sectors"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-sm font-semibold">Skills found <span className="font-data text-primary">{r.skills.length}</span></div>
          {r.skills.length > 0 && (
            <button onClick={() => setPicked(picked.size === r.skills.length ? new Set() : new Set(r.skills.map((s) => s.skillId)))} className="text-xs font-semibold text-primary" data-testid="button-toggle-all-skills">
              {picked.size === r.skills.length ? "Untick all" : "Tick all"}
            </button>
          )}
        </div>
        {r.skills.length === 0 ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No skills from our taxonomy were recognised. Try pasting the text, or add skills with "Pick skills".</p>
        ) : (
          <ul className="touch-scroll max-h-80 space-y-1 overflow-y-auto pr-1">
            {r.skills.map((s) => {
              const on = picked.has(s.skillId);
              return (
                <li key={s.skillId}>
                  <button onClick={() => toggle(s.skillId)} className={cn("flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition", on ? "border-primary/40 bg-primary/5" : "opacity-60 hover:opacity-100")} data-testid={`button-scan-skill-${s.skillId}`}>
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border", on ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>{on && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="font-data shrink-0 text-[11px] text-primary">{PROF[s.proficiency]}</span>
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">{s.category.replace(/_/g, " ")}</span>
                      <span className="mt-1 block text-xs italic text-muted-foreground">“{s.evidence}”</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{r.method} {r.note}</p>

      <button onClick={apply} disabled={applied || (picked.size === 0 && !useEdu && !useYears && !useSectors)} className={btn.primary + " w-full"} data-testid="button-apply-scan">
        {applied ? <><Check className="h-4 w-4" /> Added to your profile — adjust on the right</> : `Use ${picked.size} skill${picked.size === 1 ? "" : "s"}${useEdu || useYears || useSectors ? " and ticked details" : ""}`}
      </button>
    </motion.div>
  );
}

function Suggestion({ icon: I, title, value, evidence, on, disabled, onToggle, id }: {
  icon: typeof GraduationCap; title: string; value: string; evidence: string | null; on: boolean; disabled: boolean; onToggle: () => void; id: string;
}) {
  return (
    <button onClick={onToggle} disabled={disabled} className={cn("rounded-md border p-3 text-left transition disabled:cursor-default", on && !disabled ? "border-primary/40 bg-primary/5" : "bg-background", disabled && "opacity-60")} data-testid={`button-scan-${id}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><I className="h-3.5 w-3.5" /> {title}</span>
        {!disabled && <span className={cn("flex h-4 w-4 items-center justify-center rounded-[3px] border", on ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>{on && <Check className="h-3 w-3" />}</span>}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{value}</div>
      {evidence && <div className="mt-1 line-clamp-3 text-[11px] text-muted-foreground" title={evidence}>{evidence}</div>}
    </button>
  );
}
