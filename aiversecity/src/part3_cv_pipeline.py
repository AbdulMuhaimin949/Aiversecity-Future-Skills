"""
Part 3: Synthetic CV Data Pipeline & Gold Evaluation Benchmark.
"""
import re
from typing import Dict, List, Tuple
import numpy as np
import pandas as pd
from src.config_and_schemas import RANDOM_SEED, validate_and_save_df, logger

MALAYSIAN_STATES = [
    "Selangor", "Kuala Lumpur", "Pulau Pinang", "Johor", "Melaka",
    "Perak", "Sarawak", "Sabah", "Negeri Sembilan", "Pahang",
    "Kedah", "Terengganu", "Kelantan", "Putrajaya"
]

FIELDS_OF_STUDY = [
    ("Computer Science & AI", ["Technical_AI_Data", "Software_Engineering"]),
    ("Software Engineering & Information Systems", ["Software_Engineering", "Digital_Creative"]),
    ("Electrical & Electronic Engineering", ["Engineering_Manufacturing", "Green_Sustainability"]),
    ("Mechanical & Mechatronics Engineering", ["Engineering_Manufacturing", "Green_Sustainability"]),
    ("Chemical & Environmental Engineering", ["Green_Sustainability", "Healthcare_Bio"]),
    ("Finance, Accounting & Islamic Banking", ["Business_Finance", "Technical_AI_Data"]),
    ("Business Administration & Digital Commerce", ["Business_Finance", "Core_Transferable"]),
    ("Digital Media, UI/UX & Game Design", ["Digital_Creative", "Software_Engineering"]),
    ("Biotechnology & Life Sciences", ["Healthcare_Bio", "Green_Sustainability"]),
]


def generate_synthetic_cvs_and_gold(
    df_occ: pd.DataFrame,
    df_skills: pd.DataFrame,
    n_profiles: int = 1000,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(RANDOM_SEED)

    skills_by_cat = {
        cat: df_skills[df_skills["skill_category"] == cat].to_dict("records")
        for cat in df_skills["skill_category"].unique()
    }
    core_skills = skills_by_cat["Core_Transferable"]
    occ_records = df_occ.to_dict("records")

    cv_rows = []
    exp_rows = []
    gold_eval_rows = []

    exp_idx = 1
    eval_idx = 1

    personas = [
        ("Student", 0.25, ["SPM/SKM", "Diploma/DKM", "Bachelor"], (0.0, 0.5)),
        ("Fresh_Graduate", 0.30, ["Diploma/DKM", "Bachelor"], (0.0, 1.5)),
        ("Career_Switcher", 0.20, ["Diploma/DKM", "Bachelor", "Master/PhD"], (2.0, 7.0)),
        ("Working_Adult", 0.25, ["Bachelor", "Master/PhD"], (3.0, 12.0)),
    ]
    persona_names = [p[0] for p in personas]
    persona_probs = [p[1] for p in personas]
    persona_map = {p[0]: p for p in personas}

    for i in range(1, n_profiles + 1):
        profile_id = f"CV_{i:04d}"
        persona = str(rng.choice(persona_names, p=persona_probs))
        _, _, edu_choices, exp_range = persona_map[persona]

        state = str(rng.choice(MALAYSIAN_STATES))
        edu_level = str(rng.choice(edu_choices))
        field_name, field_cats = FIELDS_OF_STUDY[i % len(FIELDS_OF_STUDY)]
        years_exp = round(float(rng.uniform(exp_range[0], exp_range[1])), 1)
        if persona == "Student":
            years_exp = 0.0

        anchor_occ = occ_records[(i * 7) % len(occ_records)]
        second_occ = occ_records[(i * 7 + 3) % len(occ_records)]
        interest_sectors = f"{anchor_occ['industry_sector']}|{second_occ['industry_sector']}"

        current_role_id = ""
        if persona in ("Career_Switcher", "Working_Adult"):
            current_role_id = anchor_occ["occupation_id"]

        weekly_hours = int(rng.choice([4, 6, 8, 10, 12, 15]))

        dom_pool = skills_by_cat[field_cats[0]] + skills_by_cat[field_cats[1]]
        n_dom = int(rng.integers(4, 7))
        chosen_dom = [dom_pool[(i * 5 + k * 3) % len(dom_pool)] for k in range(n_dom)]
        chosen_core = [core_skills[(i + k) % len(core_skills)] for k in range(2)]

        unique_chosen: Dict[str, dict] = {}
        for s in chosen_dom + chosen_core:
            unique_chosen[s["skill_id"]] = s

        text_sections = [
            f"CANDIDATE PROFILE: {profile_id} ({persona.replace('_', ' ')}, Location: {state}, Malaysia)",
            f"EDUCATION: {edu_level} in {field_name}." if i % 15 != 0 else f"EDUCATION: Completed {edu_level} qualification.",
            f"CAREER INTERESTS: Seeking opportunities in {interest_sectors.replace('|', ' and ')}.",
        ]

        skill_mentions_for_text = []
        for s_idx, (s_id, s_rec) in enumerate(unique_chosen.items()):
            synonyms = s_rec["synonyms_pipe_delimited"].split("|")
            chosen_surface = synonyms[(i + s_idx) % len(synonyms)]
            prof_word = ["basic familiarity with", "hands-on experience in", "proficient in", "advanced expertise in"][
                min(3, int(years_exp // 2) + (s_idx % 2))
            ]
            snippet_sentence = f"Demonstrated {prof_word} {chosen_surface} across applied deliverables."
            skill_mentions_for_text.append((s_id, chosen_surface, snippet_sentence))

            if i <= 150:
                gold_eval_rows.append({
                    "eval_id": f"EVAL_{eval_idx:05d}",
                    "profile_id": profile_id,
                    "ground_truth_skill_id": s_id,
                    "ground_truth_surface_span": chosen_surface,
                    "annotator_note": f"Gold annotation from synthetic template generation (synonym index {(i + s_idx) % len(synonyms)})",
                })
                eval_idx += 1

        n_exp = 2 if persona in ("Student", "Fresh_Graduate") else 3
        for e_k in range(n_exp):
            exp_type = (
                "Academic_Project" if (persona == "Student" and e_k == 0)
                else "Internship" if persona in ("Student", "Fresh_Graduate")
                else "Full_Time_Work"
            )
            org_type = "Malaysian Public University Lab" if exp_type == "Academic_Project" else "Malaysian SME / MNC Enterprise"
            dur_m = int(rng.integers(3, 8)) if exp_type != "Full_Time_Work" else int(rng.integers(12, 36))
            mention_subset = skill_mentions_for_text[e_k::n_exp]
            ev_desc = " ".join([m[2] for m in mention_subset])
            role_label = f"{field_name} {exp_type.replace('_', ' ')} Contributor"

            exp_rows.append({
                "experience_id": f"EXP_{exp_idx:05d}",
                "profile_id": profile_id,
                "experience_type": exp_type,
                "organization_type": org_type,
                "role_title": role_label,
                "duration_months": dur_m,
                "evidence_description": ev_desc,
                "is_synthetic": True,
            })
            exp_idx += 1
            text_sections.append(f"EXPERIENCE ({exp_type} - {dur_m} mos): {role_label}. {ev_desc}")

        raw_cv_text = "\n".join(text_sections)

        cv_rows.append({
            "profile_id": profile_id,
            "persona_segment": persona,
            "state_malaysia": state,
            "highest_education": edu_level,
            "field_of_study": field_name if i % 15 != 0 else "Unspecified",
            "years_experience": years_exp,
            "current_or_last_role_id": current_role_id if current_role_id else "NONE",
            "target_interest_sectors": interest_sectors,
            "max_weekly_learning_hours": weekly_hours,
            "raw_cv_text": raw_cv_text,
            "is_synthetic": True,
            "source_id": "SRC_SYNTH_GEN",
        })

    df_cvs = pd.DataFrame(cv_rows)
    df_exp = pd.DataFrame(exp_rows)
    df_gold = pd.DataFrame(gold_eval_rows)

    validate_and_save_df(df_cvs, "synthetic_cvs")
    validate_and_save_df(df_exp, "cv_experiences")
    validate_and_save_df(df_gold, "cv_skill_extraction_gold")

    return df_cvs, df_exp, df_gold


class ReproducibleCVSkillExtractor:
    def __init__(self, df_skills: pd.DataFrame):
        self.canonical_lookup: List[Tuple[str, str, str, re.Pattern]] = []
        for _, row in df_skills.iterrows():
            s_id = row["skill_id"]
            canon_name = row["canonical_name"]
            synonyms = [s.strip() for s in str(row["synonyms_pipe_delimited"]).split("|") if s.strip()]
            all_terms = list(dict.fromkeys([canon_name] + synonyms))
            for term in all_terms:
                method = "EXACT_CANONICAL" if term.lower() == canon_name.lower() else "SYNONYM_NORMALIZED"
                pattern = re.compile(r"\b" + re.escape(term) + r"\b", flags=re.IGNORECASE)
                self.canonical_lookup.append((s_id, term, method, pattern))

    @staticmethod
    def _estimate_proficiency(snippet: str, years_exp: float) -> Tuple[int, float]:
        low_s = snippet.lower()
        base_conf = 0.94
        if "advanced expertise in" in low_s:
            prof = 4 if years_exp < 5 else 5
            base_conf = 0.97
        elif "proficient in" in low_s:
            prof = 3 if years_exp < 4 else 4
            base_conf = 0.95
        elif "hands-on experience in" in low_s:
            prof = 2 if years_exp < 2 else 3
            base_conf = 0.92
        elif "basic familiarity with" in low_s:
            prof = 1 if years_exp < 1 else 2
            base_conf = 0.89
        else:
            prof = 2
            base_conf = 0.85
        return prof, base_conf

    def extract_all(self, df_cvs: pd.DataFrame) -> pd.DataFrame:
        extracted_rows = []
        ps_idx = 1

        for _, cv in df_cvs.iterrows():
            profile_id = cv["profile_id"]
            raw_text = str(cv["raw_cv_text"])
            years_exp = float(cv["years_experience"])

            seen_skills = set()
            for s_id, _, method, pattern in self.canonical_lookup:
                if s_id in seen_skills:
                    continue
                match = pattern.search(raw_text)
                if match:
                    seen_skills.add(s_id)
                    start = max(0, match.start() - 35)
                    end = min(len(raw_text), match.end() + 35)
                    snippet = raw_text[start:end].replace("\n", " ").strip()
                    prof, conf = self._estimate_proficiency(snippet, years_exp)
                    if method == "SYNONYM_NORMALIZED":
                        conf = round(conf - 0.03, 2)

                    extracted_rows.append({
                        "profile_skill_id": f"PS_{ps_idx:05d}",
                        "profile_id": profile_id,
                        "skill_id": s_id,
                        "extracted_surface_term": match.group(0),
                        "estimated_proficiency": int(prof),
                        "extraction_confidence": float(round(conf, 2)),
                        "evidence_snippet": snippet,
                        "extraction_method": method,
                    })
                    ps_idx += 1

        df_profile_skills = pd.DataFrame(extracted_rows)
        validate_and_save_df(df_profile_skills, "profile_skills")
        return df_profile_skills


def evaluate_cv_extraction_against_gold(
    df_profile_skills: pd.DataFrame,
    df_gold: pd.DataFrame,
) -> Dict[str, float]:
    eval_profiles = set(df_gold["profile_id"].unique())
    pred_sub = df_profile_skills[df_profile_skills["profile_id"].isin(eval_profiles)]

    gold_pairs = set(zip(df_gold["profile_id"], df_gold["ground_truth_skill_id"]))
    pred_pairs = set(zip(pred_sub["profile_id"], pred_sub["skill_id"]))

    tp = len(gold_pairs & pred_pairs)
    fp = len(pred_pairs - gold_pairs)
    fn = len(gold_pairs - pred_pairs)

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = (2 * precision * recall) / max(precision + recall, 1e-9)

    metrics = {
        "evaluated_profiles": len(eval_profiles),
        "gold_skill_mentions": len(gold_pairs),
        "predicted_skill_mentions": len(pred_pairs),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
    }
    logger.info(f"CV Extraction Evaluation on 150-Profile Holdout: {metrics}")
    return metrics


def run_part3(df_occ: pd.DataFrame, df_skills: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, float]]:
    logger.info("--- Running Part 3: Synthetic CV Pipeline & Extraction Evaluation ---")
    df_cvs, _, df_gold = generate_synthetic_cvs_and_gold(df_occ, df_skills, n_profiles=1000)
    extractor = ReproducibleCVSkillExtractor(df_skills)
    df_profile_skills = extractor.extract_all(df_cvs)
    eval_metrics = evaluate_cv_extraction_against_gold(df_profile_skills, df_gold)
    return df_cvs, df_profile_skills, eval_metrics
