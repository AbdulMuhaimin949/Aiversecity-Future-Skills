import React from 'react';

export interface SDGData {
  id: number;
  title: string;
  color: string;
  roles: number;
  skills: number;
  targetsCount: number;
  targets: string[];
  examples: string;
  isPathway?: boolean;
}

export const ALL_17_SDGS: SDGData[] = [
  {
    id: 4,
    title: "Quality Education",
    color: "#C5192D",
    roles: 24,
    skills: 33,
    targetsCount: 2,
    targets: ["4.4", "4.c"],
    examples: "e.g. Instructional Designer (e-Learning), TVET Vocational Training Specialist, HR Analytics & Workforce Planner",
    isPathway: true,
  },
  {
    id: 8,
    title: "Decent Work and Economic Growth",
    color: "#A21942",
    roles: 80,
    skills: 59,
    targetsCount: 3,
    targets: ["8.2", "8.5", "8.9"],
    examples: "e.g. IC Design Engineer (RTL/VLSI), Senior Physical Design Engineer, Wafer Fabrication Process Engineer",
    isPathway: true,
  },
  {
    id: 1,
    title: "No Poverty",
    color: "#E5243B",
    roles: 12,
    skills: 18,
    targetsCount: 2,
    targets: ["1.3", "1.4"],
    examples: "e.g. Microfinance Credit Analyst, Financial Inclusion Specialist, Community Development Officer",
  },
  {
    id: 2,
    title: "Zero Hunger",
    color: "#DDA63A",
    roles: 8,
    skills: 12,
    targetsCount: 1,
    targets: ["2.4"],
    examples: "e.g. Plantation Field Worker, Aquaculture Farm Technician, Livestock & Poultry Farm Supervisor",
  },
  {
    id: 3,
    title: "Good Health and Well-being",
    color: "#4C9F38",
    roles: 24,
    skills: 23,
    targetsCount: 2,
    targets: ["3.c", "3.d"],
    examples: "e.g. Bioinformatics Scientist, Clinical Data Manager, Medical Device Regulatory Specialist",
  },
  {
    id: 5,
    title: "Gender Equality",
    color: "#FF3A21",
    roles: 10,
    skills: 15,
    targetsCount: 2,
    targets: ["5.5", "5.b"],
    examples: "e.g. DEI Program Manager, HR Compliance & Equity Specialist, People Analytics Partner",
  },
  {
    id: 6,
    title: "Clean Water and Sanitation",
    color: "#26BDE2",
    roles: 14,
    skills: 20,
    targetsCount: 2,
    targets: ["6.3", "6.4"],
    examples: "e.g. Hydrological Data Analyst, Water Quality Engineer, Wastewater Systems Specialist",
  },
  {
    id: 7,
    title: "Affordable and Clean Energy",
    color: "#FCC30B",
    roles: 8,
    skills: 12,
    targetsCount: 1,
    targets: ["7.1"],
    examples: "e.g. Water Treatment Plant Operator, Instrument Technician, Offshore Process Operator",
  },
  {
    id: 9,
    title: "Industry, Innovation and Infrastructure",
    color: "#FD6925",
    roles: 56,
    skills: 62,
    targetsCount: 2,
    targets: ["9.1", "9.5"],
    examples: "e.g. Junior Data Analyst, Business Intelligence Developer, Data Engineer",
  },
  {
    id: 10,
    title: "Reduced Inequalities",
    color: "#DD1367",
    roles: 12,
    skills: 16,
    targetsCount: 2,
    targets: ["10.2", "10.c"],
    examples: "e.g. Digital Accessibility Engineer, Social Impact Analyst, Public Policy Researcher",
  },
  {
    id: 11,
    title: "Sustainable Cities and Communities",
    color: "#FD9D24",
    roles: 16,
    skills: 24,
    targetsCount: 2,
    targets: ["11.2", "11.4"],
    examples: "e.g. Urban Mobility Planner, Smart Grid Systems Engineer, GIS Infrastructure Analyst",
  },
  {
    id: 12,
    title: "Responsible Consumption and Production",
    color: "#BF8B2E",
    roles: 18,
    skills: 26,
    targetsCount: 2,
    targets: ["12.5", "12.6"],
    examples: "e.g. ESG Reporting Analyst, Circular Supply Chain Specialist, Sustainability Compliance Officer",
  },
  {
    id: 13,
    title: "Climate Action",
    color: "#3F7E44",
    roles: 16,
    skills: 18,
    targetsCount: 1,
    targets: ["13.3"],
    examples: "e.g. Carbon Accounting Analyst, Climate Risk Modeler, Environmental Data Scientist",
  },
  {
    id: 14,
    title: "Life Below Water",
    color: "#0A97D9",
    roles: 8,
    skills: 14,
    targetsCount: 2,
    targets: ["14.1", "14.4"],
    examples: "e.g. Marine GIS Specialist, Sustainable Fisheries Analyst, Coastal Environmental Officer",
  },
  {
    id: 15,
    title: "Life on Land",
    color: "#56C02B",
    roles: 12,
    skills: 19,
    targetsCount: 2,
    targets: ["15.1", "15.2"],
    examples: "e.g. Forestry GIS Analyst, Biodiversity Conservation Specialist, Environmental Impact Assessor",
  },
  {
    id: 16,
    title: "Peace, Justice and Strong Institutions",
    color: "#00689D",
    roles: 8,
    skills: 12,
    targetsCount: 1,
    targets: ["16.6"],
    examples: "e.g. Cybersecurity Governance Analyst, Regulatory Compliance Officer, Digital Forensics Specialist",
  },
  {
    id: 17,
    title: "Partnerships for the Goals",
    color: "#19486A",
    roles: 16,
    skills: 22,
    targetsCount: 2,
    targets: ["17.6", "17.16"],
    examples: "e.g. Strategic Partnerships Manager, ESG Investment Analyst, International Development Coordinator",
  },
];

export const SDGIcon: React.FC<{ id: number; className?: string }> = ({ id, className = "w-11 h-11 text-white" }) => {
  switch (id) {
    case 1: // No Poverty - People group
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <circle cx="14" cy="20" r="4" /><path d="M10 26h8v14h-2v12h-4V40h-2V26z" />
          <circle cx="26" cy="24" r="3.5" /><path d="M22 30h8v10h-2v12h-4V40h-2V30z" />
          <circle cx="38" cy="24" r="3.5" /><path d="M34 30h8v10h-2v12h-4V40h-2V30z" />
          <circle cx="50" cy="20" r="4" /><path d="M46 26h8v14h-2v12h-4V40h-2V26z" />
        </svg>
      );
    case 2: // Zero Hunger - Steaming bowl
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={className}>
          <path d="M22 14c-2 4 2 6 0 10M32 12c-2 4 2 6 0 10M42 14c-2 4 2 6 0 10" />
          <path d="M12 30h40c0 12-9 20-20 20S12 42 12 30z" fill="currentColor" stroke="none" />
          <path d="M22 52h20" strokeWidth="4" />
        </svg>
      );
    case 3: // Good Health - Heartbeat + Heart
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M6 36h12l5-14 6 26 7-30 5 18h6" />
          <path d="M52 28c-2.5-2.5-6.5-2.5-9 0l-1 1-1-1c-2.5-2.5-6.5-2.5-9 0s-2.5 6.5 0 9l10 10 10-10c2.5-2.5 2.5-6.5 0-9z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 4: // Quality Education - Open book + pencil
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <path d="M10 16v30c8-4 16-2 20 2V20c-4-4-12-6-20-4zm40 0c-8-2-16 0-20 4v28c4-4 12-6 20-2V16z" />
          <rect x="54" y="16" width="4" height="32" rx="1" />
        </svg>
      );
    case 5: // Gender Equality - Female + Male symbol with equals
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" className={className}>
          <circle cx="30" cy="28" r="12" />
          <path d="M30 40v14M23 48h14M39 19l11-11M42 8h8v8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M25 25h10M25 31h10" strokeLinecap="round" />
        </svg>
      );
    case 6: // Clean Water - Drop in container with arrow
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" className={className}>
          <path d="M16 12h32l-4 30H20L16 12z" />
          <path d="M32 22c-4 5-6 8-6 11a6 6 0 0012 0c0-3-2-6-6-11z" fill="currentColor" stroke="none" />
          <path d="M32 42v12m-6-5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 7: // Clean Energy - Sun with power symbol
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className={className}>
          <circle cx="32" cy="32" r="12" />
          <path d="M32 24v7M27 28a7 7 0 1010 0" />
          <path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M49 15l-4 4M19 45l-4 4" />
        </svg>
      );
    case 8: // Decent Work - Bar chart with rising arrow
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <rect x="14" y="36" width="8" height="16" />
          <rect x="28" y="28" width="8" height="24" />
          <rect x="42" y="20" width="8" height="32" />
          <path d="M12 30l14-12 8 6 16-14m-10 0h10v10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 9: // Industry & Innovation - Three isometric cubes
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className={className}>
          <path d="M32 10l12 7v14l-12 7-12-7V17l12-7z" />
          <path d="M20 31l12 7v14l-12 7-12-7V38l12-7z" />
          <path d="M44 31l12 7v14l-12 7-12-7V38l12-7z" />
        </svg>
      );
    case 10: // Reduced Inequalities - Equals in circle
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={className}>
          <circle cx="32" cy="32" r="18" />
          <path d="M24 28h16M24 36h16" />
        </svg>
      );
    case 11: // Sustainable Cities - Buildings & house
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <path d="M10 36l8-8 8 8v16H10V36z" />
          <rect x="28" y="14" width="12" height="38" />
          <rect x="42" y="24" width="12" height="28" />
        </svg>
      );
    case 12: // Responsible Consumption - Infinity loop
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" className={className}>
          <path d="M20 22c-6 0-10 4.5-10 10s4 10 10 10c8 0 16-20 24-20 6 0 10 4.5 10 10s-4 10-10 10c-5 0-10-6-15-12" />
        </svg>
      );
    case 13: // Climate Action - Eye with globe
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" className={className}>
          <path d="M6 32c7-12 16-16 26-16s19 4 26 16c-7 12-16 16-26 16S13 44 6 32z" fill="currentColor" />
          <circle cx="32" cy="32" r="9" fill="#3F7E44" stroke="none" />
        </svg>
      );
    case 14: // Life Below Water - Waves + Fish
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className={className}>
          <path d="M12 18c5-4 10 4 15 0s10 4 15 0 10 4 10 0M12 26c5-4 10 4 15 0s10 4 15 0 10 4 10 0" />
          <path d="M18 42c8-8 20-8 28 0-8 8-20 8-28 0zm0 0l-8-6v12l8-6z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 15: // Life on Land - Tree + Ground lines
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <circle cx="26" cy="22" r="10" />
          <rect x="24" y="30" width="4" height="14" />
          <rect x="14" y="46" width="36" height="3" rx="1.5" />
          <rect x="14" y="52" width="36" height="3" rx="1.5" />
        </svg>
      );
    case 16: // Peace & Justice - Dove + Gavel
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
          <path d="M18 22c6 2 12 0 16-6 2 4 8 6 12 4-2 6-6 12-14 14l4 8H24l2-8c-6-2-10-6-8-12z" />
          <rect x="14" y="48" width="36" height="4" rx="2" />
        </svg>
      );
    case 17: // Partnerships - Interlocking circles
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
          <circle cx="32" cy="22" r="9" />
          <circle cx="23" cy="30" r="9" />
          <circle cx="41" cy="30" r="9" />
          <circle cx="26" cy="40" r="9" />
          <circle cx="38" cy="40" r="9" />
        </svg>
      );
  }
};