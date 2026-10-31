import { expect, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";

type SectorScenarioRow = {
  sector: string;
  baselineChangePct: number;
  moderateChangePct: number;
  fastChangePct: number;
};

const scenarios = [
  { id: "baseline", label: "Low Impact", hint: "Today's hiring baseline" },
  { id: "moderate", label: "Moderate Impact", hint: "Quick adoption of automation" },
  { id: "fast", label: "High Impact", hint: "Rapid transformation across all sectors" },
] as const;

test("Radar trend and sector charts label their values and fit a phone viewport", async ({ page }) => {
  const response = await page.request.get(`${apiBaseUrl}/api/scenarios/compare`);
  expect(response.ok()).toBeTruthy();
  const comparison = (await response.json()) as {
    scenarios: { scenario: (typeof scenarios)[number]["id"]; label: string }[];
    sectors: SectorScenarioRow[];
  };
  expect(comparison.scenarios.map(({ scenario, label }) => [scenario, label])).toEqual([
    ["baseline", "Low Impact"],
    ["moderate", "Moderate Impact"],
    ["fast", "High Impact"],
  ]);
  const firstSector = comparison.sectors[0];
  expect(firstSector).toBeTruthy();

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    delete headers["if-none-match"];
    delete headers["if-modified-since"];
    await route.continue({
      url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
      headers,
    });
  });
  await page.goto("/radar");
  for (const scenario of scenarios) {
    const option = page.getByTestId(`button-scenario-${scenario.id}`);
    await expect(option.getByText(scenario.label, { exact: true })).toBeVisible();
    await expect(option.getByText(scenario.hint, { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("radar-bar-explainer")).toBeVisible();
  await expect(page.getByText(/AI Risk is how much AI may affect a role’s tasks/i)).toBeVisible();

  const trend = page.locator('a[data-testid^="link-role-"] svg[role="img"]').first();
  await expect(trend).toHaveAttribute("aria-label", /current baseline .* projected value .* 90% forecast range .* rising|slowing/i);
  const sectorChart = page.getByRole("heading", { name: "How sectors shift between scenarios" }).locator("..");
  const sectorRow = sectorChart.locator("ul > li").filter({
    has: page.getByRole("heading", { name: firstSector.sector, exact: true }),
  });
  await expect(sectorRow).toBeVisible();

  const values = [
    { name: "Low Impact", value: firstSector.baselineChangePct },
    { name: "Moderate Impact", value: firstSector.moderateChangePct },
    { name: "High Impact", value: firstSector.fastChangePct },
  ];
  for (const { name, value } of values) {
    const formatted = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    await expect(sectorRow).toContainText(formatted);
    await expect(sectorRow.getByRole("img", { name: new RegExp(`${name}: ${formatted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} projected demand change`) })).toBeVisible();
  }

  for (const scenario of scenarios.slice(1).concat(scenarios.slice(0, 1))) {
    const option = page.getByTestId(`button-scenario-${scenario.id}`);
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    const radarResponse = await page.request.get(`${apiBaseUrl}/api/radar?scenario=${scenario.id}`);
    expect(radarResponse.ok()).toBeTruthy();
    const radar = (await radarResponse.json()) as { scenario: string; scenarioLabel: string };
    expect(radar.scenario).toBe(scenario.id);
    expect(radar.scenarioLabel).toBe(scenario.label);
    await expect(page.getByTestId("card-scenario-meaning").last()).toContainText(scenario.label);
  }

  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  for (const scenario of scenarios) {
    await expect(page.getByTestId(`button-scenario-${scenario.id}`).getByText(scenario.hint, { exact: true })).toBeVisible();
  }
  await expect(sectorRow).toBeVisible();
});
