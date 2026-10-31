import { expect, test } from "@playwright/test";
import { formatDateDDMMYYYY } from "../src/lib/utils";

const apiBaseUrl = "http://127.0.0.1:8080";
const scenarios = ["baseline", "moderate", "fast"] as const;
const scenarioLabels = {
  baseline: "Low Impact",
  moderate: "Moderate Impact",
  fast: "High Impact",
} as const;

type Scenario = (typeof scenarios)[number];
type OccupationResponse = {
  aiExposure: number;
  aiAugmentation: number;
  history: { date: string; value: number }[];
  forecasts: {
    scenario: Scenario;
    label: string;
    projectedIndex: number;
    changePct: number;
    lower90: number;
    upper90: number;
  }[];
  forecastTargetDate: string;
};

function formatMetric(value: number) {
  const rounded = Math.abs(value) >= 100 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

test("date-only ISO values retain their calendar day in the shared display format", () => {
  expect(formatDateDDMMYYYY("2026-09-30")).toBe("30/09/2026");
  expect(formatDateDDMMYYYY("2026-09-30T00:00:00.000Z")).toBe("30/09/2026");
  expect(formatDateDDMMYYYY("2026-02-30")).toBe("2026-02-30");
});

test("role demand metric, forecast cards, chart endpoints, and uncertainty follow the selected API scenario", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("afs.scenario", JSON.stringify("baseline"));
  });
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({
      url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
    });
  });

  await page.goto("/radar");
  const roleLink = page.locator('a[data-testid^="link-role-"]').first();
  await expect(roleLink).toBeVisible();
  const roleUrl = new URL((await roleLink.getAttribute("href"))!, page.url());
  const occupationId = roleUrl.pathname.split("/").pop()!;
  const response = await page.request.get(`${apiBaseUrl}/api/occupations/${occupationId}`);
  expect(response.ok()).toBeTruthy();
  const occupation = (await response.json()) as OccupationResponse;

  expect(occupation.forecasts.map((forecast) => forecast.scenario).sort()).toEqual([...scenarios].sort());
  for (const forecast of occupation.forecasts) {
    expect(forecast.label).toBe(scenarioLabels[forecast.scenario]);
  }
  expect(occupation.history.length).toBeGreaterThan(0);

  await page.goto(`${roleUrl.pathname}${roleUrl.search}`);
  await expect(page.getByTestId("text-role-title")).toBeVisible();
  await expect(page.getByTestId("section-ai-disruption")).toBeVisible();
  await expect(page.getByTestId("section-ai-disruption")).not.toContainText(/wage velocity|skill transfer|task resilience|automation shield/i);
  await expect(page.getByTestId("button-analysis-metric-exposure")).toContainText(`${(occupation.aiExposure * 100).toFixed(1)}%`);
  await expect(page.getByTestId("button-analysis-metric-augmentation")).toContainText(`${(occupation.aiAugmentation * 100).toFixed(1)}%`);
  await page.getByTestId("button-analysis-metric-exposure").click();
  await expect(page.getByTestId("text-analysis-detail")).toContainText(`${(occupation.aiExposure * 100).toFixed(1)}%`);
  await page.getByTestId("button-analysis-metric-augmentation").click();
  await expect(page.getByTestId("text-analysis-detail")).toContainText(`${(occupation.aiAugmentation * 100).toFixed(1)}%`);
  await page.getByTestId("button-analysis-metric-demand").click();

  const chartTable = page.getByTestId("chart-data-table");
  await expect(chartTable).toBeAttached();
  await expect(chartTable.getByRole("columnheader", { name: "Date" })).toBeAttached();
  const historyRows = chartTable.getByTestId("chart-history-row");
  await expect(historyRows).toHaveCount(occupation.history.length);
  const history = [...occupation.history].sort((a, b) => a.date.localeCompare(b.date));
  for (const [index, observation] of history.entries()) {
    const row = historyRows.nth(index);
    await expect(row.locator("th")).toHaveText(formatDate(observation.date));
    await expect(row.locator("td").first()).toHaveText(observation.value.toFixed(2));
  }

  const forecastRow = chartTable.getByTestId("chart-forecast-row");
  await expect(forecastRow.locator("th")).toHaveText(formatDate(occupation.forecastTargetDate));
  await expect(page.getByText("Year", { exact: true })).toBeVisible();
  const yearTicks = page.locator(".recharts-xAxis .recharts-cartesian-axis-tick-value:visible");
  await expect(yearTicks.first()).toBeVisible();
  for (const tick of await yearTicks.allTextContents()) {
    expect(tick).toMatch(/^\d{4}$/);
  }
  for (const scenario of scenarios) {
    await expect(chartTable.getByTestId(`chart-series-${scenario}`)).toBeAttached();
    const forecast = occupation.forecasts.find((item) => item.scenario === scenario)!;
    const columnIndex = scenarios.indexOf(scenario) + 1;
    await expect(forecastRow.locator("td").nth(columnIndex)).toHaveText(forecast.projectedIndex.toFixed(2));
  }

  for (const scenario of scenarios) {
    const forecast = occupation.forecasts.find((item) => item.scenario === scenario)!;
    await page.getByTestId(`button-scenario-${scenario}`).click();
    await expect(page.getByTestId(`button-scenario-${scenario}`)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("text-role-scenario")).toContainText(forecast.label);
    await expect(page.getByTestId("metric-demand")).toContainText(formatMetric(forecast.changePct));
    await expect(page.getByTestId(`button-forecast-${scenario}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`button-forecast-${scenario}`)).toContainText(forecast.projectedIndex.toFixed(1));
    await expect(page.getByTestId(`button-forecast-${scenario}`)).toContainText(`${forecast.lower90.toFixed(1)} – ${forecast.upper90.toFixed(1)}`);
    await expect(page.getByTestId(`button-analysis-scenario-${scenario}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(`button-analysis-metric-demand`)).toContainText(formatMetric(forecast.changePct));
    await expect(page.getByTestId("text-analysis-detail")).toContainText(formatMetric(forecast.changePct));
    await expect(forecastRow.locator("td").nth(4)).toHaveText(forecast.lower90.toFixed(2));
    await expect(forecastRow.locator("td").nth(5)).toHaveText(forecast.upper90.toFixed(2));
    await expect(page.getByTestId(`chart-line-${scenario}`)).toBeAttached();
  }

  const fastForecast = occupation.forecasts.find((item) => item.scenario === "fast")!;
  await page.getByTestId("button-analysis-scenario-fast").click();
  await expect(page.getByTestId("button-scenario-fast")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("metric-demand")).toContainText(formatMetric(fastForecast.changePct));
  await expect(page.getByTestId("button-forecast-fast")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("button-forecast-baseline").click();
  await expect(page.getByTestId("button-scenario-baseline")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("button-forecast-baseline")).toHaveAttribute("aria-pressed", "true");

  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByText("Year", { exact: true })).toBeVisible();
  const chartBox = await page.locator('[data-testid="section-demand-chart"] .recharts-wrapper').boundingBox();
  expect(chartBox).not.toBeNull();
  expect(chartBox!.x + chartBox!.width).toBeLessThanOrEqual(360);
});

test("scenario switch is keyboard accessible and stays within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({
      url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
    });
  });
  await page.goto("/radar");

  const group = page.getByRole("radiogroup", { name: "AI disruption scenario" });
  const baseline = page.getByTestId("button-scenario-baseline");
  const moderate = page.getByTestId("button-scenario-moderate");
  await expect(group).toBeVisible();
  await expect(baseline).toHaveJSProperty("tabIndex", 0);
  await expect(moderate).toHaveJSProperty("tabIndex", -1);

  await baseline.focus();
  await page.keyboard.press("ArrowRight");
  await expect(moderate).toHaveAttribute("aria-checked", "true");
  await expect(moderate).toHaveJSProperty("tabIndex", 0);
  await expect(moderate).toBeFocused();

  const bounds = await group.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
});
