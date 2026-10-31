---
name: Responsive overflow
description: Prevent intrinsic table sizing from creating horizontal page scroll in accessible chart data.
---

Keep screen-reader-only data tables inside a clipped, screen-reader-only wrapper rather than applying the visually hidden utility directly to a wide table. Tables can retain a large intrinsic layout width even when given a one-pixel width.

**Why:** The role forecast's accessible data table expanded the document width on narrow screens despite being visually hidden; clipping the wrapper kept the data accessible while preventing page-level horizontal scrolling.

**How to apply:** When adding visually hidden tables or other intrinsically wide content, measure document scroll width at phone widths and clip the containing element instead of relying on the child's width alone.
