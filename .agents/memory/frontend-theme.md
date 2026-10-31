---
name: Frontend theme and generated client
description: The blue-folder theme, metric terminology, and generated-client quirks.
---

- The UI follows the user's "Aesthetic iOS Core / Layered Blue Folder" brief, saved in design-system/MASTER.md. The old dark green accent was explicitly replaced; do not reintroduce it.
  **Why:** the user supplied exact hex values and signature elements (tilted charcoal pills, pastel metric circles, 3D lanyard role pass for the top 3 matches).
- After merging work that changes lib/api-spec/openapi.yaml, re-run `pnpm --filter @workspace/api-spec run codegen` before typechecking; the generated client was stale once and caused false type errors.
- User-facing measures use AI Risk and Job Safety. Explain AI Risk as task impact, not a job-loss prediction; Job Safety describes potential AI help with work, not guaranteed employment.
  **Why:** these labels distinguish task-level estimates from job outcomes and are the product’s required terminology.
  **How to apply:** use these labels and caveats anywhere role or skill measures are defined or displayed.
- Match summaries should lead with the role, three outlook metrics, three key insights, concise factor scores, and primary actions; keep weights, caveats, and extra suggestions behind disclosures.
  **Why:** the user found the original match page too dense and preferred the compact reference card.
  **How to apply:** preserve detailed explanations and evidence for people who open details, but keep the first scan short.
- If app typechecking reports a missing field that exists in the generated client source, rebuild that project reference before debugging the consumer.
  **Why:** generated declaration output can lag behind the checked-in schema types and produce false missing-property errors.
  **How to apply:** run `pnpm exec tsc --build lib/api-client-react`, then rerun the app typecheck.
- Production Vite builds require both `PORT` and `BASE_PATH` even though they do not serve traffic; provide both when running the build command directly.
  **Why:** the artifact's Vite config validates both environment variables while loading, so a bare build fails before compilation.
  **How to apply:** when building this web artifact outside its managed workflow, set `PORT` and the artifact base path (currently `/`) in the command environment.
