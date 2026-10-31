# Aiversecity synthetic dataset add-on (2026-10-30)

This dataset is 100% fictional/synthetic and is suitable for a hackathon that forbids real-world datasets. It DOES NOT represent Malaysian employment statistics, verified job requirements, accredited courses, genuine CVs, or actual certifications.

It was derived from the *existing* Aiversecity occupation/skill identifiers, **without modifying** the existing 240 occupations, 255 skills or 2,073 occupation-skill relationships.

## Files
- `rag_knowledge_documents.csv` — 480 rows
- `rag_knowledge_chunks.csv` — 480 rows
- `synthetic_cv_profiles.csv` — 800 rows
- `synthetic_cv_claims.csv` — 3,200 rows
- `synthetic_cv_evidence.csv` — 2,400 rows
- `synthetic_claim_test_oracle.csv` — 3,200 rows
- `synthetic_learning_resources.csv` — 480 rows
- `synthetic_trend_scenarios.csv` — 1,920 rows
- `synthetic_review_cases.csv` — 80 rows


## Integration notes
- Import into staging or dedicated synthetic tables first. Do not force these CSVs directly into an incompatible production table schema.
- `rag_knowledge_documents.csv` and `rag_knowledge_chunks.csv` are **PENDING_REVIEW**; admin can approve them in the demo. They are not searchable until approved and embedded.
- `embedding_status=NOT_GENERATED`: vectors have NOT been created. Use Gemini's embedding API only after selecting the model/dimension, and record model/version and embedding operations.
- `synthetic_claim_test_oracle.csv` is a hidden TEST ORACLE for evaluation; it must NOT be supplied to a user's LLM as evidence or used as an automatic human decision.
- `synthetic_cv_evidence.csv` only contains *fictional placeholder metadata*, not actual documents. Never display these as real independently verified certificates.
- Keep all records tagged `is_synthetic=true`; do not mark them verified by external institutions.
- For fictional training cases, “EVIDENCE_SUFFICIENT” means an internal test-case expectation and is not real credential verification.
- Use the existing relational data for structured SQL lookups and the approved knowledge documents for retrieval. Protect demo profiles from crossing into shared public knowledge retrieval.
- This package does not aim to add thousands of invented occupations or skills merely for a metric. It creates coherent test fixtures and RAG documents using existing IDs.
- No external data scraping or personal data was used.

## Suggested testing
1. Import data and verify all occupation_id and skill_id foreign keys against the original catalog.
2. Approve a single demo document; embed it; ask an aligned question; inspect citation.
3. Add a new synthetic document/version; approve; re-index; confirm fresh retrieval.
4. Submit a simulated CV claim for reviewer; record decision with rationale and audit event; appeal.
5. Test Malay, Simplified Chinese and English responses on the same source documents.
