/**
 * Captures mobile + desktop, light + dark screenshots of a few routes from a
 * running dev server. Used for PR descriptions ("captures mobile") and visual
 * reviews of /dev/ui.
 *
 *   pnpm dev --port 3200 &
 *   node scripts/dev/screenshots.mjs http://127.0.0.1:3200 ./screenshots /dev/ui /
 */
import { mkdirSync } from "node:fs";

import { chromium, devices } from "@playwright/test";

const [baseUrl = "http://127.0.0.1:3000", outDir = "./screenshots", ...routes] =
  process.argv.slice(2);
const paths = routes.length ? routes : ["/"];
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});

const targets = [
  ["mobile", devices["Pixel 7"]],
  ["desktop", { viewport: { width: 1280, height: 900 } }],
];

for (const [name, contextOptions] of targets) {
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ ...contextOptions, colorScheme, locale: "fr-FR" });
    const page = await context.newPage();
    for (const route of paths) {
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const slug = route.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
      const file = `${outDir}/${slug}-${name}-${colorScheme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
