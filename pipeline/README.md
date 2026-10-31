# Aiversecity Future-Ready Workforce Platform — Data Engineering Foundation

An end-to-end, reproducible **Bronze $\rightarrow$ Silver $\rightarrow$ Gold** data lakehouse and machine learning baseline suite built for the **Aiversecity Hackathon**. Inspired by the immersive branching progression of *Hogwarts Legacy*, this repository powers five core workforce intelligence modules tailored to Malaysian students, fresh graduates, career switchers, and working adults.

## 1. Quick Start & Setup

### Prerequisites
- Python $3.10+$
- Standard scientific Python stack (`pandas`, `numpy`, `scikit-learn`, `pytest`)

pip install pandas numpy scikit-learn pytest

### Execute the Full Bronze -> Silver -> Gold Pipeline
Run the master idempotent orchestrator from the repository root:

python run_pipeline.py

### Run the Automated Data Quality & Integrity Tests Standalone
pytest tests/test_data_quality.py
# or directly via Python:
python tests/test_data_quality.py

## 2. Summary of Actual Baseline Evaluation Results (`evaluation_metrics_report.json`)

| Task | Partition Strategy | Baseline / Model | Metric & Actual Result |
| :--- | :--- | :--- | :--- |
| **1. CV Skill Extraction** | Independent `150`-profile Gold Annotation Holdout (`CV_0001`–`CV_0150`) | Synonym-Normalised Regex & Context Extractor | Precision: **0.9193**, Recall: **0.9953**, $F_1$: **0.9558** (1,048 TP / 92 FP / 5 FN). Precision rose from 0.39 after the padded duplicate "Tier X" skills (which shared synonyms) were removed. Measured on synthetic CVs written from the same synonym list, so real CVs will score lower. |
| **2. AI Skill & Job Demand Forecasting** | Strict Chronological Split (Train: `2021-Q4`–`2024-Q4`, Val: `2025`, Test: `2026-Q1` to `2026-Q3`, $n=720$ test points) | Persistence (Naive Lag-1) vs. 3Q Moving Average vs. Ridge Autoregressive (`ridge_ar_v1.0`) | Persistence MAE: **1.7637** \| 3Q Moving Avg MAE: **2.8173** \| Ridge AR MAE: **1.1045** (RMSE: **1.3707**). Note: evaluated on simulated (`SYNTHETIC_SIMULATION`) trend series. |
| **3. Explainable Career Matching** | Profile-Grouped `70/15/15` Split (`210` Train / `45` Val / `45` Test profiles; zero profile overlap) | Transparent Weighted Formula + Logistic Regression Ranker | Test ROC-AUC: **0.9929**, Test $F_1$: **0.9486**, Test Accuracy: **0.9750** ($n=360$ test pairs) |
| **4. DOPE Assessment** | Deterministic Rule Verification (`60` test patterns including 4-way and 2-way ties) | Normalised 4-Score Matrix ($\sum_b \text{Score}_b = 100\%$) | **100%** rule invariant compliance; tie-handling verified on `DOPE_TP_005` (25% across all 4 styles) |
| **5. Hogwarts-Inspired Career Tree** | Topological, Referential & Prerequisite Gate Verification (`256` nodes, `479` directed edges) | Multi-Route BFS / Minimum-Hours Pathfinder | **100%** referential integrity; multi-route branching & prerequisite gating verified |

All figures above are copied from `data/gold/evaluation_metrics_report.json` produced by `python run_pipeline.py` (deterministic, `seed=42`; only the runtime field varies between runs). All 7 automated quality tests pass.

**Industry coverage.** 240 roles in 20 sectors and 255 skills. Ten technology-led sectors (16 roles each) plus ten world-industry sectors (8 roles each, defined in `src/world_industries.py`): hospitality, retail, agriculture, clinical care, construction and trades, teaching, transport, oil/gas/utilities, legal and public service, and arts and media. Role titles follow MASCO 2020 / ISCO-08 unit groups and their skills are hand-assigned. These sectors are never marked as MyCOL critical. Their AI-exposure values are scenario assumptions that follow the relative ordering in ILO Working Paper 96 (2023), not figures taken from it. The learning-resource catalogue has no verified courses for them yet, so their skill gaps are shown as uncovered.
