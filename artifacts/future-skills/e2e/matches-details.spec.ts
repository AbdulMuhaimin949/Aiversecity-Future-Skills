import { expect, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";

type SampleProfile = {
  profileId: string;
  education: string;
  yearsExperience: number;
  interestSectors: string[];
  weeklyLearningHours: number;
  skills: { skillId: string; name: string; category: string; proficiency: number }[];
};

type CatalogueSkill = { skillId: string; name: string; category: string };

async function routeApi(page: import("@playwright/test").Page) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({ url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}` });
  });
}

test("match summaries, score factors, grouped skills and source context work on mobile", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await routeApi(page);
    const profilesResponse = await page.request.get(`${apiBaseUrl}/api/sample-profiles`);
    expect(profilesResponse.ok()).toBeTruthy();
    const profiles = (await profilesResponse.json()) as SampleProfile[];
    const sample = profiles.find((profile) => profile.profileId === "CV_0001");
    expect(sample).toBeTruthy();

    const storedProfile = {
      skills: sample!.skills.map(({ skillId, name, category, proficiency }) => ({ skillId, name, category, proficiency })),
      educationLevel: sample!.education,
      yearsExperience: sample!.yearsExperience,
      interestSectors: sample!.interestSectors,
      weeklyLearningHours: sample!.weeklyLearningHours,
      label: `Synthetic persona ${sample!.profileId}`,
    };
    await page.addInitScript((profile) => localStorage.setItem("afs.profile", JSON.stringify(profile)), storedProfile);
    await page.goto("/matches");

    const spotlightHighlights = page.locator('[data-testid^="list-highlights-spotlight-"]');
    await expect(spotlightHighlights).toBeVisible();
    await expect(spotlightHighlights.locator(":scope > li")).toHaveCount(3);
    await expect(spotlightHighlights).toContainText("Skills");
    await expect(spotlightHighlights).toContainText("Demand");
    await expect(spotlightHighlights).toContainText("Next steps");
    await expect(page.getByTestId(/^metric-ai-risk$/)).toBeVisible();
    await expect(page.getByTestId(/^metric-job-safety$/)).toBeVisible();
    await expect(page.getByTestId(/^metric-demand-forecast$/)).toBeVisible();
    const scoreDetails = page.getByTestId(/^details-score-method-/).first();
    await expect(scoreDetails).not.toHaveAttribute("open", "");
    await expect(page.getByText(/factor score · .*% weight/i)).toBeHidden();
    await scoreDetails.locator("summary").click();
    await expect(scoreDetails).toContainText("% weight");

    const secondSpotlightTab = page.getByTestId("tab-top-2");
    await secondSpotlightTab.click();
    await expect(secondSpotlightTab).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("text-spotlight-title")).toHaveText(await secondSpotlightTab.locator("span").nth(1).innerText());

    const spotlightBreakdown = page.locator('section[aria-label$="match score breakdown"]').first();
    await expect(spotlightBreakdown.getByRole("progressbar")).toHaveCount(4);

    const firstCard = page.locator('li[data-testid^="card-match-"]').first();
    const toggle = firstCard.getByTestId(/^button-expand-/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await expect(firstCard.getByRole("heading", { name: "Skill gaps" })).toBeVisible();
    await expect(firstCard.getByRole("heading", { name: /Required skills to improve/ })).toBeVisible();
    await expect(firstCard.getByRole("heading", { name: /Preferred skills to improve/ })).toBeVisible();
    await expect(firstCard.getByRole("heading", { name: "Skills already on your profile" })).toBeVisible();
    await expect(firstCard.getByText("Current", { exact: false }).first()).toBeVisible();
    await expect(firstCard.getByText("Microservices & Event-Driven Systems", { exact: true })).toBeVisible();

    const secondCard = page.locator('li[data-testid^="card-match-"]').nth(1);
    await secondCard.getByRole("button").click();
    await expect(secondCard.getByTestId(/^list-highlights-details-/)).toBeVisible();
    await expect(secondCard.getByRole("heading", { name: "How your match score is built" })).toBeVisible();

    const contextDisclosure = firstCard.getByTestId(/^details-context-/);
    await contextDisclosure.locator("summary").click();
    await expect(contextDisclosure).toContainText("Forecast evidence references");
    await expect(contextDisclosure.locator("li")).toHaveCount(5);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  } finally {
    await context.close();
  }
});

test("roles with no skill gaps show an explicit zero-gap state", async ({ page }) => {
  await routeApi(page);
  const [profilesResponse, skillsResponse] = await Promise.all([
    page.request.get(`${apiBaseUrl}/api/sample-profiles`),
    page.request.get(`${apiBaseUrl}/api/skills`),
  ]);
  expect(profilesResponse.ok()).toBeTruthy();
  expect(skillsResponse.ok()).toBeTruthy();
  const profiles = (await profilesResponse.json()) as SampleProfile[];
  const allSkills = (await skillsResponse.json()) as CatalogueSkill[];
  const sectors = [...new Set(profiles.flatMap((profile) => profile.interestSectors))];
  const fullProfile = {
    skills: allSkills.map(({ skillId, name, category }) => ({ skillId, name, category, proficiency: 5 })),
    educationLevel: "Master/PhD",
    yearsExperience: 50,
    interestSectors: sectors,
    weeklyLearningHours: 60,
    label: "All catalogue skills",
  };
  await page.addInitScript((profile) => localStorage.setItem("afs.profile", JSON.stringify(profile)), fullProfile);
  await page.goto("/matches");

  const highlights = page.locator('[data-testid^="list-highlights-spotlight-"]');
  await expect(highlights).toContainText("0 skill gaps");
  const firstCard = page.locator('li[data-testid^="card-match-"]').first();
  await firstCard.getByRole("button").click();
  await expect(firstCard.getByText("No required skill gaps.", { exact: true })).toBeVisible();
  await expect(firstCard.getByText("No preferred skill gaps.", { exact: true })).toBeVisible();
});
