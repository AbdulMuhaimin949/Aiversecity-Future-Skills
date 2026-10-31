import { useEffect, useRef, useState } from "react";
import { Check, Hand } from "lucide-react";
import type { SdgTag } from "@workspace/api-client-react";
import { SDG_COLORS } from "@/components/kit";
import { CharcoalPill } from "@/components/pill";
import { RoleArt } from "@/components/role-art";
import { SourceBarcode } from "@/components/source-barcode";

export type PassSkill = { id: string; name: string; met: boolean };
export type LanyardPassProps = {
  name: string;
  title: string;
  sector: string;
  score?: number;
  mascoCode: string;
  skills: PassSkill[];
  sdgs: SdgTag[];
  sourceIds: string[];
  topRank?: number;
  autoSwing?: boolean;
  className?: string;
};

const H = 560;
const BW = 224;
const BH = 356;
const SEG = 9;
const SEGLEN = 22;

type Pt = { x: number; y: number; px: number; py: number };
type Sim = { pts: Pt[]; drag: { active: boolean; dx: number; dy: number; tx: number; ty: number; sx: number; sy: number; moved: boolean } };

export function LanyardPass(props: LanyardPassProps) {
  const { name, title, sector, score, mascoCode, skills, sdgs, sourceIds, topRank, autoSwing = false, className } = props;
  const [flipped, setFlipped] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const sim = useRef<Sim>({ pts: [], drag: { active: false, dx: 0, dy: 0, tx: 0, ty: 0, sx: 0, sy: 0, moved: false } });
  const reduced = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const box = boxRef.current!, canvas = canvasRef.current!, badge = badgeRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = box.clientWidth || 320;
    const resize = () => {
      w = box.clientWidth || 320;
      canvas.width = w * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const pts: Pt[] = Array.from({ length: SEG + 1 }, (_, i) => ({ x: w / 2, y: i * SEGLEN, px: w / 2, py: i * SEGLEN }));
    sim.current.pts = pts;
    const inv = pts.map((_, i) => (i === SEG ? 0.22 : 1));
    const d = sim.current.drag;
    let angle = 0;
    let raf = 0;
    let swingDirection = 1;
    const nudge = window.setTimeout(() => {
      if (!reduced.current && !d.active) pts[SEG].px = pts[SEG].x - (autoSwing ? 2.5 : 7);
    }, 500);
    const swingTimer = autoSwing && !reduced.current && (window.matchMedia("(max-width: 767px)").matches || window.matchMedia("(pointer: coarse)").matches)
      ? window.setInterval(() => {
          if (d.active) return;
          swingDirection *= -1;
          pts[SEG].px = pts[SEG].x - 1.25 * swingDirection;
        }, 1000)
      : undefined;

    const step = () => {
      const last = pts[SEG];
      for (let i = 1; i <= SEG; i++) {
        const p = pts[i];
        if (i === SEG && d.active) continue;
        const vx = (p.x - p.px) * 0.993, vy = (p.y - p.py) * 0.993;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + (i === SEG ? 1.1 : 0.55);
      }
      if (d.active) {
        last.px = last.x; last.py = last.y;
        let nx = last.x + (d.tx - last.x) * 0.45, ny = last.y + (d.ty - last.y) * 0.45;
        nx = Math.max(10, Math.min(w - 10, nx)); ny = Math.max(10, Math.min(H - BH - 8, ny));
        last.x = nx; last.y = ny;
      }
      for (let it = 0; it < 10; it++) {
        pts[0].x = w / 2; pts[0].y = 0;
        for (let i = 0; i < SEG; i++) {
          const a = pts[i], b = pts[i + 1];
          const wa = i === 0 ? 0 : inv[i];
          const wb = i + 1 === SEG && d.active ? 0 : inv[i + 1];
          const tw = wa + wb;
          if (tw === 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = (dist - SEGLEN) / dist;
          a.x += dx * diff * (wa / tw); a.y += dy * diff * (wa / tw);
          b.x -= dx * diff * (wb / tw); b.y -= dy * diff * (wb / tw);
        }
      }
      for (const p of pts) { p.x = Math.max(8, Math.min(w - 8, p.x)); p.y = Math.max(0, Math.min(H - BH - 6, p.y)); }
      pts[0].x = w / 2; pts[0].y = 0;

      const ref = pts[SEG - 2];
      const target = -Math.atan2(last.x - ref.x, last.y - ref.y);
      angle += (target - angle) * 0.35;
      badge.style.transform = `translate3d(${last.x}px, ${last.y}px, 0) rotate(${angle}rad)`;

      ctx.clearRect(0, 0, w, H);
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(last.x, last.y);
      };
      ctx.lineCap = "butt"; ctx.lineJoin = "round";
      path(); ctx.strokeStyle = "#18191C"; ctx.lineWidth = 17; ctx.stroke();
      path(); ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 11; ctx.setLineDash([2.5, 4.5]); ctx.stroke();
      path(); ctx.strokeStyle = "rgba(56,152,248,0.9)"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
      ctx.fillStyle = "#18191C";
      ctx.beginPath(); ctx.roundRect(w / 2 - 34, 0, 68, 10, [0, 0, 6, 6]); ctx.fill();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(nudge); if (swingTimer !== undefined) window.clearInterval(swingTimer); ro.disconnect(); };
  }, [autoSwing]);

  const rel = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    const p = rel(e), d = sim.current.drag, last = sim.current.pts[SEG];
    if (!last) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    d.active = true; d.moved = false;
    d.sx = p.x; d.sy = p.y;
    d.dx = last.x - p.x; d.dy = last.y - p.y;
    d.tx = last.x; d.ty = last.y;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = sim.current.drag;
    if (!d.active) return;
    const p = rel(e);
    if (Math.hypot(p.x - d.sx, p.y - d.sy) > 6) d.moved = true;
    d.tx = p.x + d.dx; d.ty = p.y + d.dy;
  };
  const onUp = () => {
    const d = sim.current.drag;
    if (!d.active) return;
    d.active = false;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    if (!d.moved) setFlipped((f) => !f);
  };

  const held = skills.filter((s) => s.met).length;
  const face = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as React.CSSProperties;

  return (
    <div className={`mx-auto w-full ${className ?? "max-w-[320px]"}`} data-testid="lanyard-pass">
      <div ref={boxRef} className="relative w-full overflow-hidden rounded-[24px] bg-mist/60" style={{ height: H }}>
        <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 h-full w-full" aria-hidden />
        <div ref={badgeRef} className="absolute left-0 top-0 will-change-transform" style={{ perspective: 1100, transformOrigin: "0 0" }}>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            aria-label={`Role pass for ${title}. Drag to swing, tap to flip, or press Enter or Space to flip.`}
            data-testid="button-flip-pass"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { sim.current.drag.active = false; }}
            onLostPointerCapture={() => { sim.current.drag.active = false; }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setFlipped((f) => !f);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
            className="relative cursor-grab touch-none select-none outline-offset-4 active:cursor-grabbing"
            style={{ width: BW, height: BH, marginLeft: -BW / 2, marginTop: -4, transformStyle: "preserve-3d", transition: "transform .75s cubic-bezier(.3,1.35,.5,1)", transform: `rotateY(${flipped ? 180 : 0}deg)` }}
          >
            {/* metal clip */}
            <div className="absolute -top-3 left-1/2 z-10 h-7 w-12 -translate-x-1/2 rounded-md bg-gradient-to-b from-slate-200 to-slate-400 shadow" style={face}>
              <div className="mx-auto mt-1.5 h-2.5 w-7 rounded-full bg-charcoal/70" />
            </div>
            {/* FRONT */}
            <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-white shadow-[0_18px_30px_-12px_rgba(11,79,158,0.55)] ring-1 ring-navy/20" style={face} data-testid="pass-front">
              <div className="flex h-12 items-end justify-between bg-navy px-4 pb-1.5 text-white">
                <span className="font-data text-[9px] font-semibold uppercase tracking-[0.2em]">Future Skills Pass</span>
                <span className="font-data text-[9px] opacity-80">MY</span>
              </div>
              <div className="relative h-[112px]">
                <RoleArt sector={sector} title={title} animate={!reduced.current} className="h-full w-full" />
                {topRank !== undefined && <CharcoalPill tilt={-4} className="absolute -bottom-2 left-3 z-10" testId="pill-pass-top">{`TOP #${String(topRank).padStart(2, "0")} MATCH`}</CharcoalPill>}
              </div>
              <div className="px-4 pt-4">
                <div className="font-data text-[9px] uppercase tracking-widest text-[#4a5160]">Holder</div>
                <div className="font-display line-clamp-2 break-words text-[14px] font-extrabold leading-tight text-charcoal" data-testid="text-pass-name">{name}</div>
                <div className="font-data mt-2 text-[9px] uppercase tracking-widest text-[#4a5160]">Matched role</div>
                <div className="font-display line-clamp-2 text-[17px] font-extrabold leading-[1.05] text-charcoal" data-testid="text-pass-role">{title}</div>
              </div>
              <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <div className="font-display flex h-14 w-14 items-center justify-center rounded-full bg-mist text-xl font-extrabold text-charcoal" data-testid="text-pass-score">{score !== undefined ? `${Math.round(score)}%` : "--"}</div>
                  <div className="font-data text-[9px] uppercase leading-tight tracking-wider text-[#4a5160]">match<br />score</div>
                </div>
                <div className="text-right">
                  <div className="font-data text-[9px] uppercase tracking-widest text-[#4a5160]">MASCO</div>
                  <div className="font-data text-sm font-bold text-navy" data-testid="text-pass-masco">{mascoCode}</div>
                </div>
              </div>
            </div>
            {/* BACK */}
            <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-white shadow-[0_18px_30px_-12px_rgba(11,79,158,0.55)] ring-1 ring-navy/20" style={{ ...face, transform: "rotateY(180deg)" }} data-testid="pass-back">
              <div className="flex h-12 items-end justify-between bg-royal px-4 pb-1.5 text-white">
                <span className="font-data text-[9px] font-semibold uppercase tracking-[0.2em]">Required skills</span>
                <span className="font-data text-[10px] font-semibold" data-testid="text-pass-held">{held}/{skills.length} held</span>
              </div>
              <ul className="space-y-1 px-4 pt-3">
                {skills.slice(0, 7).map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[11px] font-semibold leading-tight text-charcoal" data-testid={`pass-skill-${s.id}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2 ${s.met ? "border-navy bg-navy text-white" : "border-[#8a93a3] bg-white"}`}>{s.met && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                    <span className={`truncate ${s.met ? "" : "text-[#4a5160]"}`}>{s.name}</span>
                  </li>
                ))}
                {skills.length > 7 && <li className="font-data pl-6 text-[9px] text-[#4a5160]">+{skills.length - 7} more</li>}
              </ul>
              <div className="absolute inset-x-4 bottom-3">
                <div className="font-data mb-1 text-[9px] uppercase tracking-widest text-[#4a5160]">SDG alignment</div>
                <div className="mb-2 flex flex-wrap gap-1" data-testid="pass-sdgs">
                  {sdgs.slice(0, 5).map((s) => (
                    <span key={s.targetCode} title={s.goalTitle} className="font-data flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[10px] font-bold text-white" style={{ background: SDG_COLORS[s.goalNumber] }}>{s.goalNumber}</span>
                  ))}
                </div>
                <SourceBarcode sourceIds={sourceIds} />
              </div>
            </div>
          </div>
        </div>
        <div className="font-data pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-navy">
          <Hand className="h-3 w-3" /> drag me / tap to flip
        </div>
      </div>
    </div>
  );
}
