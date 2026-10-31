"""
Part 9 & Part 10: Task-Specific Split Manifest Generator.
"""
import pandas as pd
from src.config_and_schemas import RANDOM_SEED, validate_and_save_df, logger


def build_split_manifest(
    df_cvs: pd.DataFrame,
    df_obs: pd.DataFrame,
    df_pairs: pd.DataFrame,
    df_dope_tp: pd.DataFrame,
    df_edges: pd.DataFrame,
) -> pd.DataFrame:
    manifest_rows = []
    m_idx = 1

    for _, cv in df_cvs.iterrows():
        pid = cv["profile_id"]
        num = int(pid.split("_")[1])
        part = "TEST_INDEPENDENT_GOLD" if num <= 150 else "TRAIN_DEV"
        manifest_rows.append({
            "manifest_id": f"SPL_{m_idx:06d}",
            "task_name": "CV_SKILL_EXTRACTION",
            "record_id": pid,
            "entity_group_id": pid,
            "split_partition": part,
            "split_strategy": "INDEPENDENT_GOLD_ANNOTATION_HOLDOUT",
            "random_seed": RANDOM_SEED,
        })
        m_idx += 1

    unique_p = df_pairs["profile_id"].unique()
    n_p = len(unique_p)
    train_p = set(unique_p[:int(0.70 * n_p)])
    val_p = set(unique_p[int(0.70 * n_p):int(0.85 * n_p)])

    for _, row in df_pairs.iterrows():
        pid = row["profile_id"]
        part = "TRAIN" if pid in train_p else ("VAL" if pid in val_p else "TEST")
        manifest_rows.append({
            "manifest_id": f"SPL_{m_idx:06d}",
            "task_name": "CAREER_MATCHING",
            "record_id": row["match_id"],
            "entity_group_id": pid,
            "split_partition": part,
            "split_strategy": "GROUPED_70_15_15_BY_PROFILE_ID",
            "random_seed": RANDOM_SEED,
        })
        m_idx += 1

    for _, obs in df_obs.iterrows():
        dt = str(obs["observation_date"])
        if dt <= "2024-12-31":
            part = "TRAIN"
        elif dt <= "2025-12-31":
            part = "VAL"
        else:
            part = "TEST"
        manifest_rows.append({
            "manifest_id": f"SPL_{m_idx:06d}",
            "task_name": "DEMAND_FORECASTING",
            "record_id": obs["observation_id"],
            "entity_group_id": obs["occupation_id"],
            "split_partition": part,
            "split_strategy": "STRICT_CHRONOLOGICAL_SPLIT",
            "random_seed": RANDOM_SEED,
        })
        m_idx += 1

    for _, tp in df_dope_tp.iterrows():
        manifest_rows.append({
            "manifest_id": f"SPL_{m_idx:06d}",
            "task_name": "DOPE_DETERMINISTIC_VALIDATION",
            "record_id": tp["test_profile_id"],
            "entity_group_id": tp["test_profile_id"],
            "split_partition": "DETERMINISTIC_TEST",
            "split_strategy": "RULE_INVARIANT_VERIFICATION",
            "random_seed": RANDOM_SEED,
        })
        m_idx += 1

    for _, edg in df_edges.iterrows():
        manifest_rows.append({
            "manifest_id": f"SPL_{m_idx:06d}",
            "task_name": "CAREER_GRAPH_VALIDATION",
            "record_id": edg["edge_id"],
            "entity_group_id": edg["source_node_id"],
            "split_partition": "GRAPH_INTEGRITY_TEST",
            "split_strategy": "TOPOLOGICAL_AND_PREREQUISITE_VERIFICATION",
            "random_seed": RANDOM_SEED,
        })
        m_idx += 1

    df_manifest = pd.DataFrame(manifest_rows)
    validate_and_save_df(df_manifest, "split_manifest")
    logger.info(f"Split Manifest generated with {len(df_manifest)} tracked records.")
    return df_manifest
