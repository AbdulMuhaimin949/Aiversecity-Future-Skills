import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const VIDEO_SRC = `${import.meta.env.BASE_URL}role-trend-explainer.mp4`;

/**
 * Compact looping, silent video that explains the role trend forecast.
 * Autoplay is skipped when the user prefers reduced motion; the caption stays visible either way.
 */
export function RadarBarExplainer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(() =>
    typeof window === "undefined" ? true : !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing]);

  return (
    <aside
      className="flex min-w-0 flex-col rounded-lg border border-primary/20 bg-background p-2 sm:p-3"
      aria-labelledby="radar-bar-explainer-title"
      data-testid="radar-bar-explainer"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p id="radar-bar-explainer-title" className="font-data text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">How to read role trends</p>
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Pause trend video" : "Play trend video"}
          aria-pressed={!playing}
          aria-controls="radar-bar-video"
          className="radar-explainer-toggle inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-card px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
          data-testid="button-toggle-radar-explainer"
        >
          {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {playing ? "Pause" : "Play"}
        </button>
      </div>
      <video
        ref={videoRef}
        id="radar-bar-video"
        className="aspect-video w-full rounded-md bg-muted object-cover"
        src={VIDEO_SRC}
        muted
        loop
        playsInline
        preload="metadata"
        autoPlay={playing}
        aria-label="Short video showing how a role's demand moves from today's baseline to a projected value with a 90 percent range"
      />
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        From today’s baseline to a projection: the line shows the direction, and the band marks the 90% forecast range. It is not a guarantee.
      </p>
      <p className="sr-only">Silent looping trend video. Use the Pause button to stop it.</p>
    </aside>
  );
}
