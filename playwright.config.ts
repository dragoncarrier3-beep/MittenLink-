import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end + accessibility tests.
 * By default runs against a dev server on port 3100 (started automatically if not running).
 * Override with E2E_BASE_URL to test a deployed environment.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL, trace: "retain-on-failure", navigationTimeout: 120_000, actionTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next dev --webpack -p 3100", url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 300_000 },
});
