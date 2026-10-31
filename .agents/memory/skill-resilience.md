---
name: Skill AI-resilience badges
description: How per-skill "AI-Resilient / Exposed" classes are derived and why the scenario weight is lambda / lambda_moderate.
---

- Score = mean(augmentation) - (lambda_s / lambda_moderate) x mean(exposure x (1 - augmentation)) over roles requiring the skill; median split across all skills.
  **Why:** a first try with (1 + lambda) flipped 0-2 of 251 skills between scenarios, so badges never changed. The ratio form flips about 12-16 skills per step and baseline becomes augmentation-only.
  **How to apply:** keep legend text in the UI kit, OpenAPI description and scenarios.ts in sync if the formula changes. Badges describe roles, never specific tasks (no task-level data exists).
