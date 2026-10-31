import type { ReactNode } from "react";

/** Simple white line/solid pictograms for SDG 1-17, drawn on a 48x48 grid using currentColor. */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<number, ReactNode> = {
  // 1 No Poverty: group of people
  1: (
    <g fill="currentColor">
      {[[10, 14, 6], [24, 12, 7], [38, 14, 6]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r / 1.6} />)}
      <path d="M5 38v-14a5 5 0 0 1 10 0v14zM18 40V24a6 6 0 0 1 12 0v16zM33 38V24a5 5 0 0 1 10 0v14z" />
      <circle cx="14" cy="42" r="0" />
    </g>
  ),
  // 2 Zero Hunger: steaming bowl
  2: (
    <g>
      <path {...S} d="M17 6c-3 3 3 5 0 9M24 6c-3 3 3 5 0 9M31 6c-3 3 3 5 0 9" />
      <path fill="currentColor" d="M6 22h36a18 16 0 0 1-18 18A18 16 0 0 1 6 22z" />
      <path {...S} d="M16 44h16" />
    </g>
  ),
  // 3 Good Health: heartbeat line + heart
  3: (
    <g>
      <path {...S} d="M3 26h10l4-10 6 20 5-14h4" />
      <path fill="currentColor" d="M37 40c-8-6-10-10-10-14a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 4-2 8-10 14z" transform="translate(-4 -6) scale(.95)" />
    </g>
  ),
  // 4 Quality Education: open book + pencil
  4: (
    <g>
      <path {...S} d="M4 11c7-2 14-1 18 3v26c-4-4-11-5-18-3zM22 14c4-4 11-5 18-3v26c-7-2-14-1-18 3" />
      <path fill="currentColor" d="M42 6h3v30l-1.5 3L42 36z" transform="translate(0 0)" />
    </g>
  ),
  // 5 Gender Equality
  5: (
    <g>
      <circle {...S} cx="24" cy="18" r="10" />
      <path {...S} d="M17 14h14M17 22h14M24 28v14M17 36h14M31 8l8-5M34 3h5v5" />
    </g>
  ),
  // 6 Clean Water: cup with drop and down arrow
  6: (
    <g>
      <path {...S} d="M8 6h32l-4 24a6 6 0 0 1-6 5h-12a6 6 0 0 1-6-5z" />
      <path fill="currentColor" d="M24 12c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z" />
      <path {...S} d="M24 36v8M19 40l5 5 5-5" />
    </g>
  ),
  // 7 Affordable and Clean Energy: sun with power button
  7: (
    <g>
      <circle {...S} cx="24" cy="24" r="10" />
      <path {...S} d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" />
      <path {...S} strokeWidth={2.2} d="M24 19v6M19.5 21.5a7 7 0 1 0 9 0" />
    </g>
  ),
  // 8 Decent Work: bars with rising arrow
  8: (
    <g>
      <path fill="currentColor" d="M6 42V28h8v14zM18 42V22h8v20zM30 42V30h8v12z" />
      <path {...S} d="M6 18l10-8 8 6 14-12M30 4h8v8" />
    </g>
  ),
  // 9 Industry, Innovation: stacked isometric cubes
  9: (
    <g {...S}>
      <path d="M24 3l9 5v10l-9 5-9-5V8zM15 8l9 5 9-5M24 13v10" />
      <path d="M12 24l9 5v10l-9 5-9-5V29zM3 29l9 5 9-5M12 34v10" />
      <path d="M36 24l9 5v10l-9 5-9-5V29zM27 29l9 5 9-5M36 34v10" />
    </g>
  ),
  // 10 Reduced Inequalities: equals in circle
  10: (
    <g>
      <path {...S} d="M38 12a19 19 0 1 0 5 12" />
      <path {...S} strokeWidth={3.5} d="M16 19h16M16 29h16" />
    </g>
  ),
  // 11 Sustainable Cities: buildings and house
  11: (
    <g>
      <path fill="currentColor" d="M17 4h13v38H17zM33 14h11v28H33z" />
      <path fill="currentColor" d="M3 24l8-7 8 7v18H3z" transform="translate(-1 0) scale(.9 1)" />
      <path {...S} strokeWidth={2} d="M2 44h44" />
    </g>
  ),
  // 12 Responsible Consumption: infinity with arrow
  12: (
    <g>
      <path {...S} strokeWidth={3.5} d="M24 24c-4-6-8-9-13-9a9 9 0 0 0 0 18c5 0 9-3 13-9s8-9 13-9h6" />
      <path {...S} strokeWidth={3.5} d="M24 24c4 6 8 9 13 9a9 9 0 0 0 0-18" />
      <path fill="currentColor" d="M36 8l9 7-9 7z" />
    </g>
  ),
  // 13 Climate Action: eye with globe
  13: (
    <g>
      <path {...S} d="M2 24C9 12 17 8 24 8s15 4 22 16c-7 12-15 16-22 16S9 36 2 24z" />
      <circle {...S} cx="24" cy="24" r="9" />
      <path {...S} strokeWidth={2} d="M15 24h18M24 15c-4 5-4 13 0 18M24 15c4 5 4 13 0 18" />
    </g>
  ),
  // 14 Life Below Water: fish under waves
  14: (
    <g>
      <path {...S} d="M3 9q5-5 10 0t10 0 10 0 10 0M3 17q5-5 10 0t10 0 10 0 10 0" />
      <path fill="currentColor" d="M8 33c6-8 18-8 25 0-7 8-19 8-25 0zM33 33l8-7v14z" />
      <circle cx="15" cy="32" r="1.6" fill="#0000" stroke="#fff" strokeWidth="0" />
    </g>
  ),
  // 15 Life on Land: tree, birds, ground lines
  15: (
    <g>
      <path fill="currentColor" d="M20 6c-6 0-10 4-10 9 0 4 3 7 7 7v10h6V22c5 0 9-3 9-7 0-5-5-9-12-9z" />
      <path {...S} d="M34 8q3-3 6 0 3-3 6 0M38 15q2-2 4 0 2-2 4 0" />
      <path {...S} d="M3 36h42M8 42h32" />
    </g>
  ),
  // 16 Peace and Justice: dove with olive branch over gavel
  16: (
    <g>
      <path fill="currentColor" d="M8 18c5 0 9-3 11-8 3 2 4 5 3 8 4-1 7-4 9-8 2 7-1 14-8 17-4 2-9 2-13 0z" />
      <path {...S} strokeWidth={2} d="M4 12c4 0 6 2 8 5M4 12l1 5" />
      <path fill="currentColor" d="M20 33l7-7 5 5-7 7zM12 41l7-7 4 4-3 3z" />
      <path {...S} strokeWidth={2.2} d="M6 46h30" />
    </g>
  ),
  // 17 Partnerships: interlocking circles
  17: (
    <g {...S} strokeWidth={2.4}>
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return <circle key={a} cx={24 + 9 * Math.cos(r)} cy={24 + 9 * Math.sin(r)} r="9" />;
      })}
    </g>
  ),
};

export function SdgIcon({ goal, className }: { goal: number; className?: string }) {
  const icon = ICONS[goal];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={`SDG ${goal} icon`} data-testid={`icon-sdg-${goal}`}>
      {icon}
    </svg>
  );
}
