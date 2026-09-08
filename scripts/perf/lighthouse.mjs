#!/usr/bin/env node
/**
 * Mobile Lighthouse audit (brief §8: Lighthouse ≥ 90 mobile).
 *   pnpm perf                       # audits http://127.0.0.1:3000/connexion (needs `pnpm start`)
 *   pnpm perf https://…/connexion   # any URL
 *   STRICT=1 pnpm perf              # exits 1 below 90 on performance or accessibility
 * Uses the Chromium found in PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH / CHROME_PATH when set.
 */
import { mkdir, writeFile } from "node:fs/promises";

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const url = process.argv[2] ?? "http://127.0.0.1:3000/connexion";
const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? process.env.CHROME_PATH;
const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

try {
  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    },
    {
      extends: "lighthouse:default",
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        throttlingMethod: "simulate",
      },
    },
  );
  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([key, category]) => [
      key,
      Math.round((category.score ?? 0) * 100),
    ]),
  );
  await mkdir(".cache", { recursive: true });
  await writeFile(".cache/lighthouse.html", result.report[1]);
  await writeFile(".cache/lighthouse.json", result.report[0]);
  console.log(`Lighthouse (mobile) · ${url}`);
  for (const [key, score] of Object.entries(scores)) console.log(`  ${key.padEnd(16)} ${score}`);
  console.log("  report           .cache/lighthouse.html");
  if (process.env.STRICT && (scores.performance < 90 || scores.accessibility < 90)) {
    console.error("Below the 90 threshold.");
    process.exitCode = 1;
  }
} finally {
  await chrome.kill();
}
