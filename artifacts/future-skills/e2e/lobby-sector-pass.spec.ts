import { expect, test, devices } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";

type Sector = {
  name: string;
  occupationCount: number;
  averageChangePct: number;
  featuredOccupationId: string;
};

type Occupation = {
  title: string;
  mascoCode: string;
};

async function routeApi(page: import("@playwright/test").Page) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({ url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}` });
  });
}

test("sector hover and keyboard focus update the live lobby pass and left-origin bars", async ({ page }) => {
  await routeApi(page);
  const response = await page.request.get(`${apiBaseUrl}/api/sectors`);
  expect(response.ok()).toBeTruthy();
  const sectors = (await response.json()) as Sector[];
  expect(sectors.length).toBeGreaterThan(1);
  expect(sectors.every((sector) => sector.featuredOccupationId)).toBeTruthy();
  const ordered = [...sectors].sort((a, b) => b.averageChangePct - a.averageChangePct);
  const occupationFor = async (sector: Sector) => {
    const result = await page.request.get(`${apiBaseUrl}/api/occupations/${sector.featuredOccupationId}`);
    expect(result.ok()).toBeTruthy();
    return (await result.json()) as Occupation;
  };

  await page.goto("/");
  const rows = page.locator('button[data-testid^="button-sector-"]');
  await expect(rows).toHaveCount(sectors.length);
  const passRole = page.getByTestId("text-pass-role");

  await expect(page.getByRole("heading", { name: "Industries in Demand" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Industries in Demand" })).toBeVisible();
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  const firstSector = ordered[0];
  await expect(rows.first()).toHaveAccessibleName(
    `${firstSector.name}, ${firstSector.averageChangePct > 0 ? "+" : ""}${firstSector.averageChangePct.toFixed(1)}% average projected demand change, ${firstSector.occupationCount} occupations`,
  );
  await expect(passRole).toHaveText((await occupationFor(ordered[0])).title);

  const firstTrack = rows.first().locator(".industry-demand-track");
  const trackBox = await firstTrack.boundingBox();
  const fillBox = await firstTrack.locator("span").boundingBox();
  expect(trackBox).not.toBeNull();
  expect(fillBox).not.toBeNull();
  expect(Math.abs(trackBox!.x - fillBox!.x)).toBeLessThanOrEqual(1);
  expect(fillBox!.width).toBeGreaterThan(0);

  await rows.nth(2).hover();
  await expect(rows.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(rows.nth(2).locator(".industry-name-track")).toHaveCSS("animation-name", "industry-name-reveal");
  await expect(rows.nth(2).locator(".industry-name-track")).toHaveText(ordered[2].name);
  await expect(passRole).toHaveText((await occupationFor(ordered[2])).title);

  await rows.first().focus();
  await page.keyboard.press("Tab");
  await expect(rows.nth(1)).toBeFocused();
  await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(rows.nth(1).locator(".industry-name-track")).toHaveCSS("animation-name", "industry-name-reveal");
  await expect(passRole).toHaveText((await occupationFor(ordered[1])).title);

  await expect(page.getByTestId("text-pass-name")).toHaveText("YOU");
  await expect(page.getByTestId("text-pass-score")).toHaveText("--");
  await expect(page.getByTestId("text-pass-masco")).toHaveText((await occupationFor(ordered[1])).mascoCode);
});

test("desktop sector list scrolls independently beside a height-matched role preview", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await routeApi(page);
  const response = await page.request.get(`${apiBaseUrl}/api/sectors`);
  expect(response.ok()).toBeTruthy();
  const sectors = (await response.json()) as Sector[];
  await page.goto("/");

  const list = page.getByTestId("sector-list-scroll");
  const rows = page.locator('button[data-testid^="button-sector-"]');
  const heading = page.getByRole("heading", { name: "Industries in Demand" });
  const compareLink = page.getByTestId("link-sectors-radar");
  const sectorColumn = page.getByTestId("sector-overview-column");
  const rolePreview = page.getByTestId("sector-role-preview");

  await expect(rows).toHaveCount(sectors.length);
  await expect(list).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(compareLink).toBeVisible();
  await expect.poll(() => list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();

  const heights = await Promise.all([
    sectorColumn.evaluate((element) => element.getBoundingClientRect().height),
    rolePreview.evaluate((element) => element.getBoundingClientRect().height),
  ]);
  expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1);

  await list.hover();
  await page.mouse.wheel(0, 420);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(heading).toBeVisible();
  await expect(compareLink).toBeVisible();

  await list.evaluate((element) => { element.scrollTop = 0; });
  await list.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test("touch selection works on a narrow reduced-motion viewport", async ({ browser }) => {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await routeApi(page);
    const response = await page.request.get(`${apiBaseUrl}/api/sectors`);
    expect(response.ok()).toBeTruthy();
    const sectors = (await response.json()) as Sector[];
    const ordered = [...sectors].sort((a, b) => b.averageChangePct - a.averageChangePct);
    await page.goto("http://127.0.0.1:25893/");

    const rows = page.locator('button[data-testid^="button-sector-"]');
    const list = page.getByTestId("sector-list-scroll");
    await expect(rows).toHaveCount(sectors.length);
    await expect(list).toBeVisible();
    const listDimensions = await list.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(listDimensions.scrollHeight).toBeLessThanOrEqual(listDimensions.clientHeight + 1);

    const lastRow = rows.last();
    const lastSector = ordered[ordered.length - 1];
    await lastRow.scrollIntoViewIfNeeded();
    const bounds = await lastRow.boundingBox();
    expect(bounds).not.toBeNull();
    await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(lastRow).toHaveAttribute("aria-pressed", "true");
    await expect(lastRow).toHaveAttribute("data-name-revealed", "true");
    await expect(lastRow.locator(".industry-name-track")).toHaveCSS("animation-name", "none");
    await expect(lastRow.locator(".industry-name-track")).toHaveCSS("white-space", "normal");
    await expect(lastRow.locator(".industry-name-track")).toHaveText(lastSector.name);

    const roleResponse = await page.request.get(`${apiBaseUrl}/api/occupations/${lastSector.featuredOccupationId}`);
    const occupation = (await roleResponse.json()) as Occupation;
    await expect(page.getByTestId("text-pass-role")).toHaveText(occupation.title);
    const fill = lastRow.locator(".industry-demand-track > span");
    await expect(fill).toHaveCSS("transition-duration", "0s");

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  } finally {
    await context.close();
  }
});

test("tablet touch selection reveals the industry name and keeps demand values visible", async ({ browser }) => {
  const context = await browser.newContext({
    ...devices["iPad (gen 7)"],
  });
  const page = await context.newPage();
  try {
    await routeApi(page);
    const response = await page.request.get(`${apiBaseUrl}/api/sectors`);
    expect(response.ok()).toBeTruthy();
    const sectors = (await response.json()) as Sector[];
    const ordered = [...sectors].sort((a, b) => b.averageChangePct - a.averageChangePct);
    await page.goto("http://127.0.0.1:25893/");

    const rows = page.locator('button[data-testid^="button-sector-"]');
    const lastRow = rows.last();
    const lastSector = ordered[ordered.length - 1];
    await expect(rows).toHaveCount(sectors.length);
    await lastRow.scrollIntoViewIfNeeded();
    const bounds = await lastRow.boundingBox();
    expect(bounds).not.toBeNull();
    await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

    await expect(lastRow).toHaveAttribute("aria-pressed", "true");
    await expect(lastRow).toHaveAttribute("data-name-revealed", "true");
    await expect(lastRow.locator(".industry-name-track")).toHaveCSS("animation-name", "industry-name-reveal");
    await expect(lastRow.locator(".industry-name-track")).toHaveText(lastSector.name);
    await expect(lastRow.locator(".font-data")).toHaveText(`${lastSector.averageChangePct > 0 ? "+" : ""}${lastSector.averageChangePct.toFixed(1)}%`);

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  } finally {
    await context.close();
  }
});

test("role pass shows loading and service-error states instead of invented role details", async ({ page }) => {
  let releaseOccupation!: () => void;
  const occupationRequest = new Promise<void>((resolve) => { releaseOccupation = resolve; });
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.startsWith("/api/occupations/")) await occupationRequest;
    await route.continue({ url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}` });
  });

  await page.goto("/");
  const rows = page.locator('button[data-testid^="button-sector-"]');
  await expect(rows.first()).toBeVisible();
  await expect(page.getByTestId("skeleton-role-pass")).toBeVisible();
  releaseOccupation();
  await expect(page.getByTestId("text-pass-name")).toHaveText("YOU");
  await expect(page.getByTestId("text-pass-role")).not.toBeEmpty();

  await page.route("**/api/occupations/**", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Role data unavailable" }) });
  });
  await rows.nth(3).hover();
  await expect(page.getByTestId("status-error")).toBeVisible();
  await expect(page.getByTestId("text-pass-role")).toHaveCount(0);
});
