"""
Part 4: AI Skill and Job Demand Forecasting Pipeline.
"""
from typing import Dict, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from src.config_and_schemas import RANDOM_SEED, validate_and_save_df, logger

QUARTERS = [
    "2021-03-31", "2021-06-30", "2021-09-30", "2021-12-31",
    "2022-03-31", "2022-06-30", "2022-09-30", "2022-12-31",
    "2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31",
    "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31",
    "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31",
    "2026-03-31", "2026-06-30", "2026-09-30",
]


def build_trend_observations_and_forecasts(
    df_occ: pd.DataFrame,
    df_occ_skills: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, float]]:
    rng = np.random.default_rng(RANDOM_SEED)

    primary_skill_map = (
        df_occ_skills[df_occ_skills["importance_level"] == "Required"]
        .groupby("occupation_id")["skill_id"]
        .first()
        .to_dict()
    )

    obs_rows = []
    obs_idx = 1

    for _, occ in df_occ.iterrows():
        occ_id = occ["occupation_id"]
        skill_id = primary_skill_map.get(occ_id, "SKL_0001")
        sector = occ["industry_sector"]
        mycol = occ["mycol_critical_status"]

        if mycol == "CRITICAL_SHORTAGE":
            quarterly_drift = 1.65
            ev_type = "MYCOL_BENCHMARK_ANCHOR"
            ev_status = "ANCHORED_SIMULATION"
            src_id = "SRC_MYCOL_2024"
        elif mycol == "MODERATE_DEMAND":
            quarterly_drift = 0.95
            ev_type = "SYNTHETIC_CONDITIONAL_SERIES"
            ev_status = "SYNTHETIC_SIMULATION"
            src_id = "SRC_SYNTH_GEN"
        else:
            quarterly_drift = 0.45
            ev_type = "SYNTHETIC_CONDITIONAL_SERIES"
            ev_status = "SYNTHETIC_SIMULATION"
            src_id = "SRC_SYNTH_GEN"

        if "AI, Data" in sector or "Green Transition" in sector or "Semiconductor" in sector:
            quarterly_drift += 0.55

        level = 100.0
        for q_i, q_date in enumerate(QUARTERS):
            prev_val = level
            seasonal = 1.2 * np.sin(2 * np.pi * (q_i % 4) / 4.0)
            noise = float(rng.normal(0, 1.15))
            if q_i > 0:
                level = max(55.0, round(prev_val + quarterly_drift + seasonal + noise, 2))
            else:
                level = round(100.0 + float(rng.normal(0, 1.5)), 2)
                prev_val = round(level - quarterly_drift, 2)

            obs_rows.append({
                "observation_id": f"OBS_{obs_idx:05d}",
                "observation_date": q_date,
                "occupation_id": occ_id,
                "skill_id": skill_id,
                "industry": sector,
                "country": "Malaysia",
                "demand_measure": float(level),
                "demand_unit": "Normalized_Vacancy_Index_Base100",
                "previous_period_value": float(prev_val),
                "source_id": src_id,
                "evidence_type": ev_type,
                "evidence_status": ev_status,
            })
            obs_idx += 1

    df_obs = pd.DataFrame(obs_rows)
    validate_and_save_df(df_obs, "trend_observations")

    panel_records = []
    for occ_id, group in df_obs.groupby("occupation_id", sort=False):
        g = group.sort_values("observation_date").reset_index(drop=True)
        vals = g["demand_measure"].values
        dates = g["observation_date"].values
        sector = g["industry"].iloc[0]
        skill_id = g["skill_id"].iloc[0]

        for t in range(3, len(g)):
            lag1 = vals[t - 1]
            lag2 = vals[t - 2]
            lag3 = vals[t - 3]
            ma3 = float(np.mean(vals[max(0, t - 3):t]))
            ma6 = float(np.mean(vals[max(0, t - 6):t]))
            qoq = (lag1 - lag2) / max(lag2, 1e-6)
            vol = float(np.std(vals[max(0, t - 6):t]))
            panel_records.append({
                "occupation_id": occ_id,
                "skill_id": skill_id,
                "industry": sector,
                "obs_date": dates[t],
                "target_y": vals[t],
                "lag1": lag1,
                "lag2": lag2,
                "lag3": lag3,
                "ma3": ma3,
                "ma6": ma6,
                "qoq": qoq,
                "vol": vol,
            })

    df_panel = pd.DataFrame(panel_records)
    feature_cols = ["lag1", "lag2", "lag3", "ma3", "qoq", "vol"]

    train_mask = df_panel["obs_date"] <= "2024-12-31"
    test_mask = df_panel["obs_date"] > "2025-12-31"

    model = Ridge(alpha=1.0, random_state=RANDOM_SEED)
    model.fit(df_panel.loc[train_mask, feature_cols], df_panel.loc[train_mask, "target_y"])

    y_test = df_panel.loc[test_mask, "target_y"].values
    pred_persistence = df_panel.loc[test_mask, "lag1"].values
    pred_ma3 = df_panel.loc[test_mask, "ma3"].values
    pred_ridge = model.predict(df_panel.loc[test_mask, feature_cols])

    test_residuals = y_test - pred_ridge
    residual_std = float(np.std(test_residuals))

    forecast_metrics = {
        "train_period": "2021-Q4 to 2024-Q4",
        "val_period": "2025-Q1 to 2025-Q4",
        "test_period": "2026-Q1 to 2026-Q3",
        "test_samples": int(test_mask.sum()),
        "persistence_baseline_mae": round(float(mean_absolute_error(y_test, pred_persistence)), 4),
        "persistence_baseline_rmse": round(float(np.sqrt(mean_squared_error(y_test, pred_persistence))), 4),
        "moving_average_3q_mae": round(float(mean_absolute_error(y_test, pred_ma3)), 4),
        "moving_average_3q_rmse": round(float(np.sqrt(mean_squared_error(y_test, pred_ma3))), 4),
        "ridge_autoregressive_mae": round(float(mean_absolute_error(y_test, pred_ridge)), 4),
        "ridge_autoregressive_rmse": round(float(np.sqrt(mean_squared_error(y_test, pred_ridge))), 4),
    }
    logger.info(f"Forecasting Chronological Test Metrics: {forecast_metrics}")

    forecast_rows = []
    f_idx = 1
    for occ_id, group in df_obs.groupby("occupation_id", sort=False):
        g = group.sort_values("observation_date").reset_index(drop=True)
        vals = g["demand_measure"].values
        sector = g["industry"].iloc[0]
        skill_id = g["skill_id"].iloc[0]

        lag1, lag2, lag3 = vals[-1], vals[-2], vals[-3]
        ma3 = float(np.mean(vals[-3:]))
        ma6 = float(np.mean(vals[-6:]))
        qoq = float((lag1 - lag2) / max(lag2, 1e-6))
        vol = float(np.std(vals[-6:]))

        if qoq > 0.018:
            trend_dir = "ACCELERATING"
        elif qoq > 0.005:
            trend_dir = "GROWING"
        elif qoq >= -0.005:
            trend_dir = "STABLE"
        else:
            trend_dir = "MODERATING"

        if "AI, Data" in sector or "Software" in sector:
            ai_exp, ai_aug = 0.82, 0.91
        elif "FinTech" in sector or "Digital Creative" in sector or "Commerce" in sector:
            ai_exp, ai_aug = 0.74, 0.80
        elif "Semiconductor" in sector or "Green" in sector or "Healthcare" in sector:
            ai_exp, ai_aug = 0.48, 0.76
        else:
            ai_exp, ai_aug = 0.42, 0.68

        X_latest = pd.DataFrame([{
            "lag1": lag1, "lag2": lag2, "lag3": lag3, "ma3": ma3, "qoq": qoq, "vol": vol
        }])
        one_step_ridge = float(model.predict(X_latest)[0])
        horizon_q = 4
        four_step_ridge = round(one_step_ridge + 3 * (one_step_ridge - lag1), 2)

        net_ai_synergy = (ai_aug - 0.5 * ai_exp)
        mod_scenario = round(four_step_ridge * (1.0 + 0.06 * net_ai_synergy), 2)
        fast_scenario = round(four_step_ridge * (1.0 + 0.14 * net_ai_synergy), 2)

        ci_half = 1.645 * residual_std * np.sqrt(horizon_q)

        forecast_rows.append({
            "forecast_id": f"FCT_{f_idx:04d}",
            "occupation_id": occ_id,
            "skill_id": skill_id,
            "feature_cutoff_date": "2026-09-30",
            "forecast_target_date": "2027-09-30",
            "forecast_horizon_quarters": horizon_q,
            "qoq_demand_growth": round(qoq, 4),
            "rolling_3q_avg": round(ma3, 2),
            "rolling_6q_avg": round(ma6, 2),
            "historical_volatility": round(vol, 3),
            "recent_trend_direction": trend_dir,
            "ai_exposure_index": ai_exp,
            "ai_augmentation_potential": ai_aug,
            "baseline_persistence_pred": round(float(lag1), 2),
            "baseline_ma3_pred": round(ma3, 2),
            "ridge_ar_pred": four_step_ridge,
            "moderate_disruption_scenario_val": mod_scenario,
            "fast_disruption_scenario_val": fast_scenario,
            "uncertainty_lower_90": round(four_step_ridge - ci_half, 2),
            "uncertainty_upper_90": round(four_step_ridge + ci_half, 2),
            "model_version": "ridge_ar_v1.0_chronological",
            "scenario_assumptions": (
                "Conditional simulation only: Moderate assumes +6% net AI augmentation multiplier; "
                "Fast assumes +14% net AI augmentation & green-digital transition multiplier. "
                "High AI exposure is modelled jointly with augmentation, not automatic job decline."
            ),
        })
        f_idx += 1

    df_forecasts = pd.DataFrame(forecast_rows)
    validate_and_save_df(df_forecasts, "forecast_features_scenarios")
    return df_obs, df_forecasts, forecast_metrics
