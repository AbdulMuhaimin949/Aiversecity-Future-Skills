# Aiversecity Future Skills - Design System MASTER

Theme: **Aesthetic iOS Core / Layered Blue Folder**. Tactile, playful, optimistic: a stack of physical blue folders on a cream desk, polished like an iOS app.

## 1. Colour tokens
| Token | Hex | Use |
|---|---|---|
| `cream` | #F5F3EB | Page background, always with the dot grid (`radial-gradient` 22px) |
| `navy` (Back Folder Tab) | #0B4F9E | Back tabs, primary buttons, links on light surfaces (maps to `--primary`) |
| `royal` (Middle Folder Tab) | #1E78D6 | Middle tabs, focus ring, chart "up" series |
| `sky` (Front Active Folder Shell) | #3898F8 | Active tab + main folder shell, radius 28px |
| `mist` | #DCE8F5 | Circular metric badges, soft fills |
| `charcoal` | #18191C | Headlines, floating pills, lanyard strap |
| white | #FFFFFF | Inner cards inside the folder |

The old dark green (#0D6E5B) is retired. Red (`destructive`) and amber (`accent`) remain only for negative/warning and "steady" states so meaning stays readable. Never put small white text on sky (#3898F8): use charcoal on sky, white on navy/royal.

## 2. Typography
- Display: **Outfit** 800, tight tracking, huge (text-5xl to 7xl on heroes, 4xl-6xl page heads).
- Body: **Plus Jakarta Sans**.
- Badges, figures, IDs: **JetBrains Mono** (`.font-data`).

## 3. Folder tabs and shell
- Steps 1-4 are notched ears (clip-path trapezoid) stacked left to right with negative overlap. Colours alternate navy (back) / royal (middle); the active step is sky and sits highest (z-index) so it merges into the shell.
- Pages render inside `FolderShell`: sky shell, `rounded-[28px]` (top-left square under first ear), padding 12-20px, containing a cream dot-grid panel with white cards.
- Route change animates like flipping a folder (rotateX from the top edge, 0.45s). Honour `prefers-reduced-motion`.
- Landing page sits directly on cream (no shell) with a hand-built folder stack illustration.
- Top-3 matches use the same ear construction labelled #1 navy, #2 royal, #3 sky; the panel under them takes the selected tab colour.

## 4. Floating charcoal pills (`CharcoalPill`)
`#18191C` background, white mono uppercase text, rotated -3deg or +2deg, overlapping card corners. Examples: "2026 Edition", "A career compass for Malaysia's AI era", "TOP #01 MATCH" (only the true rank-1 match), step counters. Do not use more than 2-3 per view.

## 5. Circular metric badges (`MetricCircle`)
Soft `mist` circle, bold Outfit number, small charcoal pill label underneath. Used for AI Exposure %, Augmentation %, Demand Forecast %, taken from the real fields (role `aiExposure`, `aiAugmentation`, match `demandChangePct` or scenario forecast). Never invent values.

## 6. Lanyard Role Pass (`LanyardPass`)
- Hand-written verlet rope (10 points, inverse-mass weighted, 10 constraint iterations) drawn on a canvas as a woven black strap; the badge is a DOM element positioned at the last rope point and rotated by the last segment angle (pendulum swing).
- Pointer drag (mouse and touch via pointer events) pulls the badge; release keeps velocity and it swings back. Movement under 6px counts as a tap.
- Tap, click or Enter/Space flips 180deg with CSS 3D transforms.
- Front: holder name (profile label), role title, match %, MASCO code, animated SVG sector scene (`RoleArt`, 16 scenes chosen by sector keywords plus a data/AI overlay).
- Back: required skills checklist (met vs gap), SDG chips, barcode generated deterministically from the role's `sourceIds` (`SourceBarcode`) with the IDs printed as caption.
- Reduced motion: no idle swing or SVG animation; dragging still works.
- Everything on the pass must come from API or stored state data.

## 7. Do / Don't
Do: white inner cards, 28px shell radius, 12-16px inner radius, mono for figures, press states (`active:scale-[.97]`), staggered entrances.
Don't: dark green, pure black, neon glows, emojis, more than three folder tones, white small text on sky, random decorative data.
