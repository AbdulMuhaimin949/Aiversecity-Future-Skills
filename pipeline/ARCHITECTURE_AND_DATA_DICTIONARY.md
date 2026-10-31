# Aiversecity Hackathon — Data Engineering & ML Data Architecture Specification

## 1. Pre-Ingestion Source Availability Inspection

Before designing the ingestion pipeline, each target Malaysian and international data source was inspected for programmatic access, licensing, and bulk-download availability as of October 2026:

| Source ID | Source Name | Official URL | Access Method Inspected | Bulk API / Download Status | Pipeline Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SRC_MASCO_2020` | Ministry of Human Resources (KESUMA) — Malaysia Standard Classification of Occupations (MASCO) 2020 | `https://emasco.mohr.gov.my/system-api/storage/uploads/masco_2020_en.pdf` | Official PDF publication & eMASCO web directory (`https://emasco.mohr.gov.my/`) | **Public PDF & Web Portal** (No open unauthenticated REST bulk endpoint; 10 major groups, 490 unit groups, 6,366 minor unit groups) | Extract verified 4-digit and 6-digit MASCO codes, titles, skill levels, and qualification mappings into Bronze seed tables with `VERIFIED_PUBLIC_DOC` provenance. |
| `SRC_ILMIA_MJP` | Institute of Labour Market Information and Analysis (ILMIA) / DOSM — My Job Profile | `https://www.malaysia.gov.my/en/digital-services/my-job-profile` | Interactive government portal (`https://www.ilmia.gov.my/`) | **Interactive Web Portal Only** (No public bulk CSV/JSON dump) | Reference verified MASCO-aligned occupational descriptions; supplement missing granular skill matrices via ESCO crosswalk and flag simulated extensions explicitly. |
| `SRC_MYCOL_2024` | TalentCorp & ILMIA — Malaysia Critical Occupations List (MyCOL) 2022/2023 & MyMahir MyCOL 2024/2025 | `https://www.talentcorp.com.my/resources/publications/mymahir-malaysia-critical-occupations-list-mycol20242025/` | Official technical reports & PDF tables | **Public PDF Reports** (Contains verified 4-digit MASCO shortage statuses across 18 strategic sectors) | Ingest verified critical occupation indicators (skilled, sought-after, strategic shortage status) as real demand anchors (`VERIFIED_PUBLIC_DOC`). |
| `SRC_MYFUTUREJOBS_LMX` | PERKESO — MYFutureJobs Labour Market Exchange (LMX) | `https://myfuturejobs.gov.my/labour-market-exchange/` | Web dashboard, Wage Guide & Career Bridge tool | **Interactive Dashboard & Summary PDFs** (No open unauthenticated raw job-posting firehose) | Record macro vacancy anchors where published; generate explicitly labelled conditional time-series simulations (`SYNTHETIC_SIMULATION`) for granular quarterly skill trends. |
| `SRC_ESCO_V121` | European Commission — ESCO (European Skills, Competences, Qualifications and Occupations) v1.2.1 | `https://ec.europa.eu/esco/api/doc/esco_api_doc.html` | Official REST API (`https://ec.europa.eu/esco/api`) & SKOS/CSV taxonomy | **Open REST API & Bulk CSV** (Licensed under EUPL 1.2 / CC-BY 4.0) | Map MASCO 4-digit unit groups (aligned with ISCO-08) to ESCO occupation concepts and extract granular required/optional skill relations. |
| `SRC_ELATIH_HRDC` | HRD Corp (KESUMA) — e-LATiH Premier Learning Hub | `https://elatih.hrdcorp.gov.my/` | Public course catalogue web pages | **Public Web Catalogue** (Over 2,000 free courses for Malaysians; no public open bulk API) | Curate verified course titles, URLs, durations, and MYR 0.00 cost records (`VERIFIED_WEB_CATALOGUE`); supplement specialized technical milestones with explicitly flagged synthetic/reference modules where needed. |
| `SRC_UN_SDG` | United Nations Department of Economic and Social Affairs — 17 Sustainable Development Goals | `https://sdgs.un.org/goals` | Official UN SDG Goal & Target metadata (17 Goals, 169 Targets) | **Public Open Specification** | Map occupations and skills to specific UN SDG goals and targets (e.g., Target 4.4, 8.2, 8.5, 9.5, 13.3) with evidence-based rationales. |
| `SRC_SYNTH_GEN` | Aiversecity Deterministic Synthetic Generator v1.0 | `local://src/part3_cv_pipeline.py` | Internal reproducible Python generator (`seed=42`) | **Deterministic Local Generation** | Generates 1,000 synthetic Malaysian CVs, DOPE test response vectors, and conditional forecasting trajectories with explicit `is_synthetic=True` and `SYNTHETIC_GENERATED` flags. |

## 2. Mathematical Formulations for Matching & DOPE Scoring

### 2.1 Transparent Career Match Scoring Formula
For a candidate profile $u$ and target occupation $j$, let $R_j$ be the set of required skills for $j$, $P_j$ the set of preferred skills, and $S_u$ the set of canonical skills demonstrated in profile $u$ with proficiency $p_{u,s} \in \{1,2,3,4,5\}$. Let $r_{j,s} \in \{1,2,3,4,5\}$ be the required proficiency for skill $s$ in occupation $j$.

1. **Demonstrated Skill Overlap ($O_{u,j} \in [0,1]$):**
   $$O_{u,j} = 0.75 \cdot \frac{|S_u \cap R_j|}{\max(|R_j|, 1)} + 0.25 \cdot \frac{|S_u \cap P_j|}{\max(|P_j|, 1)}$$

2. **Proficiency Alignment ($A_{u,j} \in [0,1]$):**
   $$A_{u,j} = \frac{1}{|R_j \cup P_j|} \sum_{s \in R_j \cup P_j} \min\left(1.0, \frac{p_{u,s}}{r_{j,s}}\right)$$

3. **Education & Experience Readiness ($E_{u,j} \in [0,1]$):**
   $$E_{u,j} = 0.5 \cdot \mathbb{I}(\text{edu}_u \ge \text{edu}_j) + 0.5 \cdot \min\left(1.0, \frac{\text{exp}_u + 1.0}{\text{exp}_j + 1.0}\right)$$

4. **Interest, Learning Feasibility & Labour Trend Score ($M_{u,j} \in [0,1]$):**
   $$M_{u,j} = 0.4 \cdot \mathbb{I}(\text{sector}_j \in \text{interests}_u) + 0.3 \cdot \text{feasibility}(u, j) + 0.3 \cdot \text{demand\_norm}_j$$

5. **Composite Explainable Baseline Match Score ($\text{Score}_{u,j} \in [0,100]$):**
   $$\text{Score}_{u,j} = 100 \times \left(0.45 \cdot O_{u,j} + 0.25 \cdot A_{u,j} + 0.15 \cdot E_{u,j} + 0.15 \cdot M_{u,j}\right)$$

### 2.2 DOPE Reflective Assessment Normalisation
Given $N=24$ questions where each response $i \in \{1,\dots,N\}$ awards $w_{i,b} \in \{0, 1\}$ to bird style $b \in \{\text{Dove}, \text{Owl}, \text{Peacock}, \text{Eagle}\}$:
$$\text{Score}_b = \frac{100}{N} \sum_{i=1}^{N} w_{i,b}, \quad \sum_{b} \text{Score}_b = 100\%$$

## 3. Dataset Cards (Provenance, Synthetic Assumptions & Limitations)

- **Dataset Card 1 — Career & Skills Taxonomy (`occupations.csv`, `skills.csv`, `occupation_skills.csv`, `id_crosswalk.csv`)**: Anchored to KESUMA MASCO 2020 (`SRC_MASCO_2020`), TalentCorp MyCOL (`SRC_MYCOL_2024`), and ESCO v1.2.1 (`SRC_ESCO_V121`). Proficiency targets (1–5) and transferability weights are deterministically parameterized by MASCO skill level and career tier.
- **Dataset Card 2 — Synthetic Malaysian CV Corpus & Gold NER Evaluation Set (`synthetic_cvs.csv`, `cv_experiences.csv`, `profile_skills.csv`, `cv_skill_extraction_gold.csv`)**: 100% synthetic (`SRC_SYNTH_GEN`, `seed=42`) with zero real identities or PII. Models four Malaysian personas (`Student`, `Fresh_Graduate`, `Career_Switcher`, `Working_Adult`) with synonym variations and deliberate missing fields.
- **Dataset Card 3 — Conditional Labour Demand & AI Disruption Forecasts (`trend_observations.csv`, `forecast_features_scenarios.csv`)**: Shortage tiers anchored to MyCOL (`SRC_MYCOL_2024`); quarterly series (`2021-Q1` to `2026-Q3`) and future disruption scenarios (`moderate_disruption_scenario_val`, `fast_disruption_scenario_val`) are explicitly labelled conditional simulations (`SYNTHETIC_SIMULATION`), decoupling AI exposure from AI augmentation.
