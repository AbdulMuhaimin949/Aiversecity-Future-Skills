---
name: Production catalogue sync
description: How catalogue rows reach the production DB and why it is done at API startup rather than from the workspace or the build.
---
The published API server imports the catalogue into its own database at startup (env flag in the API server's production run config), only when the DB is behind the bundled CSVs, under an advisory lock.

**Why:** the agent cannot write to (or even read, in task sessions) the production database; Replit forbids schema changes outside Publish, and it is unknown whether the build step can reach the production database. A data-only, idempotent, change-gated import from the running app is the only path that does not need the user to run anything.

**How to apply:** new seed/reference data for production should go through the same sync (extend lib/catalogue), not build hooks or startup DDL. Never create tables/extensions at startup; only report them. Verify in deployment logs ("Catalogue sync").
