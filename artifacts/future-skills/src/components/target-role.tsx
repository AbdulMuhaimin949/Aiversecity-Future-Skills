import { Check, Crosshair } from "lucide-react";
import { useTargetRole } from "@/lib/store";
import { btn } from "@/components/kit";
import { cn } from "@/lib/utils";

/** Lets the user choose any role as their target; Radar focus, the role pass and the pathway follow it. */
export function SelectTargetButton({ occupationId, title }: { occupationId: string; title: string }) {
  const [target, setTarget] = useTargetRole();
  const selected = target?.id === occupationId;
  return (
    <button
      type="button"
      onClick={() => setTarget(selected ? null : { id: occupationId, title })}
      aria-pressed={selected}
      className={cn(btn.ghost, selected && "border-primary bg-primary/10 text-primary")}
      data-testid={`button-select-target-${occupationId}`}
    >
      {selected ? <Check className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
      {selected ? "My target pathway (selected)" : "Select as my target pathway"}
    </button>
  );
}
