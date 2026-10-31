---
name: Gemini RAG assistant
description: Non-obvious quirks and user decisions for the knowledge ingestion / Gemini AI Mentor.
---

- `pnpm run <script> -- --flag` passes a literal "--" to the script; node `parseArgs` then treats every flag as positional. Strip a leading "--" before parsing.
  **Why:** the knowledge CLIs failed with "Unexpected argument" until this was handled.
- A Gemini 402 "prepayment credits are depleted" is a billing state on the user's Google project, not a code bug; ask the user to fix billing, then rerun the ingest.
- Newer AI Studio keys get 404 for older chat models (gemini-2.5-flash was refused in Oct 2026); list models with the key before picking a default. Gemini 2.x takes `thinkingBudget`, 3.x takes `thinkingLevel`.
- Embedding-enabled knowledge ingest is never run automatically (post-merge or startup): it spends the user's Gemini quota, and approval is a human step.
- Approval, review, and ingestion status changes must never delete documents or existing embeddings; retrieval eligibility is enforced by the source/document approval gate.
  **Why:** the user requires preserving knowledge data and forbids paid model calls without explicit approval.
  **How to apply:** use no-embed for bounded source registration; never purge vectors as a side effect of approval or ingest. Embed only after source/document review and explicit cost approval.
- User decisions: keep the floating bottom-right "Ask AI" widget and robot mascot; default Bahasa Melayu and support ms, zh-CN, en.
- Knowledge document titles must be unique within a source: approving a document retires the older approved one with the same title. Datasets with repeated titles (the synthetic practice labs repeat ~225 titles) must be grouped (one doc per skill/role) before ingest.
- The current chat direction is official DeepSeek `deepseek-flash` through its OpenAI-compatible API; keep Gemini separate for embeddings only if valid and approved.
  **Why:** The user's latest request supersedes the earlier Gemini chat choice and requires promotional-credit and cost checks before billable calls.
  **How to apply:** Store `DEEPSEEK_API_KEY` in Replit Secrets, check `/user/balance`, disclose current pricing, and stop for explicit approval before model calls; never auto-approve documents.
- Chat retrieval is PostgreSQL full-text (lexical), not Gemini vectors; DeepSeek availability comes from the free `/user/balance` check, else labelled search-only mode. Replit AI Integrations are billed to credits, so they are not a free LLM.
  **Why:** user wants a working hackathon chatbot without paid calls; DeepSeek balance was $0.
  **How to apply:** don't re-add embedding calls to the chat path without explicit cost approval; role phrases need glossary entries for zh/ms.
