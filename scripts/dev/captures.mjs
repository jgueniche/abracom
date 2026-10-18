/**
 * Signed-in screenshots of a list of routes, at phone and desktop widths, in light and/or dark —
 * the "look at it" step of the design review (.claude/skills/design-review), which the anonymous
 * `screenshots.mjs` cannot do for screens behind the sign-in.
 *
 *   node scripts/dev/captures.mjs <baseUrl> <outDir> <email> <password> [light|dark|both] <route>…
 *
 * A route may hold `{class}`: it is replaced by the reader's class space, read from the "Classe"
 * tab of the bar (`/classes/<id>`). Files are named `<route>-<390|1440>-<scheme>.png`.
 * Environment: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, WIDTHS (default "390,1440").
 */
import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";

const [base, outDir, email, password, schemeArg = "light", ...routes] = process.argv.slice(2);
const schemes = schemeArg === "both" ? ["light", "dark"] : [schemeArg];
const widths = (process.env.WIDTHS ?? "390,1440").split(",").map(Number);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});

for (const scheme of schemes) {
  const context = await browser.newContext({
    viewport: { width: widths[0], height: 900 },
    colorScheme: scheme,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });
  const page = await context.newPage();
  await page.goto(`${base}/connexion`, { waitUntil: "networkidle" });
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForFunction(
    () => !location.pathname.startsWith("/connexion") && document.querySelector("h1"),
    null,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle");
  // An account new to this database accepts the terms first.
  if (new URL(page.url()).pathname.startsWith("/bienvenue")) {
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "Accéder à l'application" }).click();
    await page.waitForFunction(() => location.pathname === "/accueil", null, { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
  }
  const classHref = await page.evaluate(
    () =>
      [...document.querySelectorAll("nav a[href^='/classes/']")]
        .map((a) => a.getAttribute("href"))
        .find(Boolean) ?? null,
  );
  const classBase = classHref?.split("/").slice(0, 3).join("/") ?? "/classes";

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const path = route.replace("{class}", classBase);
      await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      // A full-page capture paints a fixed bar wherever the viewport ended: set the phone bar
      // back in the flow, at the foot of the page, where it reads as what it is.
      await page.addStyleTag({ content: "nav.fixed.bottom-0 { position: static !important; }" });
      // …and the pointer out of the way, or the row under it is captured in its hover state.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      const slug = route.replace("{class}", "classe").replace(/\W+/g, "-").replace(/^-|-$/g, "");
      const file = `${outDir}/${slug || "racine"}-${width}-${scheme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
  }
  await context.close();
}
await browser.close();
