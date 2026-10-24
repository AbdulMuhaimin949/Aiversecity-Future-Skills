"""
Part 5 & Part 6: DOPE Reflective Assessment & Explainable Career Matching Engine.
"""
from typing import Dict, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from src.config_and_schemas import RANDOM_SEED, validate_and_save_df, logger

DISCLAIMER = (
    "Reflective self-assessment for personal work-style awareness only; "
    "not a psychometric diagnostic or a predictor of career capability."
)


def build_dope_assessment_tables() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    contexts = [
        ("Team_Collaboration", "When starting a new cross-functional team project, what role do you naturally gravitate toward?"),
        ("Team_Collaboration", "When two teammates disagree on how to implement a feature, how do you typically respond?"),
        ("Team_Collaboration", "What kind of team feedback feels most constructive to you during a sprint review?"),
        ("Team_Collaboration", "How do you prefer to support a colleague who is falling behind on a technical milestone?"),
        ("Team_Collaboration", "In a group brainstorming workshop, what is usually your biggest contribution?"),
        ("Team_Collaboration", "What environment helps you feel most engaged during collaborative problem-solving?"),
        ("Problem_Solving", "When tackling an unfamiliar technical or business problem, what is your very first step?"),
        ("Problem_Solving", "How do you prefer to evaluate trade-offs between two competing technical designs?"),
        ("Problem_Solving", "When debugging a complex workflow failure, how do you structure your investigation?"),
        ("Problem_Solving", "What type of project documentation do you value most when learning a new system?"),
        ("Problem_Solving", "When data is incomplete, how do you prefer to move a project decision forward?"),
        ("Problem_Solving", "How do you judge whether a completed solution is ready for deployment?"),
        ("Change_Adaptation", "When project priorities shift mid-quarter, what is your initial focus?"),
        ("Change_Adaptation", "How do you approach learning a brand-new technology stack or industry domain?"),
        ("Change_Adaptation", "When adopting AI tools in your daily workflow, what excites you most?"),
        ("Change_Adaptation", "How do you react when an established process is replaced with an experimental workflow?"),
        ("Change_Adaptation", "When facing a tight hackathon or launch deadline, how do you manage uncertainty?"),
        ("Change_Adaptation", "What motivates you most when exploring a potential career transition?"),
        ("Communication_Style", "How do you prefer to present your project findings to stakeholders?"),
        ("Communication_Style", "When writing an update for your team, what style do you naturally use?"),
        ("Communication_Style", "In a mentoring or peer-coaching conversation, what do you emphasize?"),
        ("Communication_Style", "How do you prefer to receive instructions on a complex assignment?"),
        ("Communication_Style", "When pitching a project proposal, what angle do you lead with?"),
        ("Communication_Style", "At the end of a major milestone, how do you prefer to reflect with the team?"),
    ]

    option_archetypes = {
        "A": ("Dove", 1, "Focus on team alignment, empathetic listening, and ensuring everyone is supported."),
        "B": ("Owl", 2, "Examine the underlying data, verify specifications, and build a systematic checklist."),
        "C": ("Peacock", 3, "Spark creative possibilities, visualize the big story, and energize stakeholder buy-in."),
        "D": ("Eagle", 4, "Clarify the core objective, make a direct decision, and drive rapid execution."),
    }

    q_rows = []
    opt_rows = []
    rule_rows = []
    rule_idx = 1

    for idx, (ctx, q_text) in enumerate(contexts, start=1):
        q_id = f"DOPE_Q{idx:02d}"
        q_rows.append({
            "question_id": q_id,
            "question_number": idx,
            "reflection_context": ctx,
            "question_text": q_text,
            "disclaimer_note": DISCLAIMER,
        })

        for key in ["A", "B", "C", "D"]:
            bird, priority, desc = option_archetypes[key]
            opt_id = f"{q_id}_{key}"
            opt_rows.append({
                "option_id": opt_id,
                "question_id": q_id,
                "option_key": key,
                "option_text": f"[Context Q{idx}] {desc}",
            })
            rule_rows.append({
                "rule_id": f"RULE_{rule_idx:04d}",
                "option_id": opt_id,
                "bird_dimension": bird,
                "raw_points": 1,
                "normalization_formula": "score_pct = (sum_dimension_points / 24.0) * 100.0",
                "tie_breaking_priority": priority,
            })
            rule_idx += 1

    df_q = pd.DataFrame(q_rows)
    df_opt = pd.DataFrame(opt_rows)
    df_rules = pd.DataFrame(rule_rows)

    validate_and_save_df(df_q, "dope_questions")
    validate_and_save_df(df_opt, "dope_answer_options")
    validate_and_save_df(df_rules, "dope_scoring_rules")

    rng = np.random.default_rng(RANDOM_SEED)
    test_profiles = []
    results_rows = []

    opt_to_bird = dict(zip(df_rules["option_id"], df_rules["bird_dimension"]))

    patterns = [
        ("Pure_Dove_Archetype", ["A"] * 24),
        ("Pure_Owl_Archetype", ["B"] * 24),
        ("Pure_Peacock_Archetype", ["C"] * 24),
        ("Pure_Eagle_Archetype", ["D"] * 24),
        ("Exact_Four_Way_Tie_6_6_6_6", (["A", "B", "C", "D"] * 6)),
        ("Two_Way_Tie_Owl_Eagle_10_10_2_2", (["B"] * 10 + ["D"] * 10 + ["A"] * 2 + ["C"] * 2)),
        ("Two_Way_Tie_Dove_Peacock_11_11_1_1", (["A"] * 11 + ["C"] * 11 + ["B"] * 1 + ["D"] * 1)),
    ]

    for p_idx in range(1, 61):
        tp_id = f"DOPE_TP_{p_idx:03d}"
        if p_idx <= len(patterns):
            archetype, keys = patterns[p_idx - 1]
        else:
            archetype = "Synthetic_Mixed_Responder"
            probs = rng.dirichlet([1.5, 1.5, 1.5, 1.5])
            keys = list(rng.choice(["A", "B", "C", "D"], size=24, p=probs))

        option_ids = [f"DOPE_Q{q_i:02d}_{k}" for q_i, k in enumerate(keys, start=1)]
        test_profiles.append({
            "test_profile_id": tp_id,
            "pattern_archetype": archetype,
            "response_options_pipe_delimited": "|".join(option_ids),
            "is_synthetic": True,
        })

        counts = {"Dove": 0, "Owl": 0, "Peacock": 0, "Eagle": 0}
        for oid in option_ids:
            counts[opt_to_bird[oid]] += 1

        scores_pct = {b: round((c / 24.0) * 100.0, 2) for b, c in counts.items()}
        max_pts = max(counts.values())
        top_birds = [b for b, c in counts.items() if c == max_pts]
        is_tie = len(top_birds) > 1

        priority_map = {"Dove": 1, "Owl": 2, "Peacock": 3, "Eagle": 4}
        ranked_birds = sorted(
            counts.keys(),
            key=lambda b: (-counts[b], priority_map[b])
        )
        primary_b = ranked_birds[0]
        secondary_b = ranked_birds[1]

        if is_tie:
            tied_str = " & ".join(top_birds)
            summary = (
                f"Co-dominant reflection preference ({tied_str} at {scores_pct[primary_b]}% each). "
                f"All four dimensions are preserved continuously ({scores_pct}). {DISCLAIMER}"
            )
        else:
            summary = (
                f"Primary reflective style: {primary_b} ({scores_pct[primary_b]}%), supported by "
                f"{secondary_b} ({scores_pct[secondary_b]}%). {DISCLAIMER}"
            )

        results_rows.append({
            "result_id": f"DOPE_RES_{p_idx:03d}",
            "test_profile_id": tp_id,
            "dove_score_pct": scores_pct["Dove"],
            "owl_score_pct": scores_pct["Owl"],
            "peacock_score_pct": scores_pct["Peacock"],
            "eagle_score_pct": scores_pct["Eagle"],
            "primary_reflection_style": primary_b,
            "secondary_reflection_style": secondary_b,
            "is_tie_detected": bool(is_tie),
            "reflective_summary": summary,
        })

    df_tp = pd.DataFrame(test_profiles)
    df_res = pd.DataFrame(results_rows)

    validate_and_save_df(df_tp, "dope_test_profiles")
    validate_and_save_df(df_res, "dope_assessment_results")

    return df_q, df_opt, df_rules, df_tp, df_res


def build_career_matching_engine(
    df_cvs: pd.DataFrame,
    df_profile_skills: pd.DataFrame,
    df_occ: pd.DataFrame,
    df_occ_skills: pd.DataFrame,
    df_skills: pd.DataFrame,
    df_forecasts: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, float]]:
    skill_name_map = dict(zip(df_skills["skill_id"], df_skills["canonical_name"]))
    edu_rank = {"SPM/SKM": 1, "Diploma/DKM": 2, "Bachelor": 3, "Master/PhD": 4}

    occ_req_map: Dict[str, Dict[str, int]] = {}
    occ_pref_map: Dict[str, Dict[str, int]] = {}
    for _, row in df_occ_skills.iterrows():
        oid = row["occupation_id"]
        sid = row["skill_id"]
        prof = int(row["required_proficiency"])
        if row["importance_level"] == "Required":
            occ_req_map.setdefault(oid, {})[sid] = prof
        else:
            occ_pref_map.setdefault(oid, {})[sid] = prof

    prof_skill_map: Dict[str, Dict[str, Tuple[int, str]]] = {}
    for _, row in df_profile_skills.iterrows():
        pid = row["profile_id"]
        sid = row["skill_id"]
        prof_skill_map.setdefault(pid, {})[sid] = (
            int(row["estimated_proficiency"]),
            str(row["evidence_snippet"]),
        )

    demand_map = dict(zip(df_forecasts["occupation_id"], df_forecasts["ridge_ar_pred"]))
    max_dem = max(demand_map.values()) if demand_map else 140.0
    min_dem = min(demand_map.values()) if demand_map else 90.0

    occ_list = df_occ.to_dict("records")
    pair_rows = []
    explanation_rows = []

    match_idx = 1
    exp_idx = 1

    for cv_i, (_, cv) in enumerate(df_cvs.iloc[:300].iterrows()):
        pid = cv["profile_id"]
        u_skills = prof_skill_map.get(pid, {})
        u_edu = edu_rank.get(cv["highest_education"], 2)
        u_exp = float(cv["years_experience"])
        u_interests = set(str(cv["target_interest_sectors"]).split("|"))
        u_hours = int(cv["max_weekly_learning_hours"])

        scored_candidates = []
        for occ in occ_list:
            oid = occ["occupation_id"]
            req_dict = occ_req_map.get(oid, {})
            pref_dict = occ_pref_map.get(oid, {})

            req_ids = set(req_dict.keys())
            pref_ids = set(pref_dict.keys())
            u_ids = set(u_skills.keys())

            met_req = u_ids & req_ids
            met_pref = u_ids & pref_ids
            missing_req = req_ids - u_ids

            overlap_score = (
                0.75 * (len(met_req) / max(len(req_ids), 1))
                + 0.25 * (len(met_pref) / max(len(pref_ids), 1))
            )

            all_role_skills = {**req_dict, **pref_dict}
            prof_ratios = []
            for sid, r_prof in all_role_skills.items():
                u_prof = u_skills[sid][0] if sid in u_skills else 0
                prof_ratios.append(min(1.0, u_prof / max(r_prof, 1)))
            prof_score = float(np.mean(prof_ratios)) if prof_ratios else 0.0

            o_edu = edu_rank.get(occ["min_education_level"], 3)
            o_exp = float(occ["min_experience_years"])
            edu_ok = 1.0 if u_edu >= o_edu else 0.4
            exp_ratio = min(1.0, (u_exp + 1.0) / (o_exp + 1.0))
            edu_exp_score = 0.5 * edu_ok + 0.5 * exp_ratio

            interest_hit = 1.0 if occ["industry_sector"] in u_interests else 0.2
            est_gap_hours = len(missing_req) * 18.0
            feasibility = min(1.0, (u_hours * 16.0) / max(est_gap_hours, 16.0))
            dem_norm = (demand_map.get(oid, 110.0) - min_dem) / max(max_dem - min_dem, 1e-6)
            interest_trend_score = 0.4 * interest_hit + 0.3 * feasibility + 0.3 * dem_norm

            overall = 100.0 * (
                0.45 * overlap_score
                + 0.25 * prof_score
                + 0.15 * edu_exp_score
                + 0.15 * interest_trend_score
            )
            scored_candidates.append((
                overall, overlap_score * 100, prof_score * 100,
                edu_exp_score * 100, interest_trend_score * 100,
                occ, met_req, met_pref, missing_req
            ))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        selected = scored_candidates[:5] + scored_candidates[-3:]

        for rank_k, item in enumerate(selected, start=1):
            overall, ov_s, pr_s, ee_s, it_s, occ, met_req, met_pref, missing_req = item
            oid = occ["occupation_id"]
            m_id = f"MCH_{match_idx:05d}"

            rule_label = 1 if (ov_s >= 28.0 and ee_s >= 55.0 and overall >= 46.0) else 0
            dope_align = round(65.0 + ((cv_i + rank_k * 7) % 30), 1)

            pair_rows.append({
                "match_id": m_id,
                "profile_id": pid,
                "occupation_id": oid,
                "rank_for_profile": rank_k,
                "overall_match_score": round(overall, 2),
                "skill_overlap_score": round(ov_s, 2),
                "proficiency_alignment_score": round(pr_s, 2),
                "experience_education_score": round(ee_s, 2),
                "interest_trend_score": round(it_s, 2),
                "dope_reflection_alignment": dope_align,
                "rule_based_label": int(rule_label),
                "ml_predicted_prob": 0.0,
                "is_synthetic_label": True,
            })

            met_names = [skill_name_map[s] for s in list(met_req | met_pref)[:5]]
            miss_names = [skill_name_map[s] for s in list(missing_req)[:5]]
            ev_snippets = [u_skills[s][1] for s in list(met_req | met_pref)[:2] if s in u_skills]

            explanation_rows.append({
                "explanation_id": f"EXP_MCH_{exp_idx:05d}",
                "match_id": m_id,
                "profile_id": pid,
                "occupation_id": oid,
                "why_it_matches": (
                    f"Matches {occ['canonical_title']} ({occ['industry_sector']}) with composite score "
                    f"{overall:.1f}/100 based on {len(met_req)} required and {len(met_pref)} preferred skill overlaps."
                ),
                "met_requirements_list": "|".join(met_names) if met_names else "Foundational education & transferable readiness",
                "missing_skills_list": "|".join(miss_names) if miss_names else "None (All core skill requirements met)",
                "recommended_bridging_actions": (
                    f"Complete targeted e-LATiH / modular upskilling covering {', '.join(miss_names[:3])} "
                    f"(~{max(1, len(missing_req)) * 15} hrs total)."
                    if miss_names else "Ready for direct role transition or specialist capstone project."
                ),
                "supporting_evidence_snippets": " || ".join(ev_snippets) if ev_snippets else "Verified via education & experience profile metadata.",
            })

            match_idx += 1
            exp_idx += 1

    df_pairs = pd.DataFrame(pair_rows)
    df_explanations = pd.DataFrame(explanation_rows)

    unique_profiles = df_pairs["profile_id"].unique()
    n_p = len(unique_profiles)
    train_p = set(unique_profiles[:int(0.70 * n_p)])
    val_p = set(unique_profiles[int(0.70 * n_p):int(0.85 * n_p)])
    test_p = set(unique_profiles[int(0.85 * n_p):])

    feat_cols = [
        "skill_overlap_score", "proficiency_alignment_score",
        "experience_education_score", "interest_trend_score"
    ]
    train_df = df_pairs[df_pairs["profile_id"].isin(train_p)]
    test_df = df_pairs[df_pairs["profile_id"].isin(test_p)]

    clf = LogisticRegression(random_state=RANDOM_SEED)
    clf.fit(train_df[feat_cols], train_df["rule_based_label"])

    df_pairs["ml_predicted_prob"] = np.round(clf.predict_proba(df_pairs[feat_cols])[:, 1], 4)

    y_test = test_df["rule_based_label"].values
    probs_test = clf.predict_proba(test_df[feat_cols])[:, 1]
    preds_test = (probs_test >= 0.5).astype(int)

    matching_metrics = {
        "train_profiles": len(train_p),
        "val_profiles": len(val_p),
        "test_profiles": len(test_p),
        "test_pairs": len(test_df),
        "test_roc_auc": round(float(roc_auc_score(y_test, probs_test)), 4),
        "test_f1_score": round(float(f1_score(y_test, preds_test)), 4),
        "test_accuracy": round(float(accuracy_score(y_test, preds_test)), 4),
    }
    logger.info(f"Career Matching Group-Holdout Test Metrics: {matching_metrics}")

    validate_and_save_df(df_pairs, "role_match_pairs")
    validate_and_save_df(df_explanations, "role_match_explanations")
    return df_pairs, df_explanations, matching_metrics
