import { useEffect, useMemo, useState } from "react";
import type { ProfileInputEducationLevel, Scenario, SdgTag } from "@workspace/api-client-react";

export type StoredSkill = { skillId: string; name: string; category: string; proficiency: number };
export type StoredProfile = {
  skills: StoredSkill[];
  educationLevel: ProfileInputEducationLevel;
  yearsExperience: number;
  interestSectors: string[];
  weeklyLearningHours: number;
  label?: string;
};

export function profileDisplayLabel(label?: string | null): string | undefined {
  if (!label) return undefined;
  return /^From CV:\s*/i.test(label) ? "CV profile" : label;
}

const EVT = "afs-store";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
}

function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [raw, setRaw] = useState<string | null>(() => localStorage.getItem(key));
  useEffect(() => {
    setRaw(localStorage.getItem(key));
    const h = () => setRaw(localStorage.getItem(key));
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const val = useMemo(() => (raw ? read(key, fallback) : fallback), [raw]);
  return [val, (v: T) => write(key, v)];
}

export const useProfile = () => useStored<StoredProfile | null>("afs.profile", null);
export const useScenario = () => useStored<Scenario>("afs.scenario", "baseline");
/** The role the user explicitly chose as their target; drives Radar focus, role pass and the pathway. */
export const useTargetRole = () => useStored<{ id: string; title: string } | null>("afs.targetRole", null);
export const usePathwaySdgs = () => useStored<SdgTag[]>("afs.pathwaySdgs", []);
export const useDoneSteps = (occ: string) => useStored<number[]>(`afs.done.${occ}`, []);
export const useChatLanguage = () => useStored<"ms" | "zh-CN" | "en">("afs.chatLanguage", "ms");
export const useActiveChat = () => useStored<string | null>("afs.chatSession", null);

/**
 * Flushes everything derived from the previous profile: the chosen target role,
 * the pathway SDG highlights and every pathway's completed steps. Called when a
 * new CV is scanned or a different persona is loaded.
 */
export function resetCareerSelection() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("afs.done.")) localStorage.removeItem(key);
  }
  localStorage.removeItem("afs.lastRole");
  write("afs.targetRole", null);
  write("afs.pathwaySdgs", null);
}
