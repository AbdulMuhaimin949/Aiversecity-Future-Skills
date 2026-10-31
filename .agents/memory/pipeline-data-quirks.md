---
name: Pipeline data quirks
description: Known weaknesses in the generated pipeline CSVs and how the API compensates; read before changing matching, scenarios or pathways.
---

- Pipeline `pathway_steps` almost never match their resource's target skills (about 3 of 480). Only trust a curated step when the resource lists the expected skill.
  **Why:** the hackathon rules say every recommendation must cite real evidence, and judges will catch a carbon-accounting course recommended for CI/CD.
  **How to apply:** if the pipeline is regenerated, re-check this ratio before relaxing the filter.
- Moderate and fast scenario values are near-uniform multipliers (about ×1.03 and ×1.07), so no role declines. The API adds an exposure × (1 − augmentation) displacement term.
  **Why:** the brief requires scenarios that actually change outcomes.
  **How to apply:** keep the formula text in the radar assumptions in sync with the code.
- Extractor holdout precision is 0.92 only because synthetic CVs are written from the same synonym list; real CVs score lower. The UI must keep a review/remove step.
- Taxonomy order matters: the 10 world-industry sectors (8 roles each) are appended after the 10 tech sectors (16 each). Career-graph code groups roles by sector rather than fixed blocks of 16.
  **How to apply:** never assume a fixed sector size when touching the pipeline or API.
- Synthetic add-on labs/trends are a separate, fictional layer: never feed them into pathway steps/hours, matching or the real demand forecast; UI shows them only in labelled demo panels.
  **Why:** the task required they never be mixed with real forecasts or e-LATiH courses.
  **How to apply:** if someone asks to "use the synthetic labs to fill uncovered gaps", keep them visually and computationally separate.
