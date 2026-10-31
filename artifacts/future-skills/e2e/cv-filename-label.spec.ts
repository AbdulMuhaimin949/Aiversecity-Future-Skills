import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:8080";

type SampleProfile = {
  profileId: string;
  skills: { skillId: string; name: string; category: string; proficiency: number }[];
};

type CatalogueSkill = { skillId: string; name: string };

async function routeApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.continue({ url: `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}` });
  });
}

test("uses an editable PDF filename as the saved role-pass label when no name is detected", async ({ page }) => {
  await routeApi(page);
  const profilesResponse = await page.request.get(`${apiBaseUrl}/api/sample-profiles`);
  expect(profilesResponse.ok()).toBeTruthy();
  const profiles = (await profilesResponse.json()) as SampleProfile[];
  const sample = profiles.find((profile) => profile.profileId === "CV_0001");
  expect(sample).toBeTruthy();

  await page.route("**/api/profile/scan-cv", async (route) => {
    const request = route.request().postDataJSON() as { fileName?: string };
    await route.fulfill({
      json: {
        engine: "RULE_BASED",
        method: "Test scan",
        note: "",
        personName: null,
        fileName: request.fileName ?? null,
        pageCount: 1,
        characterCount: 100,
        textPreview: "Sample CV",
        skills: sample!.skills.map((skill) => ({
          ...skill,
          matchedTerm: skill.name,
          evidence: `Experience with ${skill.name}`,
        })),
        suggestedEducation: null,
        educationEvidence: null,
        suggestedYearsExperience: null,
        experienceEvidence: null,
        suggestedSectors: [],
      },
    });
  });

  await page.goto("/profile");
  await page.getByTestId("input-cv-pdf").setInputFiles({
    name: "Data-Analyst_CV.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("mock PDF"),
  });

  const scanName = page.getByTestId("input-cv-person-name");
  await expect(scanName).toHaveValue("Data Analyst CV");
  await page.getByTestId("button-apply-scan").click();

  const profileName = page.getByTestId("input-profile-holder-name");
  await expect(profileName).toHaveValue("Data Analyst CV");
  await profileName.fill("My edited role-pass label");
  await page.getByTestId("button-save-profile").click();

  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByTestId("text-pass-name").first()).toHaveText("My edited role-pass label");
  await page.reload();
  await expect(page.getByTestId("text-pass-name").first()).toHaveText("My edited role-pass label");
});

test("keeps a detected person name ahead of the PDF filename", async ({ page }) => {
  await routeApi(page);
  await page.route("**/api/profile/scan-cv", async (route) => {
    const request = route.request().postDataJSON() as { fileName?: string };
    await route.fulfill({
      json: {
        engine: "RULE_BASED",
        method: "Test scan",
        note: "",
        personName: "Mina Rahman",
        fileName: request.fileName ?? null,
        pageCount: 1,
        characterCount: 100,
        textPreview: "Sample CV",
        skills: [{
          skillId: "SKL_0001",
          name: "Sample skill",
          category: "Core_Transferable",
          proficiency: 3,
          matchedTerm: "sample",
          evidence: "Sample CV evidence",
        }],
        suggestedEducation: null,
        educationEvidence: null,
        suggestedYearsExperience: null,
        experienceEvidence: null,
        suggestedSectors: [],
      },
    });
  });

  await page.goto("/profile");
  await page.getByTestId("input-cv-pdf").setInputFiles({
    name: "another-persons-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("mock PDF"),
  });

  await expect(page.getByTestId("input-cv-person-name")).toHaveValue("Mina Rahman");
});

test("pasted CV text and manually added skills do not create a filename label", async ({ page }) => {
  await routeApi(page);
  const skillsResponse = await page.request.get(`${apiBaseUrl}/api/skills`);
  expect(skillsResponse.ok()).toBeTruthy();
  const skills = (await skillsResponse.json()) as CatalogueSkill[];
  const skill = skills[0];
  expect(skill).toBeTruthy();

  await page.route("**/api/profile/scan-cv", async (route) => {
    await route.fulfill({
      json: {
        engine: "RULE_BASED",
        method: "Test scan",
        note: "",
        personName: null,
        fileName: null,
        pageCount: null,
        characterCount: 100,
        textPreview: "Pasted CV text",
        skills: [],
        suggestedEducation: null,
        educationEvidence: null,
        suggestedYearsExperience: null,
        experienceEvidence: null,
        suggestedSectors: [],
      },
    });
  });

  await page.goto("/profile");
  await page.getByTestId("button-toggle-paste").click();
  await page.getByTestId("input-cv").fill("This is enough pasted CV text to scan.");
  await page.getByTestId("button-scan-text").click();
  const profileName = page.getByTestId("input-profile-holder-name");
  await expect(page.getByTestId("input-cv-person-name")).toHaveValue("");

  await page.getByTestId("tab-manual").click();
  await page.getByTestId("input-skill-search").fill(skill!.name);
  await page.getByTestId(`button-add-${skill!.skillId}`).click();
  await expect(profileName).toHaveValue("");
});
