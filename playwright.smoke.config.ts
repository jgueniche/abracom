import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a deployed environment (no local server):
 *   SMOKE_BASE_URL=https://… SMOKE_PASSWORD=… pnpm test:smoke
 */
export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 90_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "fr-FR",
  },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
});
