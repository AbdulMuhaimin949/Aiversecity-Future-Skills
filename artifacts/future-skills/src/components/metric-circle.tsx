import { cn } from "@/lib/utils";

/** "Result & Growth" circular metric: soft blue circle, bold number, small dark pill label. */
export function MetricCircle({ value, label, signed, size = "md", testId, className }: { value: number; label: string; signed?: boolean; size?: "sm" | "md" | "lg"; testId?: string; className?: string }) {
  const dim = size === "sm" ? "h-14 w-14 text-base" : size === "lg" ? "h-28 w-28 text-4xl" : "h-24 w-24 text-3xl";
  const digits = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 1;
  const txt = `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`;
  return (
    <div className={cn("flex flex-col items-center", className)} data-testid={testId}>
      <div className={cn("font-display flex items-center justify-center rounded-full bg-mist font-extrabold leading-none text-charcoal", dim)}>
        <span>{txt}<span className="text-[0.55em] font-bold text-navy">%</span></span>
      </div>
      <span className="font-data -mt-2.5 whitespace-nowrap rounded-full bg-charcoal px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">{label}</span>
    </div>
  );
}
