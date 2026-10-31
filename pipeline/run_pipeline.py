"""
Master End-to-End Pipeline Orchestrator for the Aiversecity Hackathon.
"""
import json
import time
from src.config_and_schemas import GOLD_DIR, logger
from src.part1_2_taxonomy_generator import run_part1_2
from src.part3_cv_pipeline import run_part3
from src.part4_forecasting_pipeline import build_trend_observations_and_forecasts
from src.part5_6_matching_and_dope import (
    build_dope_assessment_tables,
    build_career_matching_engine,
)
from src.part7_8_career_tree_and_sdgs import (
    build_career_graph,
    recommend_career_paths,
    build_learning_pathways_and_sdgs,
)
from src.part9_10_splits_and_tests import build_split_manifest
from tests.test_data_quality import run_all_tests


def main() -> None:
    start_ts = time.time()
    logger.info("=================================================================")
    logger.info("AIVERSECITY HACKATHON — MASTER DATA ENGINEERING PIPELINE STARTING")
    logger.info("=================================================================")

    df_sources, df_occ, df_skills, df_occ_skills = run_part1_2()
    df_cvs, df_profile_skills, cv_eval_metrics = run_part3(df_occ, df_skills)

    logger.info("--- Running Part 4: Demand Forecasting & Scenario Simulation ---")
    df_obs, df_forecasts, forecast_metrics = build_trend_observations_and_forecasts(
        df_occ, df_occ_skills
    )

    logger.info("--- Running Part 5 & Part 6: DOPE Assessment & Career Matching ---")
    _, _, _, df_dope_tp, _ = build_dope_assessment_tables()
    df_pairs, _, matching_metrics = build_career_matching_engine(
        df_cvs, df_profile_skills, df_occ, df_occ_skills, df_skills, df_forecasts
    )

    logger.info("--- Running Part 7 & Part 8: Career Tree DAG & SDG Pathways ---")
    df_nodes, df_edges, _ = build_career_graph(df_occ, df_occ_skills)
    sample_routes = recommend_career_paths(
        df_nodes, df_edges, start_node_id="NODE_OCC_0001", max_hops=3
    )
    build_learning_pathways_and_sdgs(df_occ, df_skills, df_occ_skills)

    logger.info("--- Running Part 9 & Part 10: Split Manifest & Quality Gate ---")
    build_split_manifest(df_cvs, df_obs, df_pairs, df_dope_tp, df_edges)
    test_results = run_all_tests()

    elapsed = round(time.time() - start_ts, 2)
    report = {
        "pipeline_execution_seconds": elapsed,
        "dataset_counts": {
            "sources": len(df_sources),
            "occupations": len(df_occ),
            "skills": len(df_skills),
            "occupation_skills": len(df_occ_skills),
            "synthetic_cvs": len(df_cvs),
            "extracted_profile_skills": len(df_profile_skills),
            "trend_observations": len(df_obs),
            "role_match_pairs": len(df_pairs),
            "career_nodes": len(df_nodes),
            "career_edges": len(df_edges),
        },
        "cv_skill_extraction_holdout_metrics": cv_eval_metrics,
        "demand_forecasting_chronological_test_metrics": forecast_metrics,
        "career_matching_group_test_metrics": matching_metrics,
        "sample_branching_routes_from_junior_data_analyst": sample_routes[:3],
        "automated_quality_tests": test_results,
    }

    report_path = GOLD_DIR / "evaluation_metrics_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    logger.info(f"Pipeline finished in {elapsed}s. Report written to {report_path}")


if __name__ == "__main__":
    main()
