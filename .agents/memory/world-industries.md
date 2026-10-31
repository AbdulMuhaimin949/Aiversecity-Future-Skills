---
name: World-industry scope and CV scan decisions
description: Why non-tech sectors exist, what was deliberately left out, and the AI/no-AI rules for the CV scan.
---

- The user wants the app to cover all world industries, not only IT (Oct 2026). Non-tech roles are hand-curated, never marked MyCOL critical, and have no courses (gaps are shown as uncovered rather than invented).
  **Why:** hackathon rules require a cited source and no invented data; MyCOL was not cross-checked for these roles.
- AI-exposure values for world sectors are labelled assumptions that follow the ILO WP96 (2023) ordering, not ILO numbers.
- CV scan is rule-based unless an OPENAI_API_KEY secret exists. The user dismissed the key request and Replit AI integration needs phone verification, so do not re-prompt unless they ask.
  **How to apply:** an AI path must keep the taxonomy-only + verbatim-evidence check, and the About disclosure must name the model.
- Matching readiness (E) is 50% seniority fit (years vs career level) and toggled interest sectors rank first; target role is an explicit user choice (`afs.targetRole`), flushed on new CV/persona.
  **Why:** user asked for work-experience weighting, sector-respecting results and no forced top match; taxonomy already spans 20 sectors so no roles were added.
