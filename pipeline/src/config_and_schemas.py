"""
Centralised configuration, directory layout, schema definitions, and
idempotent data quality validation utilities for the Aiversecity platform.
"""
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict
import pandas as pd

RANDOM_SEED = 42
RETRIEVAL_DATE = "2026-10-23"

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BRONZE_DIR = DATA_DIR / "bronze"
SILVER_DIR = DATA_DIR / "silver"
GOLD_DIR = DATA_DIR / "gold"

for directory in [BRONZE_DIR, SILVER_DIR, GOLD_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("aiversecity.schema")

SCHEMAS: Dict[str, Dict[str, object]] = {
    "source_catalogue": {
        "layer": "bronze",
        "pk": ["source_id"],
        "columns": [
            "source_id", "source_name", "source_url", "source_type",
            "publication_date", "retrieval_date", "licence_or_usage_notes",
            "verification_status"
        ],
    },
    "occupations": {
        "layer": "silver",
        "pk": ["occupation_id"],
        "columns": [
            "occupation_id", "canonical_title", "masco_2020_code", "esco_code",
            "industry_sector", "career_level", "role_description",
            "min_education_level", "min_experience_years", "mycol_critical_status",
            "primary_sdg_id", "sdg_rationale", "source_id", "verification_status",
            "is_synthetic"
        ],
    },
    "skills": {
        "layer": "silver",
        "pk": ["skill_id"],
        "columns": [
            "skill_id", "canonical_name", "skill_category", "skill_type",
            "synonyms_pipe_delimited", "description", "esco_skill_uri",
            "source_id", "verification_status", "is_synthetic"
        ],
    },
    "occupation_skills": {
        "layer": "silver",
        "pk": ["occ_skill_id"],
        "columns": [
            "occ_skill_id", "occupation_id", "skill_id", "importance_level",
            "required_proficiency", "transferability_weight", "source_id",
            "verification_status"
        ],
    },
    "id_crosswalk": {
        "layer": "silver",
        "pk": ["crosswalk_id"],
        "columns": [
            "crosswalk_id", "entity_type", "canonical_id", "external_source_id",
            "external_code", "external_label", "mapping_confidence"
        ],
    },
    "synthetic_cvs": {
        "layer": "silver",
        "pk": ["profile_id"],
        "columns": [
            "profile_id", "persona_segment", "state_malaysia", "highest_education",
            "field_of_study", "years_experience", "current_or_last_role_id",
            "target_interest_sectors", "max_weekly_learning_hours", "raw_cv_text",
            "is_synthetic", "source_id"
        ],
    },
    "cv_experiences": {
        "layer": "silver",
        "pk": ["experience_id"],
        "columns": [
            "experience_id", "profile_id", "experience_type", "organization_type",
            "role_title", "duration_months", "evidence_description", "is_synthetic"
        ],
    },
    "profile_skills": {
        "layer": "gold",
        "pk": ["profile_skill_id"],
        "columns": [
            "profile_skill_id", "profile_id", "skill_id", "extracted_surface_term",
            "estimated_proficiency", "extraction_confidence", "evidence_snippet",
            "extraction_method"
        ],
    },
    "cv_skill_extraction_gold": {
        "layer": "gold",
        "pk": ["eval_id"],
        "columns": [
            "eval_id", "profile_id", "ground_truth_skill_id",
            "ground_truth_surface_span", "annotator_note"
        ],
    },
    "trend_observations": {
        "layer": "gold",
        "pk": ["observation_id"],
        "columns": [
            "observation_id", "observation_date", "occupation_id", "skill_id",
            "industry", "country", "demand_measure", "demand_unit",
            "previous_period_value", "source_id", "evidence_type", "evidence_status"
        ],
    },
    "forecast_features_scenarios": {
        "layer": "gold",
        "pk": ["forecast_id"],
        "columns": [
            "forecast_id", "occupation_id", "skill_id", "feature_cutoff_date",
            "forecast_target_date", "forecast_horizon_quarters", "qoq_demand_growth",
            "rolling_3q_avg", "rolling_6q_avg", "historical_volatility",
            "recent_trend_direction", "ai_exposure_index", "ai_augmentation_potential",
            "baseline_persistence_pred", "baseline_ma3_pred", "ridge_ar_pred",
            "moderate_disruption_scenario_val", "fast_disruption_scenario_val",
            "uncertainty_lower_90", "uncertainty_upper_90", "model_version",
            "scenario_assumptions"
        ],
    },
    "role_match_pairs": {
        "layer": "gold",
        "pk": ["match_id"],
        "columns": [
            "match_id", "profile_id", "occupation_id", "rank_for_profile",
            "overall_match_score", "skill_overlap_score", "proficiency_alignment_score",
            "experience_education_score", "interest_trend_score",
            "dope_reflection_alignment", "rule_based_label", "ml_predicted_prob",
            "is_synthetic_label"
        ],
    },
    "role_match_explanations": {
        "layer": "gold",
        "pk": ["explanation_id"],
        "columns": [
            "explanation_id", "match_id", "profile_id", "occupation_id",
            "why_it_matches", "met_requirements_list", "missing_skills_list",
            "recommended_bridging_actions", "supporting_evidence_snippets"
        ],
    },
    "dope_questions": {
        "layer": "silver",
        "pk": ["question_id"],
        "columns": [
            "question_id", "question_number", "reflection_context",
            "question_text", "disclaimer_note"
        ],
    },
    "dope_answer_options": {
        "layer": "silver",
        "pk": ["option_id"],
        "columns": ["option_id", "question_id", "option_key", "option_text"],
    },
    "dope_scoring_rules": {
        "layer": "silver",
        "pk": ["rule_id"],
        "columns": [
            "rule_id", "option_id", "bird_dimension", "raw_points",
            "normalization_formula", "tie_breaking_priority"
        ],
    },
    "dope_test_profiles": {
        "layer": "silver",
        "pk": ["test_profile_id"],
        "columns": [
            "test_profile_id", "pattern_archetype", "response_options_pipe_delimited",
            "is_synthetic"
        ],
    },
    "dope_assessment_results": {
        "layer": "gold",
        "pk": ["result_id"],
        "columns": [
            "result_id", "test_profile_id", "dove_score_pct", "owl_score_pct",
            "peacock_score_pct", "eagle_score_pct", "primary_reflection_style",
            "secondary_reflection_style", "is_tie_detected", "reflective_summary"
        ],
    },
    "career_nodes": {
        "layer": "gold",
        "pk": ["node_id"],
        "columns": [
            "node_id", "node_type", "reference_id", "node_title",
            "house_guild_theme", "career_tier", "source_id"
        ],
    },
    "career_edges": {
        "layer": "gold",
        "pk": ["edge_id"],
        "columns": [
            "edge_id", "source_node_id", "target_node_id", "transition_type",
            "required_skill_ids", "shared_skill_ids", "missing_skill_ids",
            "prerequisite_requirements", "estimated_learning_hours",
            "duration_estimation_basis", "transition_difficulty",
            "source_ids", "evidence_status"
        ],
    },
    "career_milestones": {
        "layer": "gold",
        "pk": ["milestone_id"],
        "columns": [
            "milestone_id", "milestone_title", "target_skill_ids",
            "verification_mechanism", "estimated_hours"
        ],
    },
    "learning_resources": {
        "layer": "gold",
        "pk": ["resource_id"],
        "columns": [
            "resource_id", "course_title", "provider_name", "provider_url",
            "delivery_mode", "estimated_hours", "cost_amount", "currency",
            "prerequisite_level", "target_skill_ids", "source_id",
            "verification_status"
        ],
    },
    "pathway_steps": {
        "layer": "gold",
        "pk": ["step_id"],
        "columns": [
            "step_id", "occupation_id", "step_order", "resource_id",
            "prerequisite_step_id", "expected_skill_outcome_id",
            "estimated_completion_hours", "sdg_goal_number", "sdg_target_code"
        ],
    },
    "occupation_sdgs": {
        "layer": "gold",
        "pk": ["occ_sdg_id"],
        "columns": [
            "occ_sdg_id", "occupation_id", "sdg_goal_number", "sdg_goal_title",
            "sdg_target_code", "evidence_rationale", "source_id"
        ],
    },
    "skill_sdgs": {
        "layer": "gold",
        "pk": ["skill_sdg_id"],
        "columns": [
            "skill_sdg_id", "skill_id", "sdg_goal_number", "sdg_goal_title",
            "sdg_target_code", "evidence_rationale", "source_id"
        ],
    },
    "split_manifest": {
        "layer": "gold",
        "pk": ["manifest_id"],
        "columns": [
            "manifest_id", "task_name", "record_id", "entity_group_id",
            "split_partition", "split_strategy", "random_seed"
        ],
    },
}


def validate_and_save_df(
    df: pd.DataFrame,
    table_name: str,
    save_parquet: bool = False,
) -> Path:
    if table_name not in SCHEMAS:
        raise ValueError(f"Unknown table_name '{table_name}' not in SCHEMAS.")

    spec = SCHEMAS[table_name]
    expected_cols = spec["columns"]
    pk_cols = spec["pk"]
    layer = spec["layer"]

    missing_cols = [c for c in expected_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"[{table_name}] Missing required columns: {missing_cols}")

    df = df[expected_cols].copy()

    if df[pk_cols].isnull().any().any():
        raise ValueError(f"[{table_name}] Null values detected in primary key {pk_cols}")

    if df.duplicated(subset=pk_cols).any():
        dups = df[df.duplicated(subset=pk_cols, keep=False)][pk_cols].head(5)
        raise ValueError(f"[{table_name}] Duplicate primary keys found:\n{dups}")

    target_dir = {"bronze": BRONZE_DIR, "silver": SILVER_DIR, "gold": GOLD_DIR}[layer]
    csv_path = target_dir / f"{table_name}.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8")

    if save_parquet:
        try:
            df.to_parquet(target_dir / f"{table_name}.parquet", index=False)
        except Exception:
            pass

    file_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()[:16]
    log_path = BRONZE_DIR / "ingestion_log.csv"
    log_entry = pd.DataFrame([{
        "timestamp_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "table_name": table_name,
        "layer": layer,
        "row_count": len(df),
        "sha256_prefix": file_hash,
    }])
    if log_path.exists():
        existing_log = pd.read_csv(log_path)
        existing_log = existing_log[existing_log["table_name"] != table_name]
        updated_log = pd.concat([existing_log, log_entry], ignore_index=True)
        updated_log.to_csv(log_path, index=False)
    else:
        log_entry.to_csv(log_path, index=False)

    logger.info(
        f"Saved [{layer.upper()}] {table_name}.csv ({len(df)} rows, sha256={file_hash})"
    )
    return csv_path
