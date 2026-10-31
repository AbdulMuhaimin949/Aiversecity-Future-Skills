// artifacts/future-skills/src/components/career-scenario-explorer.tsx
// Career Scenario Explorer - Clean, interactive & beginner-friendly scenario simulation for CTRL CV Career Radar

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Info,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  RotateCcw,
  SlidersHorizontal,
  Compass,
} from "lucide-react";
import { useCompareScenarios, type Scenario } from "@workspace/api-client-react";
import { Skel, ErrorState } from "@/components/kit";
import { cn } from "@/lib/utils";

export type ExplorerLang = "en" | "ms" | "zh";

interface LanguageContent {
  sectionTitle: string;
  sectionSubtitle: string;
  simulationBadge: string;
  scenarioSelectorTitle: string;
  sectorSelectorTitle: string;
  selectSectorPlaceholder: string;
  resetButton: string;
  resultPrefix: string;
  resultFor: string;
  projectedChange: string;
  demandExpanding: string;
  demandSlowing: string;
  whatDoesThisMeanTitle: string;
  whatDoesThisMeanText: (scenarioName: string, sector: string, pctStr: string, isPositive: boolean) => string;
  notAGuaranteeNotice: string;
  compareButton: string;
  compareHideButton: string;
  howCalculatedTitle: string;
  methodologyTitle: string;
  methodologyText: string;
  assumptionsTitle: string;
  dataSourceTitle: string;
  dataPeriodTitle: string;
  classificationTitle: string;
  classificationValue: string;
  unavailableText: string;
  scenarios: Record<
    Scenario,
    {
      name: string;
      badge: string;
      simpleExplanation: string;
    }
  >;
}

const I18N: Record<ExplorerLang, LanguageContent> = {
  en: {
    sectionTitle: "Explore Your Career's Future",
    sectionSubtitle: "Discover how different industry scenarios could affect career sectors.",
    simulationBadge: "SIMULATION MODEL",
    scenarioSelectorTitle: "1. Choose an AI Adoption Scenario",
    sectorSelectorTitle: "2. Select an Industry Sector",
    selectSectorPlaceholder: "Choose an industry...",
    resetButton: "Reset Selection",
    resultPrefix: "Under the",
    resultFor: "scenario, the model estimates a",
    projectedChange: "change for",
    demandExpanding: "Demand is expanding in this scenario",
    demandSlowing: "Demand is slowing in this scenario",
    whatDoesThisMeanTitle: "What Does This Mean for You?",
    whatDoesThisMeanText: (scenarioName, sector, pctStr, isPositive) =>
      `In a ${scenarioName} scenario, employer demand for ${sector} is projected to shift by ${pctStr}. ${
        isPositive
          ? "This indicates that technological adoption is expected to create new opportunities, digital workflows, and roles in this field."
          : "This indicates that automation may consolidate certain repetitive tasks, encouraging professionals to upskill into higher-value competencies."
      }`,
    notAGuaranteeNotice:
      "Important: This simulation estimates macroeconomic and technological task trends based on empirical research. It is designed for educational guidance and career preparation, not as a guaranteed prediction of future hiring or job offers.",
    compareButton: "Compare All 3 Scenarios for this Sector",
    compareHideButton: "Hide Comparison",
    howCalculatedTitle: "How Was This Calculated?",
    methodologyTitle: "Calculation Methodology",
    methodologyText:
      "Sector growth rates represent the average projected demand changes across all 240 MASCO occupations categorized within each industry sector. Each occupation's score combines empirical task exposure, augmentation potential, and baseline labour market signals.",
    assumptionsTitle: "Current Scenario Assumptions",
    dataSourceTitle: "Data Sources",
    dataPeriodTitle: "Measurement Period",
    classificationTitle: "Data Classification",
    classificationValue: "Empirical Labour Classification (MASCO 2020 / MyCOL) + Calibrated Scenario Model",
    unavailableText: "Not currently available in published metadata.",
    scenarios: {
      baseline: {
        name: "Low Change",
        badge: "Cautious Pace",
        simpleExplanation: "Gradual technology adoption with conservative enterprise uptake and traditional skill demands.",
      },
      moderate: {
        name: "Moderate Change",
        badge: "Steady Pace",
        simpleExplanation: "Steady digital transformation with balanced automation and regular workforce upskilling.",
      },
      fast: {
        name: "High Change",
        badge: "Accelerated Pace",
        simpleExplanation: "Rapid AI adoption and widespread process automation across industries requiring fast reskilling.",
      },
    },
  },
  ms: {
    sectionTitle: "Terokai Masa Depan Kerjaya Anda",
    sectionSubtitle: "Ketahui bagaimana senario industri berbeza boleh mempengaruhi sektor kerjaya.",
    simulationBadge: "MODEL SIMULASI",
    scenarioSelectorTitle: "1. Pilih Senario Penerimaan AI",
    sectorSelectorTitle: "2. Pilih Sektor Industri",
    selectSectorPlaceholder: "Pilih industri...",
    resetButton: "Tetapkan Semula",
    resultPrefix: "Di bawah senario",
    resultFor: ", model menganggarkan perubahan",
    projectedChange: "untuk",
    demandExpanding: "Permintaan dijangka meningkat dalam senario ini",
    demandSlowing: "Permintaan dijangka perlahan dalam senario ini",
    whatDoesThisMeanTitle: "Apakah Maksudnya untuk Anda?",
    whatDoesThisMeanText: (scenarioName, sector, pctStr, isPositive) =>
      `Dalam senario ${scenarioName}, permintaan majikan bagi sektor ${sector} dianggarkan beralih sebanyak ${pctStr}. ${
        isPositive
          ? "Ini menunjukkan penggunaan teknologi dijangka membuka peluang baharu dan aliran kerja digital dalam bidang ini."
          : "Ini menunjukkan automasi mungkin menyusun semula tugasan berulang, mendorong graduan meningkatkan kemahiran ke peringkat lebih tinggi."
      }`,
    notAGuaranteeNotice:
      "Penting: Simulasi ini menganggarkan trend tugasan makroekonomi dan teknologi berdasarkan penyelidikan empirikal. Ia bertujuan sebagai panduan persediaan kerjaya dan bukannya jaminan penawaran pekerjaan masa hadapan.",
    compareButton: "Bandingkan Kesemua 3 Senario untuk Sektor Ini",
    compareHideButton: "Sembunyikan Perbandingan",
    howCalculatedTitle: "Bagaimanakah Ini Dikira?",
    methodologyTitle: "Metodologi Pengiraan",
    methodologyText:
      "Kadar pertumbuhan sektor mewakili purata unjuran perubahan permintaan bagi kesemua 240 pekerjaan MASCO dalam sektor tersebut. Skor setiap pekerjaan menggabungkan pendedahan tugasan, potensi augmentasi, dan isyarat pasaran buruh asas.",
    assumptionsTitle: "Andaian Senario Semasa",
    dataSourceTitle: "Sumber Data",
    dataPeriodTitle: "Tempoh Pengukuran",
    classificationTitle: "Klasifikasi Data",
    classificationValue: "Klasifikasi Pekerjaan Rasmi (MASCO 2020 / MyCOL) + Model Senario Ditentukur",
    unavailableText: "Maklumat tidak tersedia dalam metadata yang diterbitkan.",
    scenarios: {
      baseline: {
        name: "Perubahan Rendah",
        badge: "Kadar Berhati-hati",
        simpleExplanation: "Penerimaan teknologi secara beransur-ansur dengan kadar adaptasi perusahaan yang berhati-hati.",
      },
      moderate: {
        name: "Perubahan Sederhana",
        badge: "Kadar Stabil",
        simpleExplanation: "Transformasi digital berterusan dengan keseimbangan antara automasi dan peningkatan kemahiran.",
      },
      fast: {
        name: "Perubahan Tinggi",
        badge: "Kadar Pantas",
        simpleExplanation: "Penggunaan AI secara agresif dan automasi pantas merentasi industri yang menuntut pembelajaran tangkas.",
      },
    },
  },
  zh: {
    sectionTitle: "探索您的职业未来",
    sectionSubtitle: "了解不同行业情境将如何影响各大职业领域的未来发展。",
    simulationBadge: "模拟模型",
    scenarioSelectorTitle: "1. 选择人工智能演进情境",
    sectorSelectorTitle: "2. 选择行业领域",
    selectSectorPlaceholder: "选择行业...",
    resetButton: "重置选择",
    resultPrefix: "在",
    resultFor: "情境下，该模型预计",
    projectedChange: "的岗位需求将变化",
    demandExpanding: "在此情境下需求持续扩大",
    demandSlowing: "在此情境下需求增长放缓",
    whatDoesThisMeanTitle: "这对我意味着什么？",
    whatDoesThisMeanText: (scenarioName, sector, pctStr, isPositive) =>
      `在${scenarioName}情境下，雇主对【${sector}】领域的需求预计将调整 ${pctStr}。${
        isPositive
          ? "这表明技术应用预计将为该领域创造更多全新工作流、数字化机遇与高价值岗位。"
          : "这表明部分重复性任务可能会被自动化整合，鼓励毕业生尽早向高附加值复合技能方向进修升级。"
      }`,
    notAGuaranteeNotice:
      "重要声明：本模拟基于实证研究评估宏观经济与技术任务趋势，专为大学生就业规划与技能储备提供参考，绝非对未来特定职位聘用的绝对保证。",
    compareButton: "对比该领域的全部三种情境",
    compareHideButton: "隐藏对比",
    howCalculatedTitle: "这项指标是如何计算的？",
    methodologyTitle: "计算方法",
    methodologyText:
      "各行业增长率代表该领域下所有 240 个 MASCO 官方标准职业的平均预期需求变化。每个职业的评分均综合了实证任务暴露度、AI 增强潜力及基准劳动力市场信号。",
    assumptionsTitle: "当前情境核心假设",
    dataSourceTitle: "数据来源",
    dataPeriodTitle: "观测与预测周期",
    classificationTitle: "数据分类",
    classificationValue: "实证劳动力标准（MASCO 2020 / MyCOL）+ 校准情境模型",
    unavailableText: "已发布元数据中暂未收录此项。",
    scenarios: {
      baseline: {
        name: "低度变化",
        badge: "谨慎渐进",
        simpleExplanation: "技术应用较为稳健渐进，企业采用保守策略，保持传统技能格局。",
      },
      moderate: {
        name: "中度变化",
        badge: "稳步推进",
        simpleExplanation: "数字化转型稳步推进，在任务自动化与员工技能培训间保持平衡。",
      },
      fast: {
        name: "高度变化",
        badge: "飞速演进",
        simpleExplanation: "AI 快速渗透全行业流程，自动化普及要求毕业生具备极高适应力与敏捷学习能力。",
      },
    },
  },
};

export function CareerScenarioExplorer() {
  const q = useCompareScenarios();
  const [lang, setLang] = useState<ExplorerLang>("en");
  const [selectedScenario, setSelectedScenario] = useState<Scenario>("baseline");
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [showComparison, setShowComparison] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  if (q.isLoading) return <Skel className="h-96" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const t = I18N[lang];
  const sectors = q.data.sectors;
  const activeSectorName = selectedSector || sectors[0]?.sector || "AI, Data & Cloud Technology";
  const currentSectorData = sectors.find((s) => s.sector === activeSectorName) || sectors[0];

  const scenarioMeta = q.data.scenarios.find((s) => s.scenario === selectedScenario);
  const scenarioAssumption = scenarioMeta?.assumptions || t.unavailableText;

  // Retrieve calculated percentage from the existing data without altering formulas
  const getValue = (s: Scenario, row: typeof currentSectorData) => {
    if (!row) return 0;
    if (s === "baseline") return row.baselineChangePct;
    if (s === "moderate") return row.moderateChangePct;
    return row.fastChangePct;
  };

  const activeValue = getValue(selectedScenario, currentSectorData);
  const isPositive = activeValue >= 0;
  const pctStr = `${activeValue > 0 ? "+" : ""}${activeValue.toFixed(1)}%`;

  const handleReset = () => {
    setSelectedScenario("baseline");
    setSelectedSector(sectors[0]?.sector || "");
    setShowComparison(false);
  };

  const scenarioKeys: Scenario[] = ["baseline", "moderate", "fast"];

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all sm:p-7" data-testid="career-scenario-explorer">
      {/* Header and Language Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Compass className="h-3 w-3" />
              {t.simulationBadge}
            </span>
          </div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {t.sectionSubtitle}
          </p>
        </div>

        {/* Language selector */}
        <div className="flex items-center self-start rounded-full border border-border/70 bg-muted/40 p-1 text-xs">
          {(["en", "ms", "zh"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={cn(
                "rounded-full px-3 py-1 font-semibold transition-all",
                lang === code
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`button-explorer-lang-${code}`}
            >
              {code === "en" ? "EN" : code === "ms" ? "BM" : "中文"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Controls */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Scenario & Sector Pickers */}
        <div className="space-y-5 lg:col-span-5">
          {/* A. Scenario Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.scenarioSelectorTitle}
            </label>
            <div className="mt-2.5 space-y-2.5" role="radiogroup" aria-label="Scenario selector">
              {scenarioKeys.map((scKey) => {
                const scInfo = t.scenarios[scKey];
                const isSelected = selectedScenario === scKey;
                return (
                  <button
                    key={scKey}
                    type="button"
                    onClick={() => setSelectedScenario(scKey)}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left transition-all",
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30"
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/40",
                    )}
                    data-testid={`button-scenario-${scKey}`}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border text-[9px]",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {isSelected && "✓"}
                        </span>
                        <span className="font-semibold text-sm text-foreground">{scInfo.name}</span>
                      </div>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {scInfo.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground">
                      {scInfo.simpleExplanation}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Sector Selector */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="sector-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.sectorSelectorTitle}
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
                data-testid="button-explorer-reset"
              >
                <RotateCcw className="h-3 w-3" />
                {t.resetButton}
              </button>
            </div>
            <div className="relative mt-2">
              <select
                id="sector-select"
                value={activeSectorName}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border/80 bg-card px-4 py-3 pr-10 text-sm font-semibold text-foreground shadow-xs transition focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                data-testid="select-industry-sector"
              >
                {sectors.map((s) => (
                  <option key={s.sector} value={s.sector}>
                    {s.sector}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Right Column: C. Main Result Card & D. What Does This Mean? */}
        <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
          {/* Main Result Card */}
          <motion.div
            key={`${selectedScenario}-${activeSectorName}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-card to-white p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-card"
            data-testid="main-result-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {t.scenarios[selectedScenario].name} {lang === "en" ? "Scenario" : ""}
                </span>
                <h3 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">
                  {activeSectorName}
                </h3>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-lg font-bold sm:text-xl",
                  isPositive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
                )}
                data-testid="result-percentage"
              >
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {pctStr}
              </span>
            </div>

            {/* Clean visual representation bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  {isPositive ? t.demandExpanding : t.demandSlowing}
                </span>
                <span className="font-mono font-semibold">{pctStr}</span>
              </div>
              <div className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(8, Math.abs(activeValue) * 10))}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full transition-all",
                    isPositive ? "bg-blue-600 dark:bg-blue-500" : "bg-amber-500",
                  )}
                />
              </div>
            </div>

            {/* Plain-language explanation statement */}
            <div className="mt-4 rounded-xl border border-blue-100 bg-white/80 p-3.5 text-xs leading-relaxed text-foreground/80 dark:border-blue-900/30 dark:bg-card/60 sm:text-sm">
              <p>
                {t.resultPrefix} <strong>{t.scenarios[selectedScenario].name}</strong> {t.resultFor}{" "}
                <strong className={isPositive ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"}>
                  {pctStr}
                </strong>{" "}
                {t.projectedChange} <strong>{activeSectorName}</strong>.
              </p>
            </div>

            {/* D. What Does This Mean? */}
            <div className="mt-5 border-t border-border/60 pt-4">
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                {t.whatDoesThisMeanTitle}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {t.whatDoesThisMeanText(t.scenarios[selectedScenario].name, activeSectorName, pctStr, isPositive)}
              </p>
              <p className="mt-2 text-[11px] italic leading-normal text-muted-foreground/80">
                {t.notAGuaranteeNotice}
              </p>
            </div>
          </motion.div>

          {/* E. Optional Comparison: Compare All Scenarios */}
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <button
              type="button"
              onClick={() => setShowComparison(!showComparison)}
              className="flex w-full items-center justify-between text-xs font-semibold text-primary hover:underline"
              data-testid="button-toggle-comparison"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {showComparison ? t.compareHideButton : t.compareButton}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", showComparison ? "rotate-180" : "")}
              />
            </button>

            <AnimatePresence>
              {showComparison && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                  data-testid="scenario-comparison-panel"
                >
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                    {scenarioKeys.map((scKey) => {
                      const val = getValue(scKey, currentSectorData);
                      const isScPos = val >= 0;
                      const scPct = `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
                      const isCur = selectedScenario === scKey;
                      return (
                        <div
                          key={scKey}
                          className={cn(
                            "rounded-lg border p-3 text-center transition-all",
                            isCur
                              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                              : "border-border/60 bg-muted/20",
                          )}
                        >
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {t.scenarios[scKey].name}
                          </span>
                          <div
                            className={cn(
                              "font-mono mt-1 text-base font-bold",
                              isScPos ? "text-blue-600 dark:text-blue-400" : "text-amber-600",
                            )}
                          >
                            {scPct}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 4. Transparency: How Was This Calculated? */}
      <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-4">
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex w-full items-center justify-between text-left text-xs font-semibold text-foreground hover:text-primary"
          data-testid="button-toggle-methodology"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            {t.howCalculatedTitle}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showMethodology ? "rotate-180" : "")}
          />
        </button>

        <AnimatePresence>
          {showMethodology && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              data-testid="methodology-details"
            >
              <div className="mt-3.5 space-y-3 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                <div>
                  <strong className="text-foreground">{t.methodologyTitle}:</strong>{" "}
                  {t.methodologyText}
                </div>
                <div>
                  <strong className="text-foreground">{t.assumptionsTitle}:</strong>{" "}
                  {scenarioAssumption}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-card p-2.5">
                    <span className="font-semibold text-foreground">{t.dataSourceTitle}:</span>
                    <p className="mt-0.5 text-[11px]">MASCO 2020 (MOHR), MyCOL (TalentCorp), eMASCO</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-2.5">
                    <span className="font-semibold text-foreground">{t.dataPeriodTitle}:</span>
                    <p className="mt-0.5 text-[11px]">2024 to 2026/2027 Macro Scenario Horizon</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-2.5">
                    <span className="font-semibold text-foreground">{t.classificationTitle}:</span>
                    <p className="mt-0.5 text-[11px]">{t.classificationValue}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

