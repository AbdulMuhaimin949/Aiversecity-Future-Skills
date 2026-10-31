"""
World-industry extension of the taxonomy.

The original taxonomy was weighted towards technology sectors. This module adds
the industries where most of the world's workforce is employed (hospitality,
retail, agriculture, clinical care, skilled trades, teaching, transport,
energy and resources, legal and public service, arts and media), so that a CV
from any industry can be matched to roles and skill gaps.

Occupation titles and minimum education levels follow MASCO 2020 / ISCO-08
unit groups (the MASCO code below is the 4-digit unit group the sector is
anchored on). Role-to-skill assignments are hand-curated, not index-cycled,
so a Staff Nurse requires nursing skills and a Welder requires welding skills.
Demand status is never claimed as a MyCOL critical shortage for these sectors
because they were not cross-checked against the MyCOL list.
"""
from typing import Dict, List, Tuple

# (category, skill_type, [(code, canonical_name, synonyms_pipe_delimited)])
WORLD_SKILL_CLUSTERS: List[Tuple[str, str, List[Tuple[str, str, str]]]] = [
    ("Hospitality_Tourism", "Hard_Skill", [
        ("H1", "Front Office & Guest Relations", "Front desk|Hotel reception|Guest check-in|Concierge|Guest relations|Front office"),
        ("H2", "Food & Beverage Service", "F&B service|Waiter|Waitress|Banquet service|Table service|Restaurant service"),
        ("H3", "Culinary Arts & Kitchen Operations", "Cooking|Chef|Commis|Kitchen operations|Menu planning|Culinary arts|Pastry|Tukang masak"),
        ("H4", "Food Handling & Kitchen Hygiene", "Food handling|Food hygiene|Food handler|Kitchen sanitation|Food handler certificate"),
        ("H5", "Housekeeping & Room Operations", "Housekeeping|Room attendant|Laundry operations|Cleaning supervision"),
        ("H6", "Tour Guiding & Destination Knowledge", "Tour guide|Tourist guide|Licensed tourist guide|Itinerary planning|Destination knowledge"),
        ("H7", "Travel Booking & Reservation Systems", "Travel agent|Air ticketing|Amadeus|Reservation systems|Booking management|Opera PMS"),
        ("H8", "Event & Banquet Coordination", "Event planning|Wedding planning|Banquet coordination|Event management|Conference coordination"),
        ("H9", "Hotel Rooms Division Management", "Rooms division|Occupancy management|Hotel operations|Hotel management"),
        ("H10", "Multilingual Guest Communication", "Mandarin|Arabic|Japanese language|Korean language|Foreign language|Multilingual"),
        ("H11", "Barista & Beverage Preparation", "Barista|Coffee making|Latte art|Bartending|Mixology"),
        ("H12", "Spa, Beauty & Wellness Services", "Spa therapist|Massage therapy|Beauty therapy|Wellness services|Hairdressing|Beautician"),
    ]),
    ("Retail_Customer_Service", "Hard_Skill", [
        ("R1", "Retail Sales & Product Knowledge", "Retail sales|Sales assistant|Shop assistant|Product knowledge|Upselling|Cross-selling"),
        ("R2", "Cashiering & POS Operations", "Cashier|POS system|Point of sale|Cash handling|Payment counter"),
        ("R3", "Visual Merchandising & Store Display", "Visual merchandising|Store display|Planogram|Shelf arrangement|Window display"),
        ("R4", "Stock Control & Inventory Counting", "Stock control|Stock taking|Inventory management|Stock replenishment|Goods receiving"),
        ("R5", "Customer Service & Complaint Handling", "Customer service|Complaint handling|Customer support|Call centre|Call center|Customer enquiries"),
        ("R6", "Store Operations Management", "Store manager|Outlet management|Branch operations|Shop operations|Retail operations"),
        ("R7", "Telesales & Direct Selling", "Telesales|Direct selling|Cold calling|Door-to-door sales|Insurance agent|Property negotiator"),
        ("R8", "Retail Loss Prevention", "Loss prevention|Shrinkage control|Store security|Anti-shoplifting"),
        ("R9", "Merchandise Buying & Category Management", "Merchandise buying|Category management|Assortment planning|Retail buyer"),
        ("R10", "Live Streaming & Social Selling", "Live selling|TikTok Shop|Live streaming sales|Facebook Live selling|Social selling"),
        ("R11", "Customer Loyalty & After-Sales Service", "Loyalty programme|Membership program|Customer retention|After-sales service|Warranty claims"),
        ("R12", "Contact Centre & Helpdesk Tools", "Contact centre|Zendesk|Freshdesk|Ticketing system|Live chat support|Helpdesk"),
    ]),
    ("Agriculture_Food", "Hard_Skill", [
        ("A1", "Crop Production & Field Agronomy", "Crop production|Agronomy|Planting|Harvesting|Paddy farming|Vegetable farming|Pertanian"),
        ("A2", "Oil Palm Plantation Operations", "Oil palm|Plantation management|FFB harvesting|Estate management|Ladang|Rubber tapping"),
        ("A3", "Livestock & Poultry Husbandry", "Livestock|Poultry farming|Cattle rearing|Animal husbandry|Goat farming"),
        ("A4", "Aquaculture & Fisheries Operations", "Aquaculture|Fish farming|Fisheries|Shrimp farming|Fishing vessel|Nelayan"),
        ("A5", "Pest & Plant Disease Management", "Pest control|Integrated pest management|Pesticide application|Plant disease|Fertilizer application"),
        ("A6", "Soil Science & Plant Nutrition", "Soil analysis|Soil science|Plant nutrition|Composting|Soil fertility"),
        ("A7", "Farm Machinery Operation", "Tractor operation|Farm machinery|Harvester operation|Agricultural equipment"),
        ("A8", "Food Processing & Production Lines", "Food processing|Food production line|Food packaging|Food manufacturing|Bakery production"),
        ("A9", "Post-Harvest Handling & Cold Storage", "Post-harvest|Grading and sorting|Cold storage|Produce handling"),
        ("A10", "Agribusiness & Farm Management", "Farm management|Agribusiness|Farm business planning|Cooperative management|Smallholder"),
        ("A11", "Veterinary Care & Animal Health", "Veterinary|Animal health|Animal vaccination|Veterinary assistant"),
        ("A12", "Forestry & Land Management", "Forestry|Tree nursery|Timber harvesting|Reforestation|Land management"),
    ]),
    ("Clinical_Healthcare", "Hard_Skill", [
        ("C1", "Nursing Care & Patient Assessment", "Nursing|Registered nurse|Staff nurse|Jururawat|Patient assessment|Ward nursing|Vital signs"),
        ("C2", "Medication Administration & Pharmacy Practice", "Pharmacy|Pharmacist|Dispensing|Medication administration|Prescription checking"),
        ("C3", "First Aid & Emergency Response", "First aid|CPR|Basic life support|Emergency response|Paramedic|ACLS"),
        ("C4", "Elderly & Home Care", "Elderly care|Caregiver|Aged care|Home care|Nursing home|Palliative care"),
        ("C5", "Infection Prevention & Control", "Infection control|Sterilization|Hand hygiene|Aseptic technique|CSSD"),
        ("C6", "Medical Laboratory Testing", "Medical laboratory|Lab technician|Phlebotomy|Blood sampling|Specimen processing|Clinical laboratory"),
        ("C7", "Medical Imaging & Radiography", "Radiography|Radiographer|Ultrasound|MRI|CT scan|Medical imaging"),
        ("C8", "Patient Records & Clinic Administration", "Medical records|Clinic administration|Patient registration|Medical billing|Hospital administration"),
        ("C9", "Counselling & Mental Health Support", "Counselling|Counseling|Mental health|Psychological first aid|Kaunselor|Psychotherapy"),
        ("C10", "Dental Care Assistance", "Dental assistant|Dental surgery assistant|Oral health|Dental hygiene"),
        ("C11", "Nutrition & Dietetics", "Dietitian|Nutritionist|Clinical nutrition|Diet counselling|Dietetics"),
        ("C12", "Midwifery & Maternal Care", "Midwifery|Midwife|Bidan|Maternal care|Antenatal care|Labour ward"),
    ]),
    ("Construction_Trades", "Hard_Skill", [
        ("K1", "Electrical Wiring & Installation", "Electrician|Electrical wiring|Wireman|Pendawai|Electrical installation"),
        ("K2", "Plumbing & Pipe Fitting", "Plumber|Plumbing|Pipe fitting|Sanitary installation|Pipefitter"),
        ("K3", "Welding & Metal Fabrication", "Welding|Welder|MIG welding|TIG welding|Arc welding|Metal fabrication"),
        ("K4", "Carpentry & Joinery", "Carpentry|Carpenter|Joinery|Woodworking|Furniture making|Formwork"),
        ("K5", "Masonry, Tiling & Concrete Works", "Bricklaying|Masonry|Plastering|Tiling|Concrete works|Bar bending"),
        ("K6", "Heavy Machinery & Crane Operation", "Excavator|Crane operator|Forklift|Backhoe|Heavy equipment operation"),
        ("K7", "Air-Conditioning & Refrigeration Servicing", "Air-conditioning|Aircond technician|HVAC servicing|Refrigeration|Chiller maintenance"),
        ("K8", "Construction Site Supervision", "Site supervisor|Clerk of works|Site management|Construction supervision|CIDB green card"),
        ("K9", "Building & Facility Maintenance", "Building maintenance|Handyman|Facility maintenance|Repair works|General maintenance"),
        ("K10", "Technical Drawing Interpretation", "Blueprint reading|Technical drawing|Reading drawings|Shop drawings"),
        ("K11", "Painting, Renovation & Interior Fit-Out", "Building painting|Wall painting|Interior fit-out|Renovation|Finishing works"),
        ("K12", "Mechanical Equipment Maintenance", "Machine maintenance|Mechanical fitter|Maintenance technician|Preventive maintenance|Motor rewinding"),
    ]),
    ("Education_Teaching", "Hard_Skill", [
        ("E1", "Classroom Teaching & Lesson Planning", "Teaching|Teacher|Lesson planning|Classroom management|Lecturing"),
        ("E2", "Curriculum & Assessment Design", "Curriculum development|Assessment design|Exam setting|Rubric design|KSSM"),
        ("E3", "Early Childhood Education & Childcare", "Childcare|Preschool|Tadika|Taska|Early childhood education|Kindergarten"),
        ("E4", "Special Needs & Inclusive Education", "Special education|Pendidikan khas|Autism support|Inclusive education|Learning disabilities"),
        ("E5", "Language Teaching", "English teaching|TESL|Bahasa Melayu teaching|Language instruction|IELTS coaching|ESL"),
        ("E6", "STEM Subject Teaching", "Mathematics teaching|Science teaching|Physics tutor|Chemistry teaching|STEM education"),
        ("E7", "Tutoring & Academic Coaching", "Tutor|Tuition|Private tutoring|Academic coaching|Homework support"),
        ("E8", "Online & Blended Teaching", "Google Classroom|Online teaching|Moodle|Blended learning|DELIMa"),
        ("E9", "Student Counselling & Career Guidance", "Student counselling|Career guidance|Student welfare|Pastoral care"),
        ("E10", "School Administration & Leadership", "School administration|Headmaster|Principal|Academic administration|School management"),
        ("E11", "Training Delivery & Facilitation", "Trainer|Training facilitation|Workshop delivery|Train the trainer|TTT certified"),
        ("E12", "Academic Research & Writing", "Academic writing|Research supervision|Thesis writing|Journal publication|Literature review"),
    ]),
    ("Transport_Automotive", "Hard_Skill", [
        ("T1", "Commercial Driving & Road Safety", "Lorry driver|Truck driver|Commercial driving|GDL licence|PSV licence|Defensive driving"),
        ("T2", "Automotive Repair & Diagnostics", "Mechanic|Automotive repair|Car servicing|Engine diagnostics|Vehicle maintenance|Mekanik"),
        ("T3", "Electric & Hybrid Vehicle Servicing", "EV servicing|Hybrid vehicle maintenance|High-voltage vehicle safety|EV technician"),
        ("T4", "Motorcycle & Small Engine Repair", "Motorcycle repair|Small engine repair|Bike mechanic|Outboard engine"),
        ("T5", "Last-Mile Delivery & Dispatch", "Courier|Dispatch coordination|Delivery rider|Parcel delivery|Route planning|Food delivery"),
        ("T6", "Passenger Transport Services", "E-hailing|Ride-hailing|Bus driver|Taxi driver|Passenger service"),
        ("T7", "Maritime Operations & Seafaring", "Seafarer|Deck officer|Marine engineering|Ship operations|STCW"),
        ("T8", "Airport Ground Handling & Cabin Services", "Ground handling|Cabin crew|Flight attendant|Ramp operations|Airport operations"),
        ("T9", "Rail Operations & Maintenance", "Train operator|Rail maintenance|LRT operations|MRT operations|Railway signalling"),
        ("T10", "Transport & Traffic Planning", "Transport planning|Traffic management|Public transport planning|Traffic engineering"),
        ("T11", "Freight Documentation & Customs Forms", "Shipping documentation|Bill of lading|Forwarding agent|Import export documentation|Customs declaration"),
        ("T12", "Vehicle Body Repair & Spray Painting", "Panel beating|Spray painting|Body repair|Car paint"),
    ]),
    ("Energy_Resources", "Hard_Skill", [
        ("O1", "Upstream Oil & Gas Operations", "Oil and gas|Offshore operations|Drilling|Production operations|Wellhead|Upstream"),
        ("O2", "Process Plant Operation", "Plant operator|Process operator|Control room operator|Refinery operations|DCS operation"),
        ("O3", "Instrumentation & Calibration", "Instrumentation|Instrument calibration|Control valves|Instrument technician|Loop checking"),
        ("O4", "Rotating Equipment & Pipeline Maintenance", "Pipeline maintenance|Rotating equipment|Pump maintenance|Compressor maintenance|Gas turbine"),
        ("O5", "Mining & Quarry Operations", "Mining operations|Open-pit mining|Quarry|Blasting operations|Mineral processing"),
        ("O6", "Power Generation & Substation Operations", "Power plant|Chargeman|Power generation|Substation|Electrical grid operations"),
        ("O7", "Water & Wastewater Plant Operation", "Water treatment plant|Water supply|Water operator|Sewerage operations|Sewage treatment"),
        ("O8", "Permit-to-Work & Offshore Safety", "Permit to work|HSE|NIOSH|BOSIET|Offshore safety|Confined space"),
        ("O9", "Non-Destructive Testing & Inspection", "NDT|Ultrasonic testing|Radiographic testing|Inspection engineer|API 510"),
        ("O10", "Geoscience & Reservoir Engineering", "Geology|Geophysics|Reservoir engineering|Seismic interpretation|Petroleum engineering"),
        ("O11", "Utility Metering & Billing", "Meter reading|Utility billing|Tariff management|Smart metering"),
        ("O12", "Corrosion Protection & Coating", "Corrosion control|Cathodic protection|Coating inspection|NACE|Blasting and painting"),
    ]),
    ("Legal_Public_Social", "Hard_Skill", [
        ("L1", "Legal Research & Drafting", "Legal research|Legal drafting|Contract drafting|Litigation|Lawyer|Peguam|Conveyancing"),
        ("L2", "Paralegal & Court Documentation", "Paralegal|Legal clerk|Court filing|Legal documentation|Chambering"),
        ("L3", "Public Administration & Policy Implementation", "Public service|Government administration|Policy implementation|Civil service|Public administration"),
        ("L4", "Social Work & Case Management", "Social work|Community welfare|Case management|Welfare officer|Social worker"),
        ("L5", "Security Patrol & Access Control", "Security guard|Security officer|Patrolling|Access control|Guard duty|Pengawal keselamatan"),
        ("L6", "Investigation & Enforcement", "Criminal investigation|Police|Enforcement officer|Evidence handling|Customs enforcement"),
        ("L7", "Fire & Rescue Operations", "Firefighting|Firefighter|Bomba|Rescue operations|Fire warden"),
        ("L8", "Clerical Administration & Records Management", "Clerk|Office administration|Filing system|Data entry|Records management|Kerani"),
        ("L9", "Secretarial & Executive Support", "Secretary|Personal assistant|Executive assistant|Diary management|Minute taking"),
        ("L10", "Translation & Interpretation", "Translation|Interpreter|Translator|Penterjemah|Localization"),
        ("L11", "Volunteer & Community Programme Coordination", "Volunteer coordination|NGO|Nonprofit management|Fundraising|Community outreach"),
        ("L12", "Licensing & Compliance Inspection", "Licensing officer|Regulatory inspection|Compliance inspection|Permit processing|Local council enforcement"),
    ]),
    ("Arts_Media_Culture", "Hard_Skill", [
        ("M1", "Photography & Videography", "Photography|Photographer|Videography|Wedding photography|Lightroom|Camera operation"),
        ("M2", "Journalism & News Reporting", "Journalism|Journalist|Reporter|News writing|News editor|Wartawan"),
        ("M3", "Broadcasting, Hosting & Voice Work", "Radio DJ|TV presenter|Emcee|Event host|Voice over|Broadcasting"),
        ("M4", "Performing Arts (Music, Dance, Theatre)", "Musician|Singer|Dancer|Theatre|Acting|Music performance"),
        ("M5", "Fashion Design & Tailoring", "Fashion design|Tailoring|Sewing|Pattern making|Dressmaking|Jahitan"),
        ("M6", "Traditional Crafts & Artisan Production", "Batik|Songket|Handicraft|Pottery|Woodcarving|Artisan"),
        ("M7", "Fine Art & Illustration", "Illustration|Illustrator|Drawing|Fine art|Mural|Watercolour|Oil painting"),
        ("M8", "Film & Video Production", "Film production|Video production|Directing|Scriptwriting|Production assistant"),
        ("M9", "Social Media Content Creation", "Content creator|Influencer|YouTube|TikTok content|Instagram content|Vlogging"),
        ("M10", "Public Relations & Media Relations", "Public relations|Media relations|Press release|Corporate communications"),
        ("M11", "Museum & Heritage Management", "Museum|Heritage conservation|Cultural management|Curator|Archives"),
        ("M12", "Interior & Spatial Design", "Interior design|Space planning|SketchUp|3ds Max|Interior styling"),
    ]),
]

# Short codes for the existing Core_Transferable skills (in taxonomy order).
CORE_CODES = {
    "X1": "Analytical & Critical Thinking",
    "X2": "Cross-Functional Stakeholder Communication",
    "X3": "Adaptability & Continuous Learning",
    "X4": "Collaborative Teamwork & Psychological Safety",
    "X5": "Project Planning & Time Prioritization",
    "X6": "Ethical Judgment & Professional Integrity",
    "X7": "Customer & Citizen Centricity",
    "X8": "Leadership & Decision Making Under Uncertainty",
    "X9": "Creative Ideation & Design Thinking",
    "X10": "Negotiation & Consensus Building",
}

# Education/experience ladder used by every world sector; titles below are
# listed in this order. Many of these roles are open to SPM / TVET holders.
VOCATIONAL_LEVELS = [
    ("Entry", "SPM/SKM", 0), ("Entry", "Diploma/DKM", 0), ("Mid", "Diploma/DKM", 2), ("Mid", "Bachelor", 2),
    ("Senior", "Diploma/DKM", 5), ("Senior", "Bachelor", 5), ("Lead", "Bachelor", 7), ("Lead", "Master/PhD", 8),
]

OSH = "Occupational Safety and Health (OSH)"
HACCP = "Food Safety & Halal Assurance (HACCP)"
COST = "Management Accounting & Cost Control"
RISK = "Risk Management & Corporate Governance"
QMS = "Quality Management Systems (ISO 9001/IATF)"
STATS = "Statistical Analysis & Hypothesis Testing"
BI = "Business Intelligence & Dashboards"
COPY = "Content Strategy & Copywriting"
DIGIMKT = "Digital Marketing & Performance Analytics"
ECOM = "E-Commerce Marketplace Management"

# (sector, masco_unit_group, mycol_status, sdg_key, sdg_rationale, [(title, required, preferred)])
WORLD_SECTORS = [
    ("Hospitality, Tourism & Food Service", "5120", "MODERATE_DEMAND", "SDG_08_9",
     "Target 8.9: Devise and implement policies to promote sustainable tourism that creates jobs and promotes local culture and products.", [
        ("Food & Beverage Service Crew", ["H2", "H4", "R2", "R5"], ["H11", "X4"]),
        ("Front Office Receptionist", ["H1", "H7", "H10", "R5"], ["X2", "X7"]),
        ("Chef de Partie", ["H3", "H4", HACCP, "X4"], ["H8", "X5"]),
        ("Tour Guide & Travel Consultant", ["H6", "H7", "H10", "X2"], ["R1", "Hospitality & Sustainable Tourism Management"]),
        ("Executive Housekeeper", ["H5", "H9", "X8", "X5"], ["H12", OSH]),
        ("Events & Banquet Manager", ["H8", "H2", "X5", "R5"], ["X10", DIGIMKT]),
        ("Executive Chef", ["H3", "H4", HACCP, "X8"], [COST, "X9"]),
        ("Hotel General Manager", ["H9", "Hospitality & Sustainable Tourism Management", "X8", COST], ["R11", "X10"]),
    ]),
    ("Retail, Sales & Customer Service", "5223", "MODERATE_DEMAND", "SDG_08_5",
     "Target 8.5: Achieve full and productive employment and decent work for all women and men, including young people.", [
        ("Retail Sales Assistant", ["R1", "R2", "R3", "R5"], ["R4", "X4"]),
        ("Cashier & Customer Service Executive", ["R2", "R5", "R11", "X7"], ["R12", "X6"]),
        ("Contact Centre Agent", ["R5", "R12", "R7", "X2"], ["R11", "X3"]),
        ("Live-Commerce Sales Specialist", ["R10", "R1", ECOM, "M9"], [DIGIMKT, "X9"]),
        ("Retail Store Supervisor", ["R6", "R4", "R8", "X8"], ["R3", "X5"]),
        ("Merchandise Buyer", ["R9", "R4", "Procurement & Vendor Contract Management", "X10"], [BI, "X1"]),
        ("Retail Area Manager", ["R6", "R9", "X8", COST], ["R11", "X1"]),
        ("Head of Customer Experience", ["R11", "R12", "X7", "X8"], ["User Research & Usability Testing", BI]),
    ]),
    ("Agriculture, Plantation & Fisheries", "6111", "MODERATE_DEMAND", "SDG_02",
     "Target 2.4: Ensure sustainable food production systems and implement resilient agricultural practices.", [
        ("Plantation Field Worker", ["A2", "A5", "A7", "A1"], ["X4", OSH]),
        ("Aquaculture Farm Technician", ["A4", "A9", "A11", "X5"], ["A10", "X3"]),
        ("Livestock & Poultry Farm Supervisor", ["A3", "A11", "A10", "X8"], ["A5", HACCP]),
        ("Agronomist", ["A1", "A6", "A5", "Precision Agriculture & Smart Farming"], ["X1", STATS]),
        ("Food Processing Production Supervisor", ["A8", HACCP, "A9", "Lean Six Sigma & Continuous Improvement"], ["X8", QMS]),
        ("Estate Assistant Manager", ["A2", "A10", "Sustainable Supply Chain Traceability", "X8"], ["A12", "X5"]),
        ("Plantation Estate Manager", ["A2", "A10", "Sustainable Supply Chain Traceability", COST], ["X8", "A12"]),
        ("Head of Agricultural Research", ["A1", "A6", STATS, "E12"], ["Precision Agriculture & Smart Farming", "X8"]),
    ]),
    ("Clinical Healthcare & Care Services", "2221", "MODERATE_DEMAND", "SDG_03_C",
     "Target 3.c: Substantially increase the recruitment, development, training and retention of the health workforce.", [
        ("Healthcare Assistant / Caregiver", ["C4", "C3", "C5", "X7"], ["C1", "X4"]),
        ("Staff Nurse", ["C1", "C2", "C5", "C3"], ["C8", "X7"]),
        ("Medical Laboratory Technologist", ["C6", "C5", QMS, "C8"], ["X1", "Genomic Sequencing & PCR Assay Design"]),
        ("Pharmacist", ["C2", "Pharmaceutical GMP & Quality Control", "C8", "X7"], ["X6", "C11"]),
        ("Senior Radiographer", ["C7", "C5", "C8", "X4"], ["C3", "X8"]),
        ("Nursing Manager (Matron)", ["C1", "C2", "X8", "C5"], ["C12", "X5"]),
        ("Counselling & Mental Health Lead", ["C9", "X7", "X6", "Public Health Epidemiology"], ["L4", "X2"]),
        ("Director of Nursing", ["C1", "X8", RISK, "C8"], ["X10", "Public Health Epidemiology"]),
    ]),
    ("Construction, Skilled Trades & Facilities", "7411", "MODERATE_DEMAND", "SDG_09_1",
     "Target 9.1: Develop quality, reliable, sustainable and resilient infrastructure.", [
        ("Electrician (Wireman)", ["K1", "K10", OSH, "K9"], ["K7", "X4"]),
        ("Air-Conditioning & Refrigeration Technician", ["K7", "K1", "K12", "X7"], ["K9", "Energy Efficiency & Building Audits"]),
        ("Certified Welder & Fabricator", ["K3", "K10", OSH, QMS], ["K12", "X4"]),
        ("Building Services Engineer", ["K1", "K2", "K7", "Energy Efficiency & Building Audits"], ["Civil Structural BIM Modeling", "X1"]),
        ("Construction Site Supervisor", ["K8", "K5", "K10", OSH], ["K6", "X8"]),
        ("Facilities Maintenance Manager", ["K9", "K12", "K7", "X5"], ["Predictive Maintenance & IIoT Sensors", "X8"]),
        ("Construction Project Manager", ["K8", "Civil Structural BIM Modeling", "X5", "Procurement & Vendor Contract Management"], ["X8", RISK]),
        ("Head of Property & Infrastructure", ["K9", "X8", RISK, COST], ["Energy Efficiency & Building Audits", "X10"]),
    ]),
    ("Education & Teaching", "2330", "STABLE", "SDG_04_C",
     "Target 4.c: Substantially increase the supply of qualified teachers.", [
        ("Childcare Assistant (Taska)", ["E3", "C3", "X7", "X4"], ["C11", "X3"]),
        ("Preschool Teacher", ["E3", "E1", "E5", "X2"], ["E4", "X9"]),
        ("Tuition Centre Teacher", ["E7", "E6", "E1", "X2"], ["E8", "X3"]),
        ("Secondary School Teacher", ["E1", "E2", "E6", "X2"], ["E8", "E9"]),
        ("Corporate Trainer", ["E11", "Learning & Development Instructional Design", "X2", "E8"], ["X9", "X8"]),
        ("Special Education Teacher", ["E4", "E1", "E9", "X7"], ["C9", "E2"]),
        ("School Principal", ["E10", "X8", "E2", "X6"], ["E9", "X5"]),
        ("University Lecturer", ["E12", "E1", "E2", "E8"], ["X1", STATS]),
    ]),
    ("Transport, Automotive & Maritime", "8332", "MODERATE_DEMAND", "SDG_11_2",
     "Target 11.2: Provide access to safe, affordable, accessible and sustainable transport systems for all.", [
        ("Delivery Rider & Courier", ["T5", "T1", "X7", "X3"], ["T4", ECOM]),
        ("Automotive Service Technician", ["T2", "T4", OSH, "X7"], ["T3", "T12"]),
        ("EV & Hybrid Vehicle Technician", ["T3", "T2", "Electric Vehicle & Battery Management Systems", "X3"], ["K1", "X1"]),
        ("Fleet & Dispatch Coordinator", ["T5", "T1", "Supply Chain & Logistics Optimization", "X5"], ["T10", BI]),
        ("Airport Ground Operations Supervisor", ["T8", OSH, "X8", "X5"], ["H10", "X7"]),
        ("Marine Deck Officer", ["T7", "T11", "X8", OSH], ["X1", "X2"]),
        ("Transport Operations Manager", ["T10", "T6", "T5", "X8"], ["Supply Chain & Logistics Optimization", COST]),
        ("Head of Public Transport Planning", ["T10", "T9", "Geospatial Data Analysis", "L3"], ["X8", "Climate Risk & Scenario Modeling"]),
    ]),
    ("Oil, Gas, Mining & Utilities", "3134", "MODERATE_DEMAND", "SDG_07_1",
     "Target 7.1: Ensure universal access to affordable, reliable and modern energy services.", [
        ("Water Treatment Plant Operator", ["O7", "O2", OSH, "X5"], ["O11", "X4"]),
        ("Instrument Technician", ["O3", "O2", "O8", "K1"], ["O6", "X1"]),
        ("Offshore Process Operator", ["O2", "O1", "O8", "X4"], ["O4", "X3"]),
        ("Petroleum Engineer", ["O10", "O1", "Chemical Process Simulation & Safety", "X1"], [STATS, "X5"]),
        ("NDT Inspection Supervisor", ["O9", "O12", "O8", QMS], ["K3", "X8"]),
        ("Mining & Quarry Engineer", ["O5", "O8", "Environmental Impact Assessment (EIA)", "X5"], ["Geospatial Data Analysis", "X8"]),
        ("HSE Manager (Oil & Gas)", ["O8", OSH, RISK, "X8"], ["X6", "X2"]),
        ("Head of Upstream Operations", ["O1", "O10", "X8", RISK], ["Hydrogen & Alternative Fuels Engineering", "Climate Risk & Scenario Modeling"]),
    ]),
    ("Legal, Public Administration & Community Services", "2611", "STABLE", "SDG_16_6",
     "Target 16.6: Develop effective, accountable and transparent institutions at all levels.", [
        ("Security Officer", ["L5", "C3", "L7", "X6"], ["L6", "X2"]),
        ("Administrative Clerk", ["L8", "X7", "X5", "X6"], ["L9", "L10"]),
        ("Paralegal & Legal Clerk", ["L2", "L1", "L8", "X6"], ["L10", "X5"]),
        ("Social Welfare Officer", ["L4", "C9", "L11", "X7"], ["L3", "X2"]),
        ("Executive Secretary", ["L9", "L8", "X2", "X5"], ["L10", "X6"]),
        ("Advocate & Solicitor", ["L1", "L2", "X10", "X6"], ["X1", "X2"]),
        ("Enforcement & Licensing Manager", ["L12", "L6", "L3", "X8"], [RISK, "X6"]),
        ("Senior Public Policy Administrator", ["L3", "X1", "X8", STATS], ["L11", "X10"]),
    ]),
    ("Arts, Media & Cultural Industries", "2651", "STABLE", "SDG_11_4",
     "Target 11.4: Strengthen efforts to protect and safeguard the world's cultural and natural heritage.", [
        ("Batik & Handicraft Artisan", ["M6", "M7", "X9", "R1"], ["M5", ECOM]),
        ("Photographer & Videographer", ["M1", "M8", "Motion Graphics & Video Compositing", "X7"], ["M9", "X9"]),
        ("Social Media Content Creator", ["M9", "M1", COPY, "R10"], [DIGIMKT, "X9"]),
        ("Journalist", ["M2", COPY, "X1", "X6"], ["M3", "L10"]),
        ("Fashion Designer & Tailor", ["M5", "M7", "X9", "R1"], ["M6", "Graphic Design & Brand Identity"]),
        ("Public Relations Manager", ["M10", "X2", COPY, "X10"], ["M2", "M3"]),
        ("Film & TV Producer", ["M8", "X5", "X8", COST], ["M4", "Sound Design & Interactive Audio"]),
        ("Museum & Heritage Director", ["M11", "X8", "E12", "X5"], ["M6", "M10"]),
    ]),
]

# Primary skill category for every sector (original + world), used by the
# synthetic CV generator to keep a persona's field of study and career
# interests in the same industry.
WORLD_SECTOR_PRIMARY_CATEGORY: Dict[str, str] = {
    "Hospitality, Tourism & Food Service": "Hospitality_Tourism",
    "Retail, Sales & Customer Service": "Retail_Customer_Service",
    "Agriculture, Plantation & Fisheries": "Agriculture_Food",
    "Clinical Healthcare & Care Services": "Clinical_Healthcare",
    "Construction, Skilled Trades & Facilities": "Construction_Trades",
    "Education & Teaching": "Education_Teaching",
    "Transport, Automotive & Maritime": "Transport_Automotive",
    "Oil, Gas, Mining & Utilities": "Energy_Resources",
    "Legal, Public Administration & Community Services": "Legal_Public_Social",
    "Arts, Media & Cultural Industries": "Arts_Media_Culture",
}


def build_code_lookup() -> Dict[str, str]:
    """Map short codes (H1, X3, ...) to canonical skill names."""
    lookup = dict(CORE_CODES)
    for _, _, items in WORLD_SKILL_CLUSTERS:
        for code, name, _ in items:
            lookup[code] = name
    return lookup
