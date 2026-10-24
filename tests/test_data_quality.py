"""
Automated Data Quality, Referential Integrity, Leakage Prevention,
and Career Graph Validation Suite for the Aiversecity Lakehouse.
"""
import sys
from pathlib import Path
from typing import Dict
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.config_and_schemas import BRONZE_DIR, SILVER_DIR, GOLD_DIR, SCHEMAS, logger
from src.part7_8_career_tree_and_sdgs import recommend_career_paths


def load_table(name: str) -> pd.DataFrame:
    layer = SCHEMAS[name]["layer"]
    folder = {"bronze": BRONZE_DIR, "silver": SILVER_DIR, "gold": GOLD_DIR}[layer]
    path = folder / f"{name}.csv"
    assert path.exists(), f"Missing dataset file: {path}"
    return pd.read_csv(path)


def test_all_25_tables_exist_and_match_schema() -> None:
    for name, spec in SCHEMAS.items():
        df = load_table(name)
        assert len(df) > 0, f"Table {name} is empty!"
        assert list(df.columns) == spec["columns"], f"Column mismatch in {name}"
        pk = spec["pk"]
        assert not df[pk].isnull().any().any(), f"Null PK in {name}"
        assert not df.duplicated(subset=pk).any(), f"Duplicate PK in {name}"


def test_taxonomy_volume_and_referential_integrity() -> None:
    df_src = load_table("source_catalogue")
    df_occ = load_table("occupations")
    df_skl = load_table("skills")
    df_os = load_table("occupation_skills")

    assert 150 <= len(df_occ) <= 250
    assert 250 <= len(df_skl) <= 500

    src_ids = set(df_src["source_id"])
    occ_ids = set(df_occ["occupation_id"])
    skl_ids = set(df_skl["skill_id"])

    assert set(df_occ["source_id"]).issubset(src_ids)
    assert set(df_skl["source_id"]).issubset(src_ids)
    assert set(df_os["occupation_id"]).issubset(occ_ids)
    assert set(df_os["skill_id"]).issubset(skl_ids)


def test_cv_pipeline_and_independent_gold_separation() -> None:
    df_cvs = load_table("synthetic_cvs")
    df_ps = load_table("profile_skills")
    df_gold = load_table("cv_skill_extraction_gold")

    assert len(df_cvs) == 1000
    assert df_cvs["is_synthetic"].all()
    assert len(df_gold["profile_id"].unique()) == 150
    assert (df_ps["extraction_confidence"].between(0.5, 1.0)).all()


def test_chronological_forecasting_and_no_future_leakage() -> None:
    df_obs = load_table("trend_observations")
    df_fct = load_table("forecast_features_scenarios")
    df_spl = load_table("split_manifest")

    fct_splits = df_spl[df_spl["task_name"] == "DEMAND_FORECASTING"].merge(
        df_obs[["observation_id", "observation_date"]],
        left_on="record_id",
        right_on="observation_id",
    )
    max_train_date = fct_splits[fct_splits["split_partition"] == "TRAIN"]["observation_date"].max()
    min_val_date = fct_splits[fct_splits["split_partition"] == "VAL"]["observation_date"].min()
    max_val_date = fct_splits[fct_splits["split_partition"] == "VAL"]["observation_date"].max()
    min_test_date = fct_splits[fct_splits["split_partition"] == "TEST"]["observation_date"].min()

    assert max_train_date < min_val_date
    assert max_val_date < min_test_date
    assert (df_fct["uncertainty_lower_90"] < df_fct["ridge_ar_pred"]).all()
    assert (df_fct["ridge_ar_pred"] < df_fct["uncertainty_upper_90"]).all()


def test_career_matching_zero_profile_leakage() -> None:
    df_spl = load_table("split_manifest")
    m_splits = df_spl[df_spl["task_name"] == "CAREER_MATCHING"]

    train_groups = set(m_splits[m_splits["split_partition"] == "TRAIN"]["entity_group_id"])
    val_groups = set(m_splits[m_splits["split_partition"] == "VAL"]["entity_group_id"])
    test_groups = set(m_splits[m_splits["split_partition"] == "TEST"]["entity_group_id"])

    assert len(train_groups & val_groups) == 0
    assert len(train_groups & test_groups) == 0
    assert len(val_groups & test_groups) == 0


def test_dope_deterministic_scoring_and_ties() -> None:
    df_q = load_table("dope_questions")
    df_res = load_table("dope_assessment_results")

    assert 16 <= len(df_q) <= 32
    score_sums = (
        df_res["dove_score_pct"]
        + df_res["owl_score_pct"]
        + df_res["peacock_score_pct"]
        + df_res["eagle_score_pct"]
    )
    assert np.allclose(score_sums, 100.0, atol=0.1)
    tie_row = df_res[df_res["test_profile_id"] == "DOPE_TP_005"].iloc[0]
    assert bool(tie_row["is_tie_detected"]) is True
    assert tie_row["dove_score_pct"] == 25.0


def test_career_graph_integrity_and_pathfinding() -> None:
    df_nodes = load_table("career_nodes")
    df_edges = load_table("career_edges")

    node_ids = set(df_nodes["node_id"])
    assert set(df_edges["source_node_id"]).issubset(node_ids)
    assert set(df_edges["target_node_id"]).issubset(node_ids)
    assert (df_edges["estimated_learning_hours"] > 0).all()

    routes = recommend_career_paths(df_nodes, df_edges, start_node_id="NODE_FND_01", max_hops=3)
    assert len(routes) >= 3


def run_all_tests() -> Dict[str, str]:
    tests = [
        test_all_25_tables_exist_and_match_schema,
        test_taxonomy_volume_and_referential_integrity,
        test_cv_pipeline_and_independent_gold_separation,
        test_chronological_forecasting_and_no_future_leakage,
        test_career_matching_zero_profile_leakage,
        test_dope_deterministic_scoring_and_ties,
        test_career_graph_integrity_and_pathfinding,
    ]
    results = {}
    for t in tests:
        t()
        results[t.__name__] = "PASSED"
        logger.info(f"[TEST PASSED] {t.__name__}")
    return results


if __name__ == "__main__":
    run_all_tests()
