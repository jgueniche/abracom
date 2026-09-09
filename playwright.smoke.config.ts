import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a deployed environment (no local server):
 *   SMOKE_BASE_URL=https://… SMOKE_PASSWORD=… pnpm test:smoke
 */
/** Same escape hatch as the e2e config: use a pre-installed Chromium when one is provided. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
/** Behind a corporate / sandbox proxy: SMOKE_PROXY=http://host:port (TLS interception tolerated). */
const proxyServer = process.env.SMOKE_PROXY;

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
    timezoneId: "Europe/Paris",
    launchOptions: executablePath ? { executablePath } : undefined,
    proxy: proxyServer ? { server: proxyServer } : undefined,
    ignoreHTTPSErrors: Boolean(proxyServer),
  },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
});
