import { expect, test, devices } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";
const viewports = [
  { name: "narrow phone", width: 320, height: 740 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function routeApi(page: import("@playwright/test").Page) {
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
}

async function expectNoPageOverflow(page: import("@playwright/test").Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          testId: element.dataset.testid,
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter((element) => element.right > document.documentElement.clientWidth + 1 || element.left < -1)
      .slice(0, 8),
  }));
  expect(dimensions.scrollWidth, `viewport ${width}px; offending elements: ${JSON.stringify(dimensions.overflow)}`).toBeLessThanOrEqual(width);
}

test("core journeys fit phone, tablet, and desktop widths", async ({ page }) => {
  await routeApi(page);
  const skillsResponse = await page.request.get(`${apiBaseUrl}/api/skills`);
  expect(skillsResponse.ok()).toBeTruthy();
  const skills = (await skillsResponse.json()) as { skillId: string; name: string; category: string }[];
  const profile = {
    skills: skills.slice(0, 70).map((skill) => ({ ...skill, proficiency: 3 })),
    educationLevel: "Bachelor",
    yearsExperience: 4,
    interestSectors: [],
    weeklyLearningHours: 6,
    label: "Responsive check profile",
  };
  await page.addInitScript((storedProfile) => {
    localStorage.setItem("afs.profile", JSON.stringify(storedProfile));
  }, profile);

  const radarResponse = await page.request.get(`${apiBaseUrl}/api/radar?scenario=baseline`);
  expect(radarResponse.ok()).toBeTruthy();
  const radar = (await radarResponse.json()) as { roles: { occupationId: string }[] };
  const occupationId = radar.roles[0]?.occupationId;
  expect(occupationId).toBeTruthy();

  const pages: { path: string; marker: string }[] = [
    { path: "/", marker: "panel-lobby-dataset" },
    { path: "/profile", marker: "tab-cv" },
    { path: "/radar", marker: "radar-bar-explainer" },
    { path: "/matches", marker: "panel-spotlight" },
    { path: `/roles/${occupationId}`, marker: "text-role-title" },
    { path: `/pathway/${occupationId}`, marker: "link-back" },
    { path: "/sdgs", marker: "card-sdg-4" },
    { path: "/about", marker: "text-ai-disclosure" },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of pages) {
      await page.goto(route.path);
      await expect(page.getByTestId(route.marker), `${viewport.name}: ${route.path}`).toBeVisible();
      await expect(page.getByTestId("link-sdgs")).toBeVisible();
      await expect(page.getByTestId("link-about")).toBeVisible();
      if (route.path !== "/") {
        const stepLinks = page.locator('[data-testid="nav-steps"] a');
        await expect(stepLinks).toHaveCount(4);
        for (const link of await stepLinks.all()) {
          await expect(link).toBeVisible();
          const label = link.locator("span.font-display");
          await expect(label).not.toBeEmpty();
          const labelSize = await label.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
          expect(labelSize.scrollWidth, `${viewport.name}: clipped step label ${await label.textContent()}`).toBeLessThanOrEqual(labelSize.clientWidth + 1);
        }
      }
      await expectNoPageOverflow(page, viewport.width);
    }
  }
});

test("About source identifiers, titles, and metadata stay within their columns", async ({ page }) => {
  await routeApi(page);
  const sourceId = `SOURCE_${"LONG_IDENTIFIER_".repeat(8)}`;
  await page.route("**/api/sources", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: sourceId,
        name: "A long source title that remains readable beside a wrapped identifier",
        url: "https://example.test/source",
        sourceType: "REFERENCE_DATASET",
        publicationDate: "2026-10-15",
        retrievalDate: "2026-10-30",
        licenceNotes: "A long licence note that remains readable and wraps within the source details column.",
        verificationStatus: "VERIFIED",
        usedFor: ["Responsive browser test"],
      }]),
    });
  });

  const rowTestId = `row-source-${sourceId}`;
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/about");

    const row = page.getByTestId(rowTestId);
    const identifier = row.getByTestId("text-source-identifier");
    const details = row.getByTestId("column-source-details");
    const metadata = row.getByTestId("column-source-metadata");
    await expect(row).toBeVisible();
    await expect(row.getByTestId(`link-source-${sourceId}`)).toContainText("A long source title");
    await expect(row.getByTestId("status-verification")).toContainText("VERIFIED");
    await expect(row).toContainText("published 15/10/2026");
    await expect(row).toContainText("retrieved 30/10/2026");
    await expect(row).toContainText("A long licence note");

    const columns = await Promise.all([identifier, details, metadata].map((element) => element.boundingBox()));
    expect(columns.every(Boolean), `${viewport.name}: source columns should have layout boxes`).toBeTruthy();
    const [identifierBox, detailsBox, metadataBox] = columns as NonNullable<(typeof columns)[number]>[];
    const identifierWidth = await identifier.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(identifierWidth.scrollWidth, `${viewport.name}: identifier should wrap in its column`).toBeLessThanOrEqual(identifierWidth.clientWidth + 1);

    if (viewport.width >= 768) {
      expect(identifierBox.x + identifierBox.width, `${viewport.name}: identifier must not overlap title`).toBeLessThanOrEqual(detailsBox.x + 1);
      expect(detailsBox.x + detailsBox.width, `${viewport.name}: title and notes must not overlap metadata`).toBeLessThanOrEqual(metadataBox.x + 1);
    } else {
      expect(detailsBox.y, `${viewport.name}: details should follow the wrapped identifier`).toBeGreaterThanOrEqual(identifierBox.y + identifierBox.height);
      expect(metadataBox.y, `${viewport.name}: metadata should follow source details`).toBeGreaterThanOrEqual(detailsBox.y + detailsBox.height);
    }
    await expectNoPageOverflow(page, viewport.width);
  }
});

test("profile and CV scan lists scroll independently without widening the page", async ({ page }) => {
  await routeApi(page);
  const skillsResponse = await page.request.get(`${apiBaseUrl}/api/skills`);
  expect(skillsResponse.ok()).toBeTruthy();
  const skills = (await skillsResponse.json()) as { skillId: string; name: string; category: string }[];
  await page.addInitScript((storedProfile) => {
    localStorage.setItem("afs.profile", JSON.stringify(storedProfile));
  }, {
    skills: skills.slice(0, 70).map((skill) => ({ ...skill, proficiency: 3 })),
    educationLevel: "Bachelor",
    yearsExperience: 4,
    interestSectors: [],
    weeklyLearningHours: 6,
    label: "Responsive check profile",
  });
  await page.route("**/api/profile/scan-cv", async (route) => {
    const scan = {
      engine: "RULE_BASED",
      method: "Responsive test",
      note: "Synthetic scan result for browser testing.",
      personName: "Alexandria Iskandar-Wong Longname",
      fileName: null,
      pageCount: null,
      characterCount: 1200,
      textPreview: "A synthetic CV used in responsive browser checks.",
      skills: Array.from({ length: 48 }, (_, index) => ({
        skillId: `test-skill-${index}`,
        name: `Responsive skill ${index + 1}`,
        category: "Core_Transferable",
        proficiency: 3,
        matchedTerm: "skill",
        evidence: "Responsive skill experience",
      })),
      suggestedEducation: null,
      educationEvidence: null,
      suggestedYearsExperience: null,
      experienceEvidence: null,
      suggestedSectors: [],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(scan) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile");
  const profileList = page.locator(".touch-scroll").first();
  await expect(profileList).toBeVisible();
  expect(await profileList.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await profileList.evaluate((element) => element.clientHeight),
  );
  await profileList.hover();
  await page.mouse.wheel(0, 480);
  await expect.poll(() => profileList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectNoPageOverflow(page, 390);

  await page.getByTestId("button-toggle-paste").click();
  await page.getByTestId("input-cv").fill("A long enough synthetic CV text for responsive browser testing.");
  await page.getByTestId("button-scan-text").click();
  await expect(page.getByTestId("text-scan-person-name")).toHaveText("Alexandria Iskandar-Wong Longname");
  const scanList = page.locator('[data-testid="panel-scan-result"] .touch-scroll');
  await expect(scanList).toBeVisible();
  expect(await scanList.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await scanList.evaluate((element) => element.clientHeight),
  );
  await scanList.hover();
  await page.mouse.wheel(0, 480);
  await expect.poll(() => scanList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectNoPageOverflow(page, 390);
});

test("CV names can be corrected, applied as profile and pass labels, and fit supported widths", async ({ page }) => {
  await routeApi(page);
  await page.route("**/api/profile/scan-cv", async (route) => {
    const scan = {
      engine: "RULE_BASED",
      method: "Responsive test",
      note: "Synthetic scan result for browser testing.",
      personName: "Alexandria Iskandar-Wong Longname",
      fileName: "confidential-upload-name.pdf",
      pageCount: 2,
      characterCount: 1200,
      textPreview: "Synthetic CV text.",
      skills: [{
        skillId: "SKL_0001",
        name: "Communication",
        category: "Core_Transferable",
        proficiency: 3,
        matchedTerm: "communication",
        evidence: "Strong communication experience",
      }],
      suggestedEducation: null,
      educationEvidence: null,
      suggestedYearsExperience: null,
      experienceEvidence: null,
      suggestedSectors: [],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(scan) });
  });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/profile");
    await page.getByTestId("button-toggle-paste").click();
    await page.getByTestId("input-cv").fill("A long enough synthetic CV text for responsive browser testing.");
    await page.getByTestId("button-scan-text").click();
    await expect(page.getByTestId("text-scan-person-name")).toHaveText("Alexandria Iskandar-Wong Longname");
    await expect(page.getByTestId("text-scan-person-name")).not.toContainText("confidential-upload-name.pdf");
    await expectNoPageOverflow(page, viewport.width);
    if (viewport.width !== 1280) continue;

    await page.getByTestId("input-cv-person-name").fill("Samira Corrected Person Name");
    await page.getByTestId("button-apply-scan").click();
    await expect(page.getByTestId("input-profile-holder-name")).toHaveValue("Samira Corrected Person Name");
    await page.getByTestId("button-save-profile").click();
    await expect(page.getByTestId("text-pass-name")).toHaveText("Samira Corrected Person Name");
  }
});

test("CV scanning detects clear header names and leaves uncertain names blank", async ({ request }) => {
  const clear = await request.post(`${apiBaseUrl}/api/profile/scan-cv`, {
    data: {
      fileName: "the-filename-is-not-a-name.pdf",
      text: "Aisha Rahman | aisha@example.test | +60 12-345 6789\n\nProfessional Summary\nExperienced healthcare professional with six years of experience providing patient care and coordinating clinical teams.",
    },
  });
  expect(clear.ok()).toBeTruthy();
  const clearResult = await clear.json() as { personName: string | null; fileName: string | null };
  expect(clearResult.personName).toBe("Aisha Rahman");
  expect(clearResult.fileName).toBeNull();

  const labelled = await request.post(`${apiBaseUrl}/api/profile/scan-cv`, {
    data: {
      text: "Full Name: Nur Aisyah binti Mohd Salleh\nContact: aisyah@example.test\nExperienced healthcare professional with six years of experience providing patient care and coordinating clinical teams.",
    },
  });
  expect(labelled.ok()).toBeTruthy();
  const labelledResult = await labelled.json() as { personName: string | null };
  expect(labelledResult.personName).toBe("Nur Aisyah binti Mohd Salleh");

  const missing = await request.post(`${apiBaseUrl}/api/profile/scan-cv`, {
    data: {
      fileName: "John-Smith-CV.pdf",
      text: "Aisha Rahman\nNur Aisyah Salleh\nInformation Technology\nProfessional Summary\nExperienced healthcare professional with six years of experience providing patient care and coordinating clinical teams.\n\nEducation\nBachelor of Nursing",
    },
  });
  expect(missing.ok()).toBeTruthy();
  const missingResult = await missing.json() as { personName: string | null };
  expect(missingResult.personName).toBeNull();
});

test("missing CV names use a neutral result and profile label, never the upload filename", async ({ page }) => {
  await routeApi(page);
  await page.route("**/api/profile/scan-cv", async (route) => {
    const scan = {
      engine: "RULE_BASED",
      method: "Responsive test",
      note: "Synthetic scan result for browser testing.",
      personName: null,
      fileName: "private-upload-name.pdf",
      pageCount: 1,
      characterCount: 1200,
      textPreview: "Synthetic CV text.",
      skills: [{
        skillId: "SKL_0001",
        name: "Communication",
        category: "Core_Transferable",
        proficiency: 3,
        matchedTerm: "communication",
        evidence: "Strong communication experience",
      }],
      suggestedEducation: null,
      educationEvidence: null,
      suggestedYearsExperience: null,
      experienceEvidence: null,
      suggestedSectors: [],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(scan) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile");
  await page.getByTestId("button-toggle-paste").click();
  await page.getByTestId("input-cv").fill("A long enough synthetic CV text for responsive browser testing.");
  await page.getByTestId("button-scan-text").click();
  await expect(page.getByTestId("text-scan-person-name")).toHaveText("Person name not identified");
  await expect(page.getByTestId("text-scan-person-name")).not.toContainText("private-upload-name.pdf");
  await expect(page.getByTestId("input-cv-person-name")).toHaveValue("");
  await page.getByTestId("button-apply-scan").click();
  await expect(page.getByTestId("input-profile-holder-name")).toHaveValue("CV profile");
});

test("legacy filename labels are hidden and the saved pass holder can be corrected", async ({ page }) => {
  await routeApi(page);
  const skillsResponse = await page.request.get(`${apiBaseUrl}/api/skills`);
  expect(skillsResponse.ok()).toBeTruthy();
  const skills = (await skillsResponse.json()) as { skillId: string; name: string; category: string }[];
  await page.addInitScript((storedProfile) => {
    localStorage.setItem("afs.profile", JSON.stringify(storedProfile));
  }, {
    skills: skills.slice(0, 20).map((skill) => ({ ...skill, proficiency: 3 })),
    educationLevel: "Bachelor",
    yearsExperience: 4,
    interestSectors: [],
    weeklyLearningHours: 6,
    label: "From CV: Farhan Resume.pdf",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/matches");
  await expect(page.getByTestId("text-pass-name")).toHaveText("CV profile");
  await expect(page.getByTestId("link-edit-profile")).not.toContainText("Farhan Resume.pdf");
  await page.goto("/profile");
  await expect(page.getByTestId("input-profile-holder-name")).toHaveValue("CV profile");
  await page.getByTestId("input-profile-holder-name").fill("Farhan Test Person");
  await page.getByTestId("button-save-profile").click();
  await expect(page.getByTestId("text-pass-name")).toHaveText("Farhan Test Person");
});

test("lanyard pass supports mouse dragging, keyboard flipping, and touch flipping", async ({ page, browser }) => {
  await routeApi(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const pass = page.getByTestId("button-flip-pass");
  await expect(pass).toBeVisible();

  const bounds = await pass.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 60, bounds!.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 95, bounds!.y + 130, { steps: 5 });
  await page.mouse.up();
  await expect(pass).toHaveAttribute("aria-pressed", "false");

  await pass.focus();
  await page.keyboard.press("Enter");
  await expect(pass).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(pass).toHaveAttribute("aria-pressed", "false");
  await pass.click();
  await expect(pass).toHaveAttribute("aria-pressed", "true");

  const context = await browser.newContext({ ...devices["iPhone 13"] });
  try {
    const touchPage = await context.newPage();
    await routeApi(touchPage);
    await touchPage.goto("http://127.0.0.1:25893/");
    const touchPass = touchPage.getByTestId("button-flip-pass");
    await expect(touchPass).toBeVisible();
    const touchBounds = await touchPass.boundingBox();
    expect(touchBounds).not.toBeNull();
    await touchPass.tap();
    await expect(touchPass).toHaveAttribute("aria-pressed", "true");
    const viewportWidth = await touchPage.evaluate(() => document.documentElement.clientWidth);
    await expectNoPageOverflow(touchPage, viewportWidth);
  } finally {
    await context.close();
  }
});
