import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Brain, ExternalLink, Info, Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EconomicTaskIndicator {
  taskId: string;
  taskName: string;
  taskDescription: string;
  occupationCategory: string;
  applicableOccupationTitles: string[];
  aiUsageIntensity: number;
  augmentationShare: number;
  automationShare: number;
  sampleSizeInteractions: number;
  confidenceLevel: string;
  primaryTaskType: string;
  interpretationNote: string;
}

interface EconomicIndexPayload {
  releaseId: string;
  measurementPeriod: string;
  sourceUrl: string;
  datasetUrl: string;
  mcpEndpoint: string;
  mcpStatus: "connected" | "fallback_versioned_dataset";
  indicators: EconomicTaskIndicator[];
  summary: {
    totalTasksAnalyzed: number;
    averageAugmentationShare: number;
    averageAutomationShare: number;
    predominantMode: string;
  };
  disclaimer: string;
  evidenceNotes: string;
}

export function AiTaskTrendsSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data, isLoading, isError } = useQuery<EconomicIndexPayload>({
    queryKey: ["anthropic-economic-index", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      const res = await fetch(`/api/economic-index?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load Anthropic Economic Index data");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "AI, Data & Cloud", label: "AI & Cloud Tech" },
    { id: "Business, Finance", label: "Finance & Digital Econ" },
    { id: "Customer Service", label: "Customer Service" },
    { id: "Creative & Digital", label: "Creative Media" },
  ];

  return (
    <section className="space-y-4" data-testid="section-ai-task-trends">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-royal/15 text-royal">
              <Brain className="h-4 w-4" />
            </span>
            <span className="font-data text-xs font-bold uppercase tracking-wider text-royal">
              Section B · Anthropic Economic Index
            </span>
          </div>
          <h2 className="font-display mt-1 text-2xl font-bold">AI Task Trends &amp; Augmentation Analysis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Empirical research from Anthropic on how AI assists human workers at the task level across job roles.
          </p>
        </div>

        {data && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
            <span className="font-data rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground" data-testid="text-econ-release">
              Release: {data.releaseId} ({data.measurementPeriod})
            </span>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              data-testid="link-anthropic-evidence"
            >
              View Evidence <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Summary Highlights Card */}
      {data && (
        <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-5" data-testid="card-econ-summary">
          <div>
            <div className="font-data text-[11px] uppercase tracking-wider text-muted-foreground">Observed Tasks</div>
            <div className="font-display mt-1 text-2xl font-extrabold text-foreground">{data.summary.totalTasksAnalyzed} Everyday Work Tasks</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Matched with official Malaysian jobs (MASCO 2020)</p>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-wider text-muted-foreground">AI + Human Tasks</div>
            <div className="font-display mt-1 text-2xl font-extrabold text-royal">{data.summary.averageAugmentationShare}% AI + Human</div>
            <p className="mt-0.5 text-xs text-muted-foreground">AI assists while you make the final decisions</p>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-wider text-muted-foreground">AI Only Tasks</div>
            <div className="font-display mt-1 text-2xl font-extrabold text-muted-foreground">{data.summary.averageAutomationShare}% AI Only</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Routine sorting, formatting, and template drafting</p>
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Task category filter">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
              selectedCategory === c.id
                ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={`button-econ-cat-${c.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border bg-card/60 p-5" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
          Could not load Anthropic Economic Index data.
        </div>
      )}

      {data && data.indicators.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.indicators.map((task) => (
            <div
              key={task.taskId}
              className="flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all hover:border-royal/40 hover:shadow-xs"
              data-testid={`card-econ-task-${task.taskId}`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-data rounded bg-royal/10 px-2 py-0.5 text-[11px] font-bold text-royal">
                    {task.primaryTaskType}
                  </span>
                  <span className="font-data text-[11px] text-muted-foreground">
                    Intensity: {task.aiUsageIntensity}%
                  </span>
                </div>

                <div>
                  <h3 className="font-display text-base font-bold leading-snug">{task.taskName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{task.taskDescription}</p>
                </div>

                {/* AI + Human vs AI Only Split Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-royal">AI + Human: {task.augmentationShare}%</span>
                    <span className="text-muted-foreground">AI Only: {task.automationShare}%</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-royal transition-all duration-500"
                      style={{ width: `${task.augmentationShare}%` }}
                      title={`AI + Human: ${task.augmentationShare}%`}
                    />
                    <div
                      className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-500"
                      style={{ width: `${task.automationShare}%` }}
                      title={`AI Only: ${task.automationShare}%`}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-mist/60 p-2.5 text-xs text-foreground/90">
                  <span className="font-bold text-primary">How this works: </span>
                  <span className="text-muted-foreground leading-relaxed">{task.interpretationNote}</span>
                </div>
              </div>

              <div className="mt-4 border-t pt-2.5 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Applicable Roles: </span>
                <span>{task.applicableOccupationTitles.join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.disclaimer && (
        <div className="flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground" data-testid="text-econ-disclaimer">
          <Info className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
          <p>{data.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

