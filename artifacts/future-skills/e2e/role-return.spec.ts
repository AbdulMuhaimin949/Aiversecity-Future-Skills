import { expect, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("afs.profile")) {
      localStorage.setItem(
        "afs.profile",
        JSON.stringify({
          skills: [],
          educationLevel: "Bachelor",
          yearsExperience: 0,
          interestSectors: [],
          weeklyLearningHours: 5,
          label: "Navigation test profile",
        }),
      );
    }
  });

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({
      url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
    });
  });
});

test("Radar role details return to Radar; Matches details return to Matches", async ({ page }) => {
  await page.goto("/radar");
  let risingRole: { id: string; title: string } | undefined;

  for (const columnTitle of ["Rising roles", "Slowing roles"]) {
    const column = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: columnTitle, exact: true }),
      });
    const roleLink = column.locator('a[data-testid^="link-role-"]').first();
    await expect(roleLink).toBeVisible();

    const title = (await roleLink.locator("h3").first().textContent())?.trim();
    const roleUrl = new URL((await roleLink.getAttribute("href"))!, page.url());
    expect(roleUrl.searchParams.get("from")).toBe("radar");
    if (columnTitle === "Rising roles") {
      risingRole = { id: roleUrl.pathname.split("/").pop()!, title: title! };
    }
    await roleLink.click();

    await expect(page.getByTestId("text-role-title")).toHaveText(title!);
    await expect(page.getByTestId("link-back")).toHaveText(/Back to Radar/);
    await expect(page.getByTestId("link-back")).toHaveAttribute("href", "/radar");

    const roleId = roleUrl.pathname.split("/").pop()!;
    await expect(page).toHaveURL(new RegExp(`/roles/${roleId}\\?from=radar$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/radar$/);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/roles/${roleId}\\?from=radar$`));

    await page.getByTestId("link-back").click();
    await expect(page).toHaveURL(/\/radar$/);
  }

  expect(risingRole).toBeDefined();
  const occupationResponse = await page.request.get(
    `${apiBaseUrl}/api/occupations/${risingRole!.id}`,
  );
  expect(occupationResponse.ok()).toBeTruthy();
  const occupation = (await occupationResponse.json()) as {
    sector: string;
    skills: {
      skillId: string;
      name: string;
      category: string;
      requiredProficiency: number;
    }[];
  };
  await page.evaluate((profile) => {
    localStorage.setItem("afs.profile", JSON.stringify(profile));
  }, {
    skills: occupation.skills.map((skill) => ({
      skillId: skill.skillId,
      name: skill.name,
      category: skill.category,
      proficiency: skill.requiredProficiency,
    })),
    educationLevel: "Bachelor",
    yearsExperience: 10,
    interestSectors: [occupation.sector],
    weeklyLearningHours: 5,
    label: "Navigation test profile",
  });

  await page.goto("/matches");
  const matchingCard = page.getByTestId(`card-match-${risingRole!.id}`);
  await expect(matchingCard).toBeVisible();
  const matchDetailLink = page.getByTestId(`link-detail-${risingRole!.id}`);
  if (!(await matchDetailLink.isVisible())) {
    await page.getByTestId(`button-expand-${risingRole!.id}`).click();
  }
  await expect(matchDetailLink).toBeVisible();
  await matchDetailLink.click();

  await expect(page.getByTestId("text-role-title")).toHaveText(risingRole!.title);
  await expect(page.getByTestId("link-back")).toHaveText(/Back to matches/);
  await expect(page.getByTestId("link-back")).toHaveAttribute("href", "/matches");

  await expect(page).toHaveURL(new RegExp(`/roles/${risingRole!.id}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/matches$/);
  await expect(matchingCard).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/roles/${risingRole!.id}$`));

  await page.getByTestId("link-back").click();
  await expect(page).toHaveURL(/\/matches$/);
});

test("Unknown role ID shows not-found with a way back to Radar", async ({ page }) => {
  await page.goto("/roles/does-not-exist-123");
  await expect(page.getByTestId("status-role-not-found")).toBeVisible();
  await expect(page.getByText("Role not found")).toBeVisible();
  await expect(page.getByTestId("link-not-found-matches")).toHaveAttribute("href", "/matches");
  await page.getByTestId("link-not-found-radar").click();
  await expect(page).toHaveURL(/\/radar$/);
});

test("Radar role search filters titles and sectors, clears, and survives scenario changes", async ({ page }) => {
  await page.goto("/radar");
  const search = page.getByTestId("input-radar-role-search");
  const roleLinks = page.locator('a[data-testid^="link-role-"]');
  await expect(roleLinks.first()).toBeVisible();
  const initialCount = await roleLinks.count();
  const firstRole = roleLinks.first();
  const title = (await firstRole.locator("h3").first().textContent())?.trim();
  const sectorLine = await firstRole.locator("p.truncate").textContent();
  const sector = sectorLine?.split(" · ")[0].trim();
  expect(title).toBeTruthy();
  expect(sector).toBeTruthy();

  await search.fill(title!.toUpperCase());
  await expect(roleLinks).toHaveCount(1);
  await expect(roleLinks.first()).toContainText(title!);

  await search.fill(sector!.toUpperCase());
  await expect(roleLinks.first()).toContainText(sector!);
  const sectorMatchCount = await roleLinks.count();
  expect(sectorMatchCount).toBeGreaterThan(0);
  expect(sectorMatchCount).toBeLessThan(initialCount);

  await search.fill("no-radar-role-matches-this-query");
  await expect(page.getByTestId("text-radar-role-search-results")).toContainText("No roles match your search");
  await expect(roleLinks).toHaveCount(0);
  await page.getByTestId("button-scenario-fast").click();
  await expect(search).toHaveValue("no-radar-role-matches-this-query");
  await expect(page.getByTestId("text-radar-role-search-results")).toContainText("No roles match your search");

  await page.getByTestId("button-clear-radar-role-search").click();
  await expect(search).toHaveValue("");
  await expect(roleLinks.first()).toBeVisible();
  expect(await roleLinks.count()).toBe(initialCount);
});

test("Radar rising and slowing lists scroll independently and fit a phone viewport", async ({ page }) => {
  await page.goto("/radar");
  const rising = page.getByTestId("scroll-up-roles");
  const slowing = page.getByTestId("scroll-down-roles");
  await expect(rising).toBeVisible();
  await expect(slowing).toBeVisible();
  expect(await rising.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await rising.evaluate((element) => element.clientHeight),
  );
  expect(await slowing.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await slowing.evaluate((element) => element.clientHeight),
  );

  await rising.focus();
  await rising.press("End");
  await expect.poll(() => rising.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await slowing.evaluate((element) => element.scrollTop)).toBe(0);

  await slowing.focus();
  await slowing.press("End");
  await expect.poll(() => slowing.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rising).toBeVisible();
  await expect(slowing).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
