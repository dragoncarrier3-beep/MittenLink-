import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Fails if a page shows an error screen or raw technical text. */
async function expectHealthy(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/We're having trouble loading|Something went wrong|Application error|stack trace/i);
  expect(body).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
}

async function demoSignIn(page: Page, firstName: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(`Sign in as ${firstName}`) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}

async function visitAll(page: Page, paths: string[]) {
  for (const p of paths) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBeLessThan(400);
    await expect(page.locator("h1").first(), p).toBeVisible();
    await expectHealthy(page);
  }
}

test("public search: autism services near Ann Arbor for children", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Find disability resources across Michigan/);
  await page.goto("/search?q=Autism+services&location=Ann+Arbor%2C+MI&radius=25&population=children");
  await expect(page.getByText("Great Lakes Autism & Family Center").first()).toBeVisible();
  await expectHealthy(page);
});

test("zero local results fall back to statewide resources", async ({ page }) => {
  await page.goto("/search?q=Respite+care&location=Alpena");
  await expect(page.getByText(/couldn.t find an exact match/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Respite/ }).first()).toBeVisible();
});

test("public pages render", async ({ page }) => {
  await visitAll(page, [
    "/providers",
    "/providers/great-lakes-independent-living-network",
    "/services/glafc-occupational-therapy",
    "/programs",
    "/events",
    "/guides",
    "/guides/understanding-ssi-and-ssdi",
    "/about",
    "/claim",
    "/suggest",
    "/providers/northern-michigan-family-support-collaborative/experience",
  ]);
});

test("admin workspace", async ({ page }) => {
  await demoSignIn(page, "Sarah");
  await visitAll(page, [
    "/admin",
    "/admin/organizations",
    "/admin/claims",
    "/admin/verification",
    "/admin/changes",
    "/admin/submissions",
    "/admin/corrections",
    "/admin/reports",
    "/admin/source-watch",
    "/admin/duplicates",
    "/admin/outreach",
    "/admin/search-analytics",
    "/admin/billing",
    "/admin/users",
    "/admin/categories",
    "/admin/audit",
    "/admin/settings",
  ]);
});

test("verifier workspace", async ({ page }) => {
  await demoSignIn(page, "Jordan");
  await visitAll(page, ["/verify", "/verify/team", "/verify/completed"]);
  await page.goto("/verify");
  const firstTask = page.locator('a[href^="/verify/tasks/"]').first();
  await firstTask.click();
  await expect(page.locator("h1")).toBeVisible();
  await expectHealthy(page);
});

test("provider workspace", async ({ page }) => {
  await demoSignIn(page, "Emily");
  await visitAll(page, ["/provider", "/provider/organization", "/provider/locations", "/provider/services", "/provider/verification", "/provider/plan", "/provider/analytics"]);
});

test("community account", async ({ page }) => {
  await demoSignIn(page, "Alex");
  await visitAll(page, ["/account", "/account/saved", "/account/claims", "/account/reports", "/notifications"]);
});

test("critical pages have no automated accessibility violations", async ({ page }) => {
  for (const p of ["/", "/search?q=autism", "/providers/great-lakes-independent-living-network", "/sign-in"]) {
    await page.goto(p);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${p}: ${v.id} — ${v.help}`)).toEqual([]);
  }
});
