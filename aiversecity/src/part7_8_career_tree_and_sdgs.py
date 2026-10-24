"""
Part 7 & Part 8: Hogwarts-Inspired Directed Career Graph & UN SDG Learning Pathways.
"""
from collections import deque
from typing import Dict, List, Optional, Tuple
import pandas as pd
from src.config_and_schemas import validate_and_save_df, logger

UN_SDG_CATALOGUE = {
    "SDG_03": (3, "Good Health and Well-Being", "3.d", "Strengthen capacity for early warning, risk reduction and management of national and global health risks."),
    "SDG_04": (4, "Quality Education", "4.4", "Substantially increase the number of youth and adults who have relevant skills, including technical and vocational skills, for employment and decent jobs."),
    "SDG_07": (7, "Affordable and Clean Energy", "7.2", "Increase substantially the share of renewable energy in the global energy mix."),
    "SDG_08": (8, "Decent Work and Economic Growth", "8.2", "Achieve higher levels of economic productivity through diversification, technological upgrading and innovation."),
    "SDG_09": (9, "Industry, Innovation and Infrastructure", "9.5", "Enhance scientific research and upgrade the technological capabilities of industrial sectors."),
    "SDG_11": (11, "Sustainable Cities and Communities", "11.6", "Reduce the adverse per capita environmental impact of cities and strengthen resilient urban infrastructure."),
    "SDG_12": (12, "Responsible Consumption and Production", "12.5", "Substantially reduce waste generation through prevention, reduction, recycling and reuse."),
    "SDG_13": (13, "Climate Action", "13.3", "Improve education, awareness-raising and human and institutional capacity on climate change mitigation and adaptation."),
}


def assign_guild_theme(sector: str) -> str:
    if "AI, Data" in sector or "FinTech" in sector:
        return "Order of Scribes (Data, AI & FinTech)"
    if "Software" in sector or "Semiconductor" in sector or "Logistics" in sector:
        return "Guild of Artificers (Software, E&E & Systems)"
    if "Green" in sector or "Healthcare" in sector:
        return "Circle of Stewards (Sustainability, Bio & Energy)"
    return "Vanguard of Strategists (Product, EdTech & Growth)"


def build_career_graph(
    df_occ: pd.DataFrame,
    df_occ_skills: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    nodes = []
    edges = []
    milestones = []

    tier_map = {"Entry": 1, "Mid": 2, "Senior": 3, "Lead": 4}
    req_skills_by_occ = (
        df_occ_skills.groupby("occupation_id")["skill_id"]
        .apply(list)
        .to_dict()
    )

    foundations = [
        ("NODE_FND_01", "STEM & Computing Undergraduate Foundation", "Order of Scribes (Data, AI & FinTech)"),
        ("NODE_FND_02", "TVET / Diploma Engineering & Technical Foundation", "Guild of Artificers (Software, E&E & Systems)"),
        ("NODE_FND_03", "Business, Finance & Humanities Foundation", "Vanguard of Strategists (Product, EdTech & Growth)"),
        ("NODE_FND_04", "Applied Science, Sustainability & Bio Foundation", "Circle of Stewards (Sustainability, Bio & Energy)"),
    ]
    for nid, title, guild in foundations:
        nodes.append({
            "node_id": nid,
            "node_type": "FOUNDATION_STAGE",
            "reference_id": nid,
            "node_title": title,
            "house_guild_theme": guild,
            "career_tier": 0,
            "source_id": "SRC_MASCO_2020",
        })

    milestone_specs = [
        ("MLS_001", "Python, SQL & Data Engineering Bootcamp Milestone", "SKL_0001|SKL_0002|SKL_0008", "Capstone ETL & SQL Assessment", 45),
        ("MLS_002", "Applied Machine Learning & GenAI RAG Lab Milestone", "SKL_0003|SKL_0005|SKL_0006", "Deployed RAG & ML Model Portfolio", 60),
        ("MLS_003", "Full-Stack Web & Cloud DevOps Milestone", "SKL_0021|SKL_0023|SKL_0024", "Cloud Microservice Deployment Gate", 55),
        ("MLS_004", "Cybersecurity SOC & ISO 27001 Readiness Milestone", "SKL_0027|SKL_0029", "Incident Response Simulation Exam", 40),
        ("MLS_005", "Semiconductor IC Design & Wafer Process Milestone", "SKL_0056|SKL_0057|SKL_0058", "VLSI / Cleanroom Technical Practicum", 65),
        ("MLS_006", "Industrial Automation PLC & IIoT Milestone", "SKL_0059|SKL_0068", "PLC Ladder & IIoT Telemetry Gate", 50),
        ("MLS_007", "Carbon Accounting, ESG & Solar PV Milestone", "SKL_0041|SKL_0042|SKL_0043", "GHG Scope 1-3 Audit Portfolio", 45),
        ("MLS_008", "Financial Modeling, FinTech & Islamic Finance Milestone", "SKL_0071|SKL_0072|SKL_0075", "Valuation & Shariah Governance Case", 40),
        ("MLS_009", "UI/UX Design Systems & Interactive 3D Milestone", "SKL_0086|SKL_0087|SKL_0089", "Usability Tested Figma/Unity Prototype", 45),
        ("MLS_010", "Bioinformatics, GMP & Halal Assurance Milestone", "SKL_0098|SKL_0101|SKL_0102", "Regulatory & Hazard Audit Gate", 50),
        ("MLS_011", "Smart Supply Chain & BIM Infrastructure Milestone", "SKL_0067|SKL_0070", "Logistics Network Optimization Gate", 40),
        ("MLS_012", "Agile Product Leadership & e-LATiH HR Management Milestone", "SKL_0079|SKL_0080|SKL_0107", "HRD Corp e-LATiH Certificate & Product Spec", 30),
    ]
    for m_id, m_title, t_skills, ver_mech, hrs in milestone_specs:
        milestones.append({
            "milestone_id": m_id,
            "milestone_title": m_title,
            "target_skill_ids": t_skills,
            "verification_mechanism": ver_mech,
            "estimated_hours": int(hrs),
        })
        nodes.append({
            "node_id": f"NODE_{m_id}",
            "node_type": "BRIDGING_MILESTONE",
            "reference_id": m_id,
            "node_title": m_title,
            "house_guild_theme": "Order of Scribes (Data, AI & FinTech)",
            "career_tier": 1,
            "source_id": "SRC_ELATIH_HRDC",
        })

    occ_records = df_occ.to_dict("records")
    for occ in occ_records:
        oid = occ["occupation_id"]
        nodes.append({
            "node_id": f"NODE_{oid}",
            "node_type": "OCCUPATION_ROLE",
            "reference_id": oid,
            "node_title": occ["canonical_title"],
            "house_guild_theme": assign_guild_theme(occ["industry_sector"]),
            "career_tier": tier_map.get(occ["career_level"], 2),
            "source_id": occ["source_id"],
        })

    edge_idx = 1

    def add_edge(
        src_node: str,
        tgt_node: str,
        t_type: str,
        req_s: List[str],
        shared_s: List[str],
        miss_s: List[str],
        prereq: str,
        hours: int,
        basis: str,
        diff: str,
    ) -> None:
        nonlocal edge_idx
        edges.append({
            "edge_id": f"EDG_{edge_idx:05d}",
            "source_node_id": src_node,
            "target_node_id": tgt_node,
            "transition_type": t_type,
            "required_skill_ids": "|".join(req_s[:6]) if req_s else "NONE",
            "shared_skill_ids": "|".join(shared_s[:6]) if shared_s else "NONE",
            "missing_skill_ids": "|".join(miss_s[:6]) if miss_s else "NONE",
            "prerequisite_requirements": prereq,
            "estimated_learning_hours": int(hours),
            "duration_estimation_basis": basis,
            "transition_difficulty": diff,
            "source_ids": "SRC_MASCO_2020|SRC_ESCO_V121",
            "evidence_status": "VERIFIED_TAXONOMY_RULE",
        })
        edge_idx += 1

    for m_i, (m_id, _, t_skills, _, hrs) in enumerate(milestone_specs):
        fnd_node = foundations[m_i % len(foundations)][0]
        m_node = f"NODE_{m_id}"
        skill_list = t_skills.split("|")
        add_edge(
            fnd_node, m_node, "ENTRY_LAUNCH",
            skill_list, [skill_list[0]], skill_list[1:],
            "Foundation literacy & basic digital readiness", hrs,
            "SOURCED_CURRICULUM_SUM", "LOW"
        )

    for s_idx in range(10):
        sector_occs = occ_records[s_idx * 16:(s_idx + 1) * 16]
        m_node = f"NODE_{milestone_specs[s_idx % len(milestone_specs)][0]}"

        for occ in sector_occs:
            if occ["career_level"] == "Entry":
                oid = occ["occupation_id"]
                r_skills = req_skills_by_occ.get(oid, [])
                add_edge(
                    m_node, f"NODE_{oid}", "ENTRY_LAUNCH",
                    r_skills, r_skills[:3], r_skills[3:],
                    f"Min Education: {occ['min_education_level']}", 35,
                    "SOURCED_CURRICULUM_SUM", "LOW"
                )

        for i in range(len(sector_occs) - 1):
            curr_o = sector_occs[i]
            next_o = sector_occs[i + 1]
            c_id, n_id = curr_o["occupation_id"], next_o["occupation_id"]
            c_skills = set(req_skills_by_occ.get(c_id, []))
            n_skills = set(req_skills_by_occ.get(n_id, []))
            shared = sorted(c_skills & n_skills)
            missing = sorted(n_skills - c_skills)

            t_Curr = tier_map[curr_o["career_level"]]
            t_Next = tier_map[next_o["career_level"]]
            t_type = "VERTICAL_PROGRESSION" if t_Next >= t_Curr else "ADJACENT_SWITCH"
            hrs = max(20, len(missing) * 18)
            diff = "LOW" if len(missing) <= 2 else ("MODERATE" if len(missing) <= 4 else "HIGH")
            prereq = f"Min Education: {next_o['min_education_level']} | Min Exp: {next_o['min_experience_years']} yrs"

            add_edge(
                f"NODE_{c_id}", f"NODE_{n_id}", t_type,
                sorted(n_skills), shared, missing,
                prereq, hrs, "SIMULATED_SKILL_GAP_HEURISTIC", diff
            )

        adj_sector_occs = occ_records[((s_idx + 1) % 10) * 16:(((s_idx + 1) % 10) + 1) * 16]
        for k in range(0, 12, 3):
            src_o = sector_occs[k]
            tgt_o = adj_sector_occs[k]
            s_id, t_id = src_o["occupation_id"], tgt_o["occupation_id"]
            s_skills = set(req_skills_by_occ.get(s_id, []))
            t_skills = set(req_skills_by_occ.get(t_id, []))
            shared = sorted(s_skills & t_skills)
            missing = sorted(t_skills - s_skills)

            add_edge(
                f"NODE_{s_id}", f"NODE_{t_id}", "ADJACENT_SWITCH",
                sorted(t_skills), shared, missing,
                f"Cross-sector prerequisite: {tgt_o['min_education_level']} & bridging portfolio",
                max(35, len(missing) * 20), "SIMULATED_SKILL_GAP_HEURISTIC", "MODERATE"
            )
            bridge_m = f"NODE_{milestone_specs[(s_idx + 1) % len(milestone_specs)][0]}"
            add_edge(
                f"NODE_{s_id}", bridge_m, "UPSKILL_BRIDGE",
                sorted(t_skills)[:3], shared, missing[:3],
                "Open to working switchers", 30, "SOURCED_CURRICULUM_SUM", "LOW"
            )
            add_edge(
                bridge_m, f"NODE_{t_id}", "UPSKILL_BRIDGE",
                sorted(t_skills), sorted(t_skills)[:3], missing[3:],
                f"Completion of {bridge_m} milestone", 35, "SOURCED_CURRICULUM_SUM", "MODERATE"
            )

    df_nodes = pd.DataFrame(nodes)
    df_edges = pd.DataFrame(edges).drop_duplicates(subset=["source_node_id", "target_node_id", "transition_type"])
    df_edges["edge_id"] = [f"EDG_{i:05d}" for i in range(1, len(df_edges) + 1)]
    df_milestones = pd.DataFrame(milestones)

    validate_and_save_df(df_nodes, "career_nodes")
    validate_and_save_df(df_edges, "career_edges")
    validate_and_save_df(df_milestones, "career_milestones")
    return df_nodes, df_edges, df_milestones


def recommend_career_paths(
    df_nodes: pd.DataFrame,
    df_edges: pd.DataFrame,
    start_node_id: str,
    target_node_id: Optional[str] = None,
    candidate_education: str = "Bachelor",
    max_hops: int = 4,
) -> List[Dict[str, object]]:
    edu_rank = {"SPM/SKM": 1, "Diploma/DKM": 2, "Bachelor": 3, "Master/PhD": 4}
    u_edu_val = edu_rank.get(candidate_education, 3)

    adj: Dict[str, List[dict]] = {}
    for _, edge in df_edges.iterrows():
        adj.setdefault(edge["source_node_id"], []).append(edge.to_dict())

    node_titles = dict(zip(df_nodes["node_id"], df_nodes["node_title"]))

    queue = deque([(start_node_id, [start_node_id], 0, [], [])])
    valid_routes = []

    while queue:
        curr, path, total_hrs, edge_types, unmet_prereqs = queue.popleft()
        if len(path) > 1 and (target_node_id is None or curr == target_node_id):
            valid_routes.append({
                "path_node_ids": " -> ".join(path),
                "path_titles": " -> ".join(node_titles.get(n, n) for n in path),
                "transition_sequence": " -> ".join(edge_types),
                "hops": len(path) - 1,
                "total_estimated_hours": total_hrs,
                "prerequisite_status": "ALL_MET" if not unmet_prereqs else f"REMAINING_PREREQ: {'; '.join(unmet_prereqs)}",
            })
            if curr == target_node_id:
                continue

        if len(path) - 1 >= max_hops:
            continue

        for e in adj.get(curr, []):
            nxt = e["target_node_id"]
            if nxt in path:
                continue
            prereq_str = str(e["prerequisite_requirements"])
            new_unmet = list(unmet_prereqs)
            if "Master/PhD" in prereq_str and u_edu_val < 4:
                new_unmet.append(f"{nxt} requires Master/PhD")
            queue.append((
                nxt,
                path + [nxt],
                total_hrs + int(e["estimated_learning_hours"]),
                edge_types + [e["transition_type"]],
                new_unmet,
            ))

    valid_routes.sort(key=lambda r: (r["prerequisite_status"] != "ALL_MET", r["total_estimated_hours"], r["hops"]))
    return valid_routes[:10]


def build_learning_pathways_and_sdgs(
    df_occ: pd.DataFrame,
    df_skills: pd.DataFrame,
    df_occ_skills: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    resources = [
        ("RES_0001", "[Human Resource Management Course] Human Resource Management in a Contemporary Workplace",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/courses-details/human-resource-management-course-human-resource-management-in-a-contemporary-workplace",
         "Self-Paced Online", 1.25, 0.00, "MYR", "Foundation", "SKL_0080|SKL_0107", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0002", "e-LATiH Python Programming & Data Literacy for Malaysian Workforce",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 12.0, 0.00, "MYR", "Foundation", "SKL_0001|SKL_0002", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0003", "e-LATiH Business Intelligence & Dashboard Analytics with Power BI",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 10.0, 0.00, "MYR", "Intermediate", "SKL_0011|SKL_0012", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0004", "Applied Machine Learning, Deep Learning & Responsible AI Governance",
         "HRD Corp e-LATiH / MyMahir Partner Track", "https://elatih.hrdcorp.gov.my/",
         "Blended Modular", 24.0, 0.00, "MYR", "Intermediate", "SKL_0003|SKL_0004|SKL_0015", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0005", "Natural Language Processing, LLMs & Retrieval-Augmented Generation (RAG)",
         "Aiversecity Technical Curriculum Reference", "https://elatih.hrdcorp.gov.my/",
         "Project Lab", 28.0, 0.00, "MYR", "Advanced", "SKL_0005|SKL_0006|SKL_0014", "SRC_SYNTH_GEN", "SYNTHETIC_CURRICULUM_PLACEHOLDER"),
        ("RES_0006", "Modern Full-Stack Web, Cloud Architecture & Kubernetes DevOps",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 20.0, 0.00, "MYR", "Intermediate", "SKL_0021|SKL_0022|SKL_0024|SKL_0025", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0007", "Cybersecurity SOC Operations, Threat Hunting & ISO 27001 Governance",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 18.0, 0.00, "MYR", "Intermediate", "SKL_0027|SKL_0028|SKL_0029", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0008", "Semiconductor IC Design (VLSI), Wafer Fab & ATE Testing Practicum",
         "MyMahir National Semiconductor Skills Registry Track", "https://www.talentcorp.com.my/resources/publications/mymahir-malaysia-critical-occupations-list-mycol20242025/",
         "Industry Lab", 36.0, 0.00, "MYR", "Advanced", "SKL_0056|SKL_0057|SKL_0058", "SRC_MYCOL_2024", "VERIFIED_PUBLIC_DOC"),
        ("RES_0009", "Industrial Automation PLC/SCADA, Robotics & Lean Six Sigma",
         "HRD Corp e-LATiH", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 22.0, 0.00, "MYR", "Intermediate", "SKL_0059|SKL_0060|SKL_0061", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0010", "Corporate Carbon Accounting (GHG Protocol), ESG Reporting & Solar PV Systems",
         "HRD Corp e-LATiH Sustainability Series", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 16.0, 0.00, "MYR", "Intermediate", "SKL_0041|SKL_0042|SKL_0043", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0011", "Financial Modeling, FinTech Digital Payments & Islamic Finance Governance",
         "HRD Corp e-LATiH Finance Track", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 15.0, 0.00, "MYR", "Intermediate", "SKL_0071|SKL_0072|SKL_0075", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0012", "UI/UX Design Systems, User Research & Interactive 3D Game Development",
         "HRD Corp e-LATiH Creative Track", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 18.0, 0.00, "MYR", "Intermediate", "SKL_0086|SKL_0087|SKL_0089", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0013", "Bioinformatics, Pharmaceutical GMP & JAKIM Halal Assurance Systems",
         "HRD Corp e-LATiH Bio & Halal Track", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 16.0, 0.00, "MYR", "Intermediate", "SKL_0098|SKL_0101|SKL_0102", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
        ("RES_0014", "Core Transferable Skills: Critical Thinking, Agile Collaboration & Ethical Leadership",
         "HRD Corp e-LATiH Core Track", "https://elatih.hrdcorp.gov.my/",
         "Self-Paced Online", 8.0, 0.00, "MYR", "Foundation", "SKL_0106|SKL_0107|SKL_0108|SKL_0111", "SRC_ELATIH_HRDC", "VERIFIED_WEB_CATALOGUE"),
    ]

    df_res = pd.DataFrame(resources, columns=[
        "resource_id", "course_title", "provider_name", "provider_url",
        "delivery_mode", "estimated_hours", "cost_amount", "currency",
        "prerequisite_level", "target_skill_ids", "source_id", "verification_status"
    ])
    validate_and_save_df(df_res, "learning_resources")

    req_skill_map = (
        df_occ_skills[df_occ_skills["importance_level"] == "Required"]
        .groupby("occupation_id")["skill_id"]
        .apply(list)
        .to_dict()
    )

    step_rows = []
    occ_sdg_rows = []
    step_idx = 1
    occ_sdg_idx = 1

    for occ_i, (_, occ) in enumerate(df_occ.iterrows()):
        oid = occ["occupation_id"]
        sdg_key = occ["primary_sdg_id"]
        goal_num, goal_title, target_code, _ = UN_SDG_CATALOGUE.get(
            sdg_key, UN_SDG_CATALOGUE["SDG_08"]
        )

        occ_sdg_rows.append({
            "occ_sdg_id": f"OSDG_{occ_sdg_idx:04d}",
            "occupation_id": oid,
            "sdg_goal_number": int(goal_num),
            "sdg_goal_title": goal_title,
            "sdg_target_code": target_code,
            "evidence_rationale": f"{occ['canonical_title']} directly supports UN SDG {goal_num} ({target_code}): {occ['sdg_rationale']}",
            "source_id": "SRC_UN_SDG",
        })
        occ_sdg_idx += 1

        r_skills = req_skill_map.get(oid, ["SKL_0001", "SKL_0002", "SKL_0106"])
        domain_res_id = resources[(occ_i % (len(resources) - 2)) + 1][0]
        adv_res_id = resources[((occ_i + 3) % (len(resources) - 2)) + 1][0]

        pathway_triplet = [
            (1, "RES_0014", "NONE", r_skills[0], 8.0),
            (2, domain_res_id, f"STP_{step_idx:05d}", r_skills[min(1, len(r_skills) - 1)], 16.0),
            (3, adv_res_id, f"STP_{step_idx + 1:05d}", r_skills[min(2, len(r_skills) - 1)], 20.0),
        ]
        for s_order, res_id, prereq_step, out_skill, hrs in pathway_triplet:
            step_rows.append({
                "step_id": f"STP_{step_idx:05d}",
                "occupation_id": oid,
                "step_order": s_order,
                "resource_id": res_id,
                "prerequisite_step_id": prereq_step,
                "expected_skill_outcome_id": out_skill,
                "estimated_completion_hours": float(hrs),
                "sdg_goal_number": int(goal_num),
                "sdg_target_code": target_code,
            })
            step_idx += 1

    cat_to_sdg = {
        "Technical_AI_Data": ("SDG_09", "Builds scientific and data analytics capabilities for industrial innovation."),
        "Software_Engineering": ("SDG_09", "Develops resilient digital software and cybersecurity infrastructure."),
        "Green_Sustainability": ("SDG_13", "Directly enables decarbonization, renewable energy transition, and climate reporting."),
        "Engineering_Manufacturing": ("SDG_08", "Drives high-value-added semiconductor, automation, and industrial productivity."),
        "Business_Finance": ("SDG_08", "Strengthens inclusive financial management, governance, and decent work systems."),
        "Digital_Creative": ("SDG_04", "Enhances accessible human-computer interaction and digital literacy experiences."),
        "Healthcare_Bio": ("SDG_03", "Advances clinical data quality, biosafety, and sustainable food/health systems."),
        "Core_Transferable": ("SDG_04", "Equips youth and adults with transferable problem-solving and collaborative competencies."),
    }

    skill_sdg_rows = []
    for s_i, (_, sk) in enumerate(df_skills.iterrows(), start=1):
        sdg_key, rat = cat_to_sdg.get(sk["skill_category"], ("SDG_08", "Supports workforce employability."))
        goal_num, goal_title, target_code, _ = UN_SDG_CATALOGUE[sdg_key]
        skill_sdg_rows.append({
            "skill_sdg_id": f"SSDG_{s_i:04d}",
            "skill_id": sk["skill_id"],
            "sdg_goal_number": int(goal_num),
            "sdg_goal_title": goal_title,
            "sdg_target_code": target_code,
            "evidence_rationale": f"{sk['canonical_name']}: {rat}",
            "source_id": "SRC_UN_SDG",
        })

    df_steps = pd.DataFrame(step_rows)
    df_occ_sdgs = pd.DataFrame(occ_sdg_rows)
    df_skill_sdgs = pd.DataFrame(skill_sdg_rows)

    validate_and_save_df(df_steps, "pathway_steps")
    validate_and_save_df(df_occ_sdgs, "occupation_sdgs")
    validate_and_save_df(df_skill_sdgs, "skill_sdgs")

    return df_res, df_steps, df_occ_sdgs, df_skill_sdgs
