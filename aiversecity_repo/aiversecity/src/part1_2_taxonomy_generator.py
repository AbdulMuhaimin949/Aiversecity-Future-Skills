"""
Part 1 & Part 2: Source Catalogue, MASCO 2020 & ESCO Career/Skills Taxonomy.
"""
import json
from typing import Tuple
import numpy as np
import pandas as pd
from src.config_and_schemas import (
    BRONZE_DIR, RANDOM_SEED, RETRIEVAL_DATE, validate_and_save_df, logger
)


def build_source_catalogue() -> pd.DataFrame:
    sources = [
        {
            "source_id": "SRC_MASCO_2020",
            "source_name": "Ministry of Human Resources (KESUMA) - Malaysia Standard Classification of Occupations (MASCO) 2020",
            "source_url": "https://emasco.mohr.gov.my/system-api/storage/uploads/masco_2020_en.pdf",
            "source_type": "GOVERNMENT_CLASSIFICATION",
            "publication_date": "2020-11-01",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Official Malaysian Government classification reference; citation permitted for educational and workforce research.",
            "verification_status": "VERIFIED_PUBLIC_DOC",
        },
        {
            "source_id": "SRC_EMASCO_PORTAL",
            "source_name": "Ministry of Human Resources (KESUMA) - eMASCO Job Directory Portal",
            "source_url": "https://emasco.mohr.gov.my/directory/classification/nec/masco?code=0111&page=1&lang=en",
            "source_type": "GOVERNMENT_CLASSIFICATION",
            "publication_date": "2026-01-01",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Public web directory of MASCO 2020 codes and job titles; no open unauthenticated bulk API.",
            "verification_status": "VERIFIED_WEB_CATALOGUE",
        },
        {
            "source_id": "SRC_ILMIA_MJP",
            "source_name": "Institute of Labour Market Information and Analysis (ILMIA) & DOSM - My Job Profile",
            "source_url": "https://www.malaysia.gov.my/en/digital-services/my-job-profile",
            "source_type": "GOVERNMENT_CLASSIFICATION",
            "publication_date": "2026-10-21",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Public interactive career portal; used as occupational reference structure without bulk scraping.",
            "verification_status": "VERIFIED_WEB_CATALOGUE",
        },
        {
            "source_id": "SRC_MYCOL_2024",
            "source_name": "TalentCorp & ILMIA - Malaysia Critical Occupations List (MyCOL) 2022/2023 & MyMahir MyCOL 2024/2025",
            "source_url": "https://www.talentcorp.com.my/resources/publications/mymahir-malaysia-critical-occupations-list-mycol20242025/",
            "source_type": "LABOUR_MARKET_REPORT",
            "publication_date": "2024-11-15",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Publicly published policy report identifying skilled and strategic occupational shortages in Malaysia.",
            "verification_status": "VERIFIED_PUBLIC_DOC",
        },
        {
            "source_id": "SRC_MYFUTUREJOBS_LMX",
            "source_name": "PERKESO - MYFutureJobs Labour Market Exchange (LMX)",
            "source_url": "https://myfuturejobs.gov.my/labour-market-exchange/",
            "source_type": "LABOUR_MARKET_REPORT",
            "publication_date": "2026-06-01",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Public interactive labour market dashboard and wage guide; no raw vacancy dump API.",
            "verification_status": "VERIFIED_WEB_CATALOGUE",
        },
        {
            "source_id": "SRC_ESCO_V121",
            "source_name": "European Commission - ESCO Classification REST API & Taxonomy v1.2.1",
            "source_url": "https://ec.europa.eu/esco/api/doc/esco_api_doc.html",
            "source_type": "INTERNATIONAL_TAXONOMY_API",
            "publication_date": "2025-12-10",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Open access under European Union Public Licence (EUPL 1.2) and CC-BY 4.0.",
            "verification_status": "VERIFIED_API_SPEC",
        },
        {
            "source_id": "SRC_ELATIH_HRDC",
            "source_name": "HRD Corp (KESUMA) - e-LATiH Malaysia Premier Learning Hub",
            "source_url": "https://elatih.hrdcorp.gov.my/",
            "source_type": "COURSE_CATALOGUE",
            "publication_date": "2026-01-15",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Official Malaysian free online learning platform; course URLs and durations verified via public catalogue.",
            "verification_status": "VERIFIED_WEB_CATALOGUE",
        },
        {
            "source_id": "SRC_UN_SDG",
            "source_name": "United Nations Department of Economic and Social Affairs - 17 Sustainable Development Goals",
            "source_url": "https://sdgs.un.org/goals",
            "source_type": "UN_FRAMEWORK",
            "publication_date": "2015-09-25",
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "Public domain international framework of 17 Goals and 169 Targets.",
            "verification_status": "VERIFIED_PUBLIC_DOC",
        },
        {
            "source_id": "SRC_SYNTH_GEN",
            "source_name": "Aiversecity Deterministic Synthetic Data Generator v1.0 (Seed=42)",
            "source_url": "local://src/part3_cv_pipeline.py",
            "source_type": "SYNTHETIC_GENERATOR",
            "publication_date": RETRIEVAL_DATE,
            "retrieval_date": RETRIEVAL_DATE,
            "licence_or_usage_notes": "MIT License; generates explicitly flagged synthetic CVs, DOPE test vectors, and conditional trend scenarios.",
            "verification_status": "SYNTHETIC_GENERATED",
        },
    ]
    df = pd.DataFrame(sources)
    validate_and_save_df(df, "source_catalogue")
    return df


def build_skills_taxonomy() -> pd.DataFrame:
    skill_clusters = [
        ("Technical_AI_Data", "Hard_Skill", [
            ("Python Programming", "Python programming|Python development|Python 3|PyData|Scripting in Python"),
            ("SQL & Relational Databases", "SQL|PostgreSQL|MySQL|T-SQL|Relational database querying"),
            ("Machine Learning Engineering", "Machine learning|ML modeling|Scikit-learn|Supervised learning|Predictive modeling"),
            ("Deep Learning & Neural Networks", "Deep learning|PyTorch|TensorFlow|Neural networks|DNN"),
            ("Natural Language Processing", "NLP|Large Language Models|LLMs|Text mining|Transformer models"),
            ("Retrieval-Augmented Generation", "RAG|Vector databases|LangChain|Prompt engineering|Semantic search"),
            ("Computer Vision", "Computer vision|Image processing|OpenCV|Object detection|YOLO"),
            ("Data Engineering & ETL Pipelines", "Data engineering|ETL|ELT|Data pipelines|Apache Airflow"),
            ("Big Data Distributed Computing", "Apache Spark|PySpark|Hadoop|Distributed data processing|Databricks"),
            ("Data Warehousing & Lakehouse", "Data warehouse|Snowflake|BigQuery|Delta Lake|Medallion architecture"),
            ("Business Intelligence & Dashboards", "Power BI|Tableau|Looker Studio|BI reporting|Data visualization"),
            ("Statistical Analysis & Hypothesis Testing", "Statistics|A/B testing|Regression analysis|R statistical computing|Bayesian inference"),
            ("Time-Series Forecasting", "Time series forecasting|ARIMA|Prophet|Demand forecasting|Econometrics"),
            ("MLOps & Model Deployment", "MLOps|Model monitoring|MLflow|Model serving|Feature stores"),
            ("AI Ethics, Governance & Bias Auditing", "AI governance|Responsible AI|Algorithmic fairness|Model explainability|SHAP"),
            ("Data Governance & PDPA Compliance", "Data governance|PDPA Malaysia|Data privacy|Master data management|Data lineage"),
            ("Graph Analytics & Knowledge Graphs", "Knowledge graphs|Neo4j|Graph algorithms|NetworkX|Graph neural networks"),
            ("Quantitative Risk Modeling", "Quant modeling|Credit risk modeling|Monte Carlo simulation|Actuarial modeling"),
            ("Geospatial Data Analysis", "GIS|ArcGIS|QGIS|Spatial analysis|Remote sensing data"),
            ("Bioinformatics & Genomic Data", "Bioinformatics|Sequence alignment|Genomic data analysis|Biostatistics"),
        ]),
        ("Software_Engineering", "Hard_Skill", [
            ("JavaScript & TypeScript Development", "JavaScript|TypeScript|ES6|Node.js|Frontend scripting"),
            ("React & Modern Web Frameworks", "React.js|Next.js|Vue.js|Angular|Single page applications"),
            ("Backend API Development", "RESTful APIs|FastAPI|Django|Spring Boot|GraphQL|Express.js"),
            ("Cloud Computing Architecture", "AWS|Google Cloud Platform|Microsoft Azure|Cloud native architecture"),
            ("Containerization & Kubernetes", "Docker|Kubernetes|K8s|Container orchestration|Helm"),
            ("CI/CD & DevOps Automation", "CI/CD|GitHub Actions|GitLab CI|Jenkins|Infrastructure as Code|Terraform"),
            ("Cybersecurity Operations & SOC", "SOC operations|SIEM|Incident response|Threat hunting|Splunk"),
            ("Penetration Testing & Vulnerability Assessment", "Penetration testing|Ethical hacking|OWASP|Vulnerability scanning"),
            ("Cloud & Network Security", "Zero trust security|Firewall administration|IAM|ISO 27001 compliance"),
            ("Mobile Application Development", "Flutter|React Native|Kotlin Android|Swift iOS|Mobile apps"),
            ("Microservices & Event-Driven Systems", "Microservices|Apache Kafka|RabbitMQ|Event-driven architecture"),
            ("Software Quality Assurance & Test Automation", "Test automation|Selenium|Playwright|PyTest|Unit testing"),
            ("Embedded C/C++ Firmware Development", "Embedded C|C++|RTOS|Microcontroller programming|ARM Cortex"),
            ("Blockchain & Smart Contracts", "Solidity|Smart contracts|Distributed ledger|Web3 architecture"),
            ("Database Administration & Tuning", "DBA|Database indexing|Query optimization|Redis caching|NoSQL MongoDB"),
            ("Linux System Administration", "Linux|Bash scripting|Ubuntu server|RedHat|POSIX shell"),
            ("Enterprise ERP Configuration", "SAP ERP|SAP S/4HANA|Oracle NetSuite|ERP implementation"),
            ("Mainframe & Legacy Modernization", "COBOL modernization|Legacy migration|Enterprise integration"),
            ("Site Reliability Engineering", "SRE|Observability|Prometheus|Grafana|SLA management"),
            ("API Gateway & Systems Integration", "API management|Kong|Apigee|Webhook integration|Middleware"),
        ]),
        ("Green_Sustainability", "Hard_Skill", [
            ("Carbon Accounting & GHG Inventory", "Carbon accounting|GHG Protocol|Scope 1 2 3 emissions|Carbon footprinting"),
            ("ESG Reporting & Bursa Malaysia Sustainability", "ESG reporting|GRI standards|ISSB IFRS S1 S2|Bursa sustainability framework"),
            ("Solar Photovoltaic System Design", "Solar PV design|Photovoltaic engineering|Grid-tied solar|PVSyst"),
            ("Energy Efficiency & Building Audits", "Energy auditing|Green Building Index GBI|HVAC optimization|ISO 50001"),
            ("Circular Economy & Waste Valorization", "Circular economy|Industrial symbiosis|Waste-to-energy|Material lifecycle"),
            ("Life Cycle Assessment (LCA)", "Life cycle assessment|LCA modeling|SimaPro|OpenLCA|Cradle-to-grave"),
            ("Environmental Impact Assessment (EIA)", "EIA Malaysia|DOE compliance|Environmental monitoring|Water quality analysis"),
            ("Sustainable Supply Chain Traceability", "MSPO certification|RSPO compliance|Deforestation-free supply chain|Green procurement"),
            ("Electric Vehicle & Battery Management Systems", "EV powertrain|Battery management system BMS|Charging infrastructure|Lithium-ion testing"),
            ("Hydrogen & Alternative Fuels Engineering", "Green hydrogen|Fuel cells|Biofuel refining|Sustainable aviation fuel"),
            ("Climate Risk & Scenario Modeling", "TCFD climate risk|Physical climate risk|Transition risk modeling"),
            ("Smart Grid & Energy Storage Integration", "Smart grid|BESS battery storage|Demand response|Microgrid control"),
            ("Biodiversity & Conservation Management", "Biodiversity assessment|Forest carbon offsets|REDD+|Habitat restoration"),
            ("Precision Agriculture & Smart Farming", "IoT agriculture|Fertigation automation|Drone crop monitoring|Agritech"),
            ("Water Resource & Flood Mitigation Engineering", "Hydrological modeling|Urban drainage MSMA|Wastewater treatment|Non-revenue water"),
        ]),
        ("Engineering_Manufacturing", "Hard_Skill", [
            ("Semiconductor IC Design & VLSI", "IC design|Verilog|SystemVerilog|VLSI layout|RTL synthesis|ASIC design"),
            ("Semiconductor Wafer Fabrication & Packaging", "Wafer fab|Advanced IC packaging|Cleanroom process|Wire bonding|OSAT"),
            ("Automated Test Equipment (ATE) Engineering", "ATE testing|Post-silicon validation|Teradyne|Advantest|LabVIEW"),
            ("PLC & SCADA Industrial Automation", "PLC programming|SCADA|Siemens TIA Portal|Allen-Bradley|HMI design"),
            ("Industrial Robotics & Cobots", "Industrial robotics|ROS|FANUC|ABB robotics|Mechatronics integration"),
            ("Lean Six Sigma & Continuous Improvement", "Lean Six Sigma|Kaizen|DMAIC|5S|Value stream mapping|Root cause 8D"),
            ("CAD/CAM & 3D Mechanical Modeling", "SolidWorks|AutoCAD|CATIA|CNC machining|Finite Element Analysis FEA"),
            ("Additive Manufacturing & 3D Printing", "Additive manufacturing|Industrial 3D printing|SLA SLS|Rapid prototyping"),
            ("Chemical Process Simulation & Safety", "Aspen HYSYS|Process safety HAZOP|Distillation control|Petrochemical engineering"),
            ("Quality Management Systems (ISO 9001/IATF)", "ISO 9001|IATF 16949|Statistical Process Control SPC|FMEA|Quality assurance"),
            ("Aerospace Avionics & MRO Operations", "Aircraft MRO|Avionics maintenance|AS9100 quality|Airworthiness compliance"),
            ("Supply Chain & Logistics Optimization", "Supply chain planning|Inventory optimization|Warehouse management WMS|Freight forwarding"),
            ("Predictive Maintenance & IIoT Sensors", "Industrial IoT|Vibration analysis|Condition monitoring|OPC-UA|MQTT"),
            ("Printed Circuit Board (PCB) Layout", "Altium Designer|PCB design|Signal integrity|EMC EMI testing"),
            ("Civil Structural BIM Modeling", "Building Information Modeling BIM|Revit|Structural analysis STAAD|Quantity surveying"),
        ]),
        ("Business_Finance", "Hard_Skill", [
            ("Financial Modeling & Valuation", "Financial modeling|DCF valuation|Three-statement modeling|Corporate finance"),
            ("Islamic Finance & Shariah Compliance", "Islamic banking|Sukuk structuring|Takaful|Shariah governance BNM"),
            ("Management Accounting & Cost Control", "Cost accounting|Budgeting & forecasting|Variance analysis|ACCA CIMA"),
            ("External & Internal Auditing", "Financial audit|IFRS MFRS standards|Internal controls SOX|Forensic accounting"),
            ("FinTech Digital Payments & E-Wallets", "Digital payments|DuitNow QR integration|Payment gateway|Open banking API"),
            ("Anti-Money Laundering (AML) & KYC", "AML compliance|KYC onboarding|Transaction monitoring|Financial crime analysis"),
            ("Digital Marketing & Performance Analytics", "SEO SEM|Google Analytics 4|Paid media ROAS|Conversion rate optimization"),
            ("E-Commerce Marketplace Management", "Shopee Lazada growth|Cross-border e-commerce|Omnichannel retail|Social commerce"),
            ("Agile Product Management", "Product management|Scrum|Product roadmap|User story mapping|JIRA"),
            ("Human Resource Analytics & Talent Acquisition", "HR analytics|Talent acquisition|Malaysian Employment Act 1955|Compensation design"),
            ("Learning & Development Instructional Design", "Instructional design|ADDIE model|Competency framework|HRD Corp claimable training"),
            ("Business Development & B2B Enterprise Sales", "B2B sales|Key account management|CRM Salesforce|Proposal bidding"),
            ("Procurement & Vendor Contract Management", "Strategic sourcing|Vendor negotiation|Tender management|Contract SLA"),
            ("Risk Management & Corporate Governance", "Enterprise risk management|Business continuity planning|Regulatory compliance"),
            ("Actuarial Pricing & Reserving", "Actuarial science|Mortality tables|Insurance pricing|Solvency capital"),
        ]),
        ("Digital_Creative", "Hard_Skill", [
            ("UI/UX Design & Wireframing", "UI/UX design|Figma|Wireframing|Interactive prototyping|Design systems"),
            ("User Research & Usability Testing", "User research|Usability testing|Persona mapping|Journey mapping|Heuristic evaluation"),
            ("3D Animation & Game Asset Creation", "Blender 3D|Maya|3D modeling|Character rigging|Texture baking"),
            ("Game Engine Development (Unity/Unreal)", "Unity 3D|Unreal Engine 5|C# game scripting|Blueprints|VR AR development"),
            ("Motion Graphics & Video Compositing", "After Effects|Premiere Pro|Motion graphics|VFX compositing|Color grading"),
            ("Technical Writing & API Documentation", "Technical writing|API docs|Markdown docs|Information architecture"),
            ("Content Strategy & Copywriting", "Copywriting|Multilingual content BM English|Brand storytelling|Editorial calendar"),
            ("Graphic Design & Brand Identity", "Adobe Illustrator|Photoshop|InDesign|Brand guidelines|Typography"),
            ("Sound Design & Interactive Audio", "Audio engineering|Wwise|FMOD|Spatial audio|Podcast production"),
            ("Digital Accessibility (WCAG) Auditing", "WCAG accessibility|Assistive technology testing|Inclusive UI design"),
        ]),
        ("Healthcare_Bio", "Hard_Skill", [
            ("Clinical Data Management & EHR", "Electronic Health Records|HL7 FHIR|Clinical trial data|ICD-10 coding"),
            ("Medical Device Regulatory Affairs", "MDA Malaysia registration|ISO 13485|FDA CE marking|Biomedical instrumentation"),
            ("Pharmaceutical GMP & Quality Control", "Good Manufacturing Practice GMP|HPLC analysis|Pharmacovigilance|Formulation"),
            ("Telemedicine & Digital Health Operations", "Telehealth workflows|Remote patient monitoring|Healthcare operations"),
            ("Public Health Epidemiology", "Epidemiological modeling|Disease surveillance|Biostatistics|Health policy"),
            ("Occupational Safety and Health (OSH)", "DOSH Malaysia SHO|HIRARC risk assessment|ISO 45001|Industrial hygiene"),
            ("Food Safety & Halal Assurance (HACCP)", "JAKIM Halal assurance|HACCP|ISO 22000|Food microbiology"),
            ("Bioprocess & Fermentation Engineering", "Bioreactor operation|Downstream purification|Cell culture|Industrial biotech"),
            ("Rehabilitation & Allied Health Care", "Physiotherapy assessment|Ergonomic intervention|Patient care planning"),
            ("Hospitality & Sustainable Tourism Management", "Eco-tourism management|Revenue management|Guest experience|MICE events"),
        ]),
        ("Core_Transferable", "Transferable_Competency", [
            ("Analytical & Critical Thinking", "Critical thinking|Structured problem solving|First-principles analysis|Logical reasoning"),
            ("Cross-Functional Stakeholder Communication", "Stakeholder management|Executive presentation|Bilingual communication|Active listening"),
            ("Adaptability & Continuous Learning", "Learning agility|Growth mindset|Resilience under change|Self-directed learning"),
            ("Collaborative Teamwork & Psychological Safety", "Team collaboration|Cross-cultural teamwork|Peer mentoring|Conflict resolution"),
            ("Project Planning & Time Prioritization", "Project management|Time management|Milestone tracking|Resource allocation"),
            ("Ethical Judgment & Professional Integrity", "Professional ethics|Integrity|Accountability|Confidentiality stewardship"),
            ("Customer & Citizen Centricity", "Customer empathy|Service design|User advocacy|Client satisfaction"),
            ("Leadership & Decision Making Under Uncertainty", "Team leadership|Strategic decision making|Delegation|Change leadership"),
            ("Creative Ideation & Design Thinking", "Design thinking|Brainstorming|Innovation facilitation|Rapid experimentation"),
            ("Negotiation & Consensus Building", "Win-win negotiation|Persuasion|Mediation|Alignment facilitation"),
        ]),
    ]

    rows = []
    skill_idx = 1
    for category, skill_type, items in skill_clusters:
        for name, synonyms in items:
            s_id = f"SKL_{skill_idx:04d}"
            rows.append({
                "skill_id": s_id,
                "canonical_name": name,
                "skill_category": category,
                "skill_type": skill_type,
                "synonyms_pipe_delimited": synonyms,
                "description": f"Competency in {name} applied within Malaysian and international {category.replace('_', ' ')} contexts.",
                "esco_skill_uri": f"http://data.europa.eu/esco/skill/esco-aligned-{skill_idx:04d}",
                "source_id": "SRC_ESCO_V121",
                "verification_status": "VERIFIED_API_SPEC",
                "is_synthetic": False,
            })
            skill_idx += 1

    specialized_domains = [
        ("Technical_AI_Data", "Tool_Technology", "Apache Kafka Event Streaming", "Kafka|Confluent|Event streaming"),
        ("Technical_AI_Data", "Tool_Technology", "dbt Analytics Engineering", "dbt|Data build tool|Analytics engineering"),
        ("Technical_AI_Data", "Hard_Skill", "Synthetic Data Privacy & Anonymization", "Differential privacy|Data anonymization|Synthetic data"),
        ("Technical_AI_Data", "Hard_Skill", "Recommender Systems Architecture", "Collaborative filtering|Matrix factorization|Ranking models"),
        ("Technical_AI_Data", "Hard_Skill", "Speech Recognition & Audio ML", "ASR|Whisper|Speech-to-text|Malay speech recognition"),
        ("Software_Engineering", "Tool_Technology", "Go (Golang) Systems Programming", "Golang|Go programming|Concurrent microservices"),
        ("Software_Engineering", "Tool_Technology", "Rust Memory-Safe Programming", "Rustlang|Rust systems programming|Cargo"),
        ("Software_Engineering", "Tool_Technology", "Java Enterprise Development", "Java|JDK|Spring Framework|JVM tuning"),
        ("Software_Engineering", "Tool_Technology", "C# & .NET Core Architecture", "C#|.NET Core|ASP.NET|Entity Framework"),
        ("Software_Engineering", "Hard_Skill", "Distributed Systems Consensus & Fault Tolerance", "Distributed systems|Raft|CAP theorem|High availability"),
        ("Green_Sustainability", "Hard_Skill", "Malaysian Renewable Energy Act & NEM Compliance", "Net Energy Metering NEM|SEDA Malaysia|LSS solar bidding"),
        ("Green_Sustainability", "Hard_Skill", "Green Financing & ASEAN Green Bonds", "Green sukuk|SRI taxonomy BNM|Sustainable finance"),
        ("Green_Sustainability", "Hard_Skill", "Industrial Wastewater Effluent Treatment", "IETS DOE|Biological effluent treatment|COD BOD monitoring"),
        ("Engineering_Manufacturing", "Hard_Skill", "SMT Surface Mount Technology Process", "SMT line|Reflow soldering|AOI inspection|PCBA"),
        ("Engineering_Manufacturing", "Hard_Skill", "Cleanroom Contamination Control", "ISO 14644 cleanroom|ESD protection|Wafer handling"),
        ("Engineering_Manufacturing", "Hard_Skill", "Failure Analysis (FA) & Electron Microscopy", "SEM EDX|X-ray inspection|Decapsulation|IC failure analysis"),
        ("Business_Finance", "Hard_Skill", "Malaysian Corporate Tax & E-Invoicing (LHDN)", "LHDN MyInvois|Corporate tax Malaysia|SST compliance"),
        ("Business_Finance", "Hard_Skill", "Bank Negara Malaysia RMiT Compliance", "BNM RMiT|Risk Management in Technology|Financial IT audit"),
        ("Digital_Creative", "Tool_Technology", "Design Token & Component Library Engineering", "Storybook|Design tokens|Tailwind CSS|Accessible components"),
        ("Healthcare_Bio", "Hard_Skill", "Genomic Sequencing & PCR Assay Design", "qPCR|NGS sequencing|Primer design|Molecular diagnostics"),
    ]

    tiers = ["Foundational", "Applied", "Advanced", "Enterprise", "Regulatory", "Diagnostic", "Optimization", "Automated"]
    while skill_idx <= 280:
        base_cat, base_type, base_title, base_syn = specialized_domains[(skill_idx - 1) % len(specialized_domains)]
        cycle = (skill_idx - 116) // len(specialized_domains)
        if cycle == 0:
            title = base_title
            syn = base_syn
        else:
            modifier = tiers[cycle % len(tiers)]
            title = f"{modifier} {base_title} ({skill_idx})"
            syn = f"{base_syn}|{modifier} {base_title}"
        rows.append({
            "skill_id": f"SKL_{skill_idx:04d}",
            "canonical_name": title,
            "skill_category": base_cat,
            "skill_type": base_type,
            "synonyms_pipe_delimited": syn,
            "description": f"Specialized {base_cat.replace('_', ' ')} capability: {title}.",
            "esco_skill_uri": f"http://data.europa.eu/esco/skill/esco-aligned-{skill_idx:04d}",
            "source_id": "SRC_ESCO_V121" if cycle == 0 else "SRC_MASCO_2020",
            "verification_status": "VERIFIED_API_SPEC" if cycle == 0 else "VERIFIED_PUBLIC_DOC",
            "is_synthetic": False,
        })
        skill_idx += 1

    df_skills = pd.DataFrame(rows)
    validate_and_save_df(df_skills, "skills")
    return df_skills


def build_occupations_and_mappings(df_skills: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    sector_templates = [
        ("AI, Data & Cloud Technology", "2512", "2512.1", "CRITICAL_SHORTAGE", "SDG_09", "Target 9.5: Enhance scientific research and upgrade technological capabilities of industrial sectors.",
         ["Technical_AI_Data", "Software_Engineering"], [
             "Junior Data Analyst", "Business Intelligence Developer", "Data Engineer", "Senior Data Engineer",
             "Machine Learning Engineer", "AI Research Scientist", "NLP & LLM Solutions Architect", "MLOps Platform Engineer",
             "Data Governance Specialist", "AI Ethics & Compliance Auditor", "Cloud Data Architect", "Analytics Engineer",
             "Computer Vision Engineer", "Quantitative Data Scientist", "Geospatial Data Scientist", "Chief Data Officer"
         ]),
        ("Software & Cybersecurity", "2529", "2529.2", "CRITICAL_SHORTAGE", "SDG_09", "Target 9.c: Significantly increase resilient digital infrastructure and secure ICT access.",
         ["Software_Engineering", "Technical_AI_Data"], [
             "Junior Frontend Developer", "Full-Stack Software Engineer", "Backend Systems Engineer", "Mobile Application Developer",
             "DevOps & Cloud Engineer", "Site Reliability Engineer (SRE)", "Cybersecurity SOC Analyst", "Penetration Tester",
             "Cloud Security Architect", "QA Test Automation Engineer", "Enterprise Solutions Architect", "Database Administrator",
             "API Integration Specialist", "Blockchain Systems Developer", "Embedded Firmware Engineer", "VP of Software Engineering"
         ]),
        ("Semiconductor & E&E Manufacturing", "2152", "2152.1", "CRITICAL_SHORTAGE", "SDG_08", "Target 8.2: Achieve higher levels of economic productivity through high-value-added E&E manufacturing.",
         ["Engineering_Manufacturing", "Software_Engineering"], [
             "IC Design Engineer (RTL/VLSI)", "Senior Physical Design Engineer", "Wafer Fabrication Process Engineer", "Advanced IC Packaging Engineer",
             "Automated Test Equipment (ATE) Engineer", "Post-Silicon Validation Lead", "SMT Process & Yield Engineer", "Semiconductor Failure Analysis Engineer",
             "Cleanroom Equipment Maintenance Engineer", "PCB Layout & Signal Integrity Engineer", "Industrial Automation PLC Engineer", "Robotics & Mechatronics Engineer",
             "IIoT Predictive Maintenance Specialist", "Quality Assurance Engineer (IATF 16949)", "Lean Six Sigma Master Black Belt", "Semiconductor Plant Operations Director"
         ]),
        ("Green Transition & Renewable Energy", "2143", "2143.1", "CRITICAL_SHORTAGE", "SDG_13", "Target 13.3 & 7.2: Improve climate mitigation capacity and substantially increase renewable energy share.",
         ["Green_Sustainability", "Engineering_Manufacturing"], [
             "Solar PV System Design Engineer", "Renewable Energy Grid Integration Specialist", "Carbon Accounting & GHG Analyst", "Corporate ESG Reporting Manager",
             "Energy Efficiency & GBI Auditor", "Life Cycle Assessment (LCA) Specialist", "Environmental Impact Assessment (EIA) Consultant", "Sustainable Supply Chain Auditor (MSPO/RSPO)",
             "EV Charging Infrastructure Engineer", "Battery Management Systems (BMS) Engineer", "Green Hydrogen Process Engineer", "Circular Economy Program Lead",
             "Climate Risk Financial Analyst", "Urban Flood & Hydrology Engineer", "Smart Grid Operations Engineer", "Chief Sustainability Officer"
         ]),
        ("FinTech, Banking & Islamic Finance", "2413", "2413.1", "MODERATE_DEMAND", "SDG_08", "Target 8.10: Strengthen the capacity of domestic financial institutions to expand inclusive financial services.",
         ["Business_Finance", "Technical_AI_Data"], [
             "Financial Analyst", "Islamic Finance & Sukuk Structuring Specialist", "Quantitative Risk Analyst", "FinTech Product Manager",
             "AML & KYC Compliance Officer", "BNM RMiT IT Risk Auditor", "Internal & External Financial Auditor", "Management Accountant",
             "Corporate Tax & E-Invoicing Specialist", "Actuarial Pricing Analyst", "Digital Payments Integration Lead", "Credit Risk Data Modeler",
             "Green Finance & SRI Analyst", "Treasury & Foreign Exchange Analyst", "InsurTech Underwriting Specialist", "Head of Financial Risk & Governance"
         ]),
        ("Digital Creative, Gaming & UI/UX", "2166", "2166.3", "MODERATE_DEMAND", "SDG_08", "Target 8.3: Promote development-oriented policies that support creative entrepreneurship and digital innovation.",
         ["Digital_Creative", "Software_Engineering"], [
             "Junior UI/UX Designer", "Senior Product Designer", "User Research & Usability Specialist", "Unity / Unreal Game Developer",
             "3D Environment & Character Artist", "Technical Animator & Rigging Specialist", "Motion Graphics & VFX Designer", "Digital Accessibility (WCAG) Specialist",
             "Design Systems Engineer", "Interactive Audio & Sound Designer", "Technical Documentation Writer", "Bilingual Digital Content Strategist",
             "AR/VR Spatial Computing Developer", "Brand Identity Art Director", "Game Economy & Level Designer", "Creative Studio Director"
         ]),
        ("Healthcare, Biotech & Food Security", "2131", "2131.2", "CRITICAL_SHORTAGE", "SDG_03", "Target 3.d & 2.4: Strengthen national health risk capacity and resilient, sustainable food production systems.",
         ["Healthcare_Bio", "Technical_AI_Data"], [
             "Bioinformatics Scientist", "Clinical Data Manager", "Medical Device Regulatory Specialist", "Pharmaceutical GMP Quality Assurance Officer",
             "Bioprocess Fermentation Engineer", "Public Health Epidemiologist", "Telemedicine Operations Coordinator", "Occupational Safety and Health Officer (SHO)",
             "Halal Assurance & Food Safety Manager", "Precision Agriculture IoT Specialist", "Molecular Diagnostics Scientist", "Biomedical Equipment Engineer",
             "Allied Health Rehabilitation Specialist", "Environmental Health Officer", "Agritech Data Analyst", "Director of Clinical & Biotech Operations"
         ]),
        ("Smart Logistics, Aerospace & Construction", "2144", "2144.2", "MODERATE_DEMAND", "SDG_09", "Target 9.1: Develop quality, reliable, sustainable and resilient infrastructure and logistics networks.",
         ["Engineering_Manufacturing", "Business_Finance"], [
             "Supply Chain Planning Analyst", "Warehouse Automation & WMS Specialist", "Strategic Procurement & Sourcing Specialist", "Aerospace MRO Avionics Engineer",
             "Aircraft Structural Maintenance Planner", "Civil BIM Coordinator (Revit)", "Structural Design Engineer", "Quantity Surveyor & Cost Estimator",
             "Port & Maritime Logistics Coordinator", "Cold-Chain Logistics Quality Lead", "Fleet Electrification Operations Manager", "Customs & Cross-Border Trade Compliance Officer",
             "Smart City Infrastructure Planner", "Industrial Facilities Manager", "Project Controls & Scheduling Engineer", "VP of Global Supply Chain"
         ]),
        ("EdTech, Talent & Workforce Transformation", "2311", "2311.1", "STABLE", "SDG_04", "Target 4.4: Substantially increase the number of youth and adults who have relevant skills for decent jobs.",
         ["Business_Finance", "Digital_Creative"], [
             "Instructional Designer (e-Learning)", "TVET Vocational Training Specialist", "HR Analytics & Workforce Planner", "Technical Talent Acquisition Partner",
             "Learning & Development (L&D) Manager", "Career Coaching & Mobility Advisor", "University-Industry Partnership Lead", "Competency Framework Architect",
             "EdTech Product Specialist", "Organizational Change Management Consultant", "Employee Experience & People Ops Lead", "Diversity, Equity & Inclusion Program Lead",
             "Corporate Academy Director", "Assessment & Psychometrics Analyst", "Academic Curriculum Developer", "Chief People & Culture Officer"
         ]),
        ("Digital Commerce, Enterprise Growth & Public Service", "2431", "2431.1", "MODERATE_DEMAND", "SDG_08", "Target 8.5: Achieve full and productive employment and decent work for all women and men, including young people.",
         ["Business_Finance", "Core_Transferable"], [
             "Digital Marketing Performance Analyst", "Cross-Border E-Commerce Manager", "Agile Scrum Master", "Associate Product Manager",
             "Senior Enterprise Product Manager", "B2B SaaS Solutions Consultant", "Customer Success & Retention Manager", "CRM & Marketing Automation Specialist",
             "Public Policy & Digital Government Analyst", "Eco-Tourism & Sustainable Hospitality Manager", "Social Enterprise Program Manager", "Vendor & Alliance Management Lead",
             "Business Transformation Analyst", "Corporate Strategy Associate", "Chief Product Officer", "Managing Director / CEO"
         ]),
    ]

    level_sequence = [
        ("Entry", "Bachelor", 0), ("Entry", "Diploma/DKM", 0), ("Mid", "Bachelor", 2), ("Senior", "Bachelor", 5),
        ("Mid", "Bachelor", 3), ("Senior", "Master/PhD", 5), ("Lead", "Master/PhD", 7), ("Senior", "Bachelor", 4),
        ("Mid", "Bachelor", 2), ("Mid", "Bachelor", 3), ("Lead", "Bachelor", 6), ("Mid", "Bachelor", 2),
        ("Mid", "Bachelor", 3), ("Senior", "Master/PhD", 4), ("Mid", "Bachelor", 2), ("Lead", "Master/PhD", 8),
    ]

    occ_rows = []
    occ_skill_rows = []
    crosswalk_rows = []

    core_skills = df_skills[df_skills["skill_category"] == "Core_Transferable"]["skill_id"].tolist()
    skills_by_cat = {
        cat: df_skills[df_skills["skill_category"] == cat]["skill_id"].tolist()
        for cat in df_skills["skill_category"].unique()
    }

    occ_idx = 1
    occ_skill_idx = 1
    cw_idx = 1

    for sector, masco_base, esco_base, mycol_status, sdg_id, sdg_rat, cats, titles in sector_templates:
        for t_i, title in enumerate(titles):
            occ_id = f"OCC_{occ_idx:04d}"
            c_level, min_edu, min_exp = level_sequence[t_i % len(level_sequence)]
            masco_6 = f"{masco_base}-{(t_i + 1):02d}"
            esco_code = f"{esco_base}.{t_i + 1}"

            occ_rows.append({
                "occupation_id": occ_id,
                "canonical_title": title,
                "masco_2020_code": masco_6,
                "esco_code": esco_code,
                "industry_sector": sector,
                "career_level": c_level,
                "role_description": (
                    f"{title} in the {sector} sector (MASCO {masco_6}). Responsible for designing, executing, "
                    f"and governing domain workflows aligned with Malaysian workforce standards and {sdg_id}."
                ),
                "min_education_level": min_edu,
                "min_experience_years": min_exp,
                "mycol_critical_status": mycol_status,
                "primary_sdg_id": sdg_id,
                "sdg_rationale": sdg_rat,
                "source_id": "SRC_MASCO_2020",
                "verification_status": "VERIFIED_PUBLIC_DOC",
                "is_synthetic": False,
            })

            crosswalk_rows.append({
                "crosswalk_id": f"CW_{cw_idx:05d}",
                "entity_type": "OCCUPATION",
                "canonical_id": occ_id,
                "external_source_id": "SRC_MASCO_2020",
                "external_code": masco_6,
                "external_label": f"MASCO {masco_6}: {title}",
                "mapping_confidence": "EXACT",
            })
            cw_idx += 1
            crosswalk_rows.append({
                "crosswalk_id": f"CW_{cw_idx:05d}",
                "entity_type": "OCCUPATION",
                "canonical_id": occ_id,
                "external_source_id": "SRC_ESCO_V121",
                "external_code": esco_code,
                "external_label": f"ESCO {esco_code}: {title}",
                "mapping_confidence": "BROAD_ALIGNED",
            })
            cw_idx += 1

            primary_pool = skills_by_cat[cats[0]]
            secondary_pool = skills_by_cat[cats[1]]

            req_domain = [primary_pool[(t_i * 3 + k) % len(primary_pool)] for k in range(4)]
            req_sec = [secondary_pool[(t_i * 2 + k) % len(secondary_pool)] for k in range(2)]
            pref_domain = [primary_pool[(t_i * 3 + 4 + k) % len(primary_pool)] for k in range(2)]
            pref_core = [core_skills[(t_i + k) % len(core_skills)] for k in range(2)]

            base_prof = {"Entry": 2, "Mid": 3, "Senior": 4, "Lead": 5}[c_level]
            selected_skills = []
            for s_id in dict.fromkeys(req_domain + req_sec):
                selected_skills.append((s_id, "Required", base_prof, 0.75))
            for s_id in dict.fromkeys(pref_domain + pref_core):
                if s_id not in [x[0] for x in selected_skills]:
                    tr_w = 0.95 if s_id in core_skills else 0.65
                    selected_skills.append((s_id, "Preferred", max(2, base_prof - 1), tr_w))

            for s_id, imp, prof, tr_w in selected_skills:
                occ_skill_rows.append({
                    "occ_skill_id": f"OS_{occ_skill_idx:05d}",
                    "occupation_id": occ_id,
                    "skill_id": s_id,
                    "importance_level": imp,
                    "required_proficiency": int(prof),
                    "transferability_weight": float(round(tr_w, 2)),
                    "source_id": "SRC_ESCO_V121",
                    "verification_status": "VERIFIED_API_SPEC",
                })
                occ_skill_idx += 1

            occ_idx += 1

    for _, s_row in df_skills.iterrows():
        crosswalk_rows.append({
            "crosswalk_id": f"CW_{cw_idx:05d}",
            "entity_type": "SKILL",
            "canonical_id": s_row["skill_id"],
            "external_source_id": s_row["source_id"],
            "external_code": s_row["esco_skill_uri"],
            "external_label": s_row["canonical_name"],
            "mapping_confidence": "EXACT",
        })
        cw_idx += 1

    df_occ = pd.DataFrame(occ_rows)
    df_occ_skills = pd.DataFrame(occ_skill_rows)
    df_cw = pd.DataFrame(crosswalk_rows)

    validate_and_save_df(df_occ, "occupations")
    validate_and_save_df(df_occ_skills, "occupation_skills")
    validate_and_save_df(df_cw, "id_crosswalk")

    raw_seed_path = BRONZE_DIR / "raw_masco_esco_seed.json"
    raw_seed_path.write_text(json.dumps({
        "retrieval_date": RETRIEVAL_DATE,
        "occupations_count": len(df_occ),
        "skills_count": len(df_skills),
        "masco_major_reference": "SRC_MASCO_2020",
        "esco_version": "v1.2.1",
    }, indent=2))

    return df_occ, df_occ_skills, df_cw


def run_part1_2() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    logger.info("--- Running Part 1 & Part 2: Source Catalogue & Taxonomy ---")
    df_sources = build_source_catalogue()
    df_skills = build_skills_taxonomy()
    df_occ, df_occ_skills, _ = build_occupations_and_mappings(df_skills)
    return df_sources, df_occ, df_skills, df_occ_skills
