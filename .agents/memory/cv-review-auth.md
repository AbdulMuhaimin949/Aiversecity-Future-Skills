---
name: CV review and reviewer auth quirks
description: Non-obvious traps hit while building the Clerk reviewer flow and synthetic CV import.
---

- Generated Orval zod query schemas use `zod.coerce.boolean()`, which turns the string "false" into true. Read boolean query flags literally (`req.query.x === "true"`).
  **Why:** a `reviewCasesOnly=false` filter would silently behave as true.
  **How to apply:** any new boolean query param on the API.
- `drizzle push` did not update a CHECK constraint whose expression changed (cv_claim_evidence quote check); drop/recreate manually if a changed check matters.
- The synthetic profiles CSV has fractional `years_experience` (e.g. 0.5); validate as decimal, not int.
- Reviewer members use individual accounts with the `reviewer` role; admins can also review, but only admins manage the AI Mentor knowledge base.
  **Why:** the owner chose per-member review access rather than shared credentials, while preserving narrower permissions than admin.
  **How to apply:** protect review actions server-side for reviewer/admin, keep knowledge management admin-only, and grant roles only to trusted verified emails.
- Gemini returned 402 (prepaid credits depleted) on the user's key during the build, so live AI extraction was never exercised end-to-end; only the verification logic was tested offline.
- Admin role follows the same bootstrap pattern (`ADMIN_EMAILS` env var in prod, `cv:reviewer --role admin` in dev). Do not add an account without the owner's trusted email.
- Knowledge admin decision: embedding is a separate explicit action, not triggered on approval.
  **Why:** Gemini may be out of credits (402); approval must still be recorded and the embed retried later.
  **How to apply:** keep approval and embedding as separate steps in any future knowledge flow.
- Testing signed-in pages: pre-grant a role to a fixed example.com email with the CLI, then have the testing agent sign in as that email through Clerk; the email-only row links on first sign-in. Clean up the test users and data afterwards.
