// What every tab of the navigation bar costs on its first click, signed in, in a real browser.
//
// `nav.mjs` replays a fixed list of routes; this one reads the tabs the reader actually gets
// (the phone bar at 390 px, or the desktop bar at 1440 px) and clicks each of them in turn,
// three times over:
//
//   1. first visit — nothing in the router cache (what the porteur calls "the first click");
//   2. revisit — the same tabs again, a few seconds later;
//   3. after a pause (PAUSE_S seconds, e.g. 330) — the page is sent to the background, left there
//      past the five-minute cache window, and brought back, as a phone does when the app is left.
//
// For each click: click → content swapped in, the RSC requests it caused (navigation or
// prefetch), the Supabase calls counted in a local Kong log (KONG_LOG) and, when PG_URL points
// at the local database, the database execution time read from pg_stat_statements.
//
//   node scripts/perf/tabs.mjs <baseUrl> <email> <password> [rttMs] [mobile|desktop]
//
// Environment: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, KONG_LOG, PG_URL (all optional), SETTLE_MS
// (how long the page is left alone after each click, default 2000 — the time a person reads).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const [
  base = "http://127.0.0.1:3000",
  email = "parent-003-01@demo.local",
  password = "demo-password",
  rttArg = "40",
  form = "mobile",
] = process.argv.slice(2);
const rtt = Number(rttArg);
const settle = Number(process.env.SETTLE_MS ?? 2000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (n, w = 6) => (n == null ? "–".padStart(w) : String(Math.round(n)).padStart(w));

const kongLog = process.env.KONG_LOG;
const kongCount = () => {
  if (!kongLog) return 0;
  try {
    return readFileSync(kongLog, "utf8")
      .split("\n")
      .filter((line) => line.includes("/rest/v1/") || line.includes("/auth/v1/")).length;
  } catch {
    return 0;
  }
};
const pgUrl = process.env.PG_URL;
const psql = (sql) => execFileSync("psql", [pgUrl, "-Atc", sql], { encoding: "utf8" }).trim();
const dbReset = () => {
  if (pgUrl) psql("select pg_stat_statements_reset()");
};
// Statements run by the API roles only: the bench's own psql calls are excluded.
const dbTime = () =>
  pgUrl
    ? Number(
        psql(
          "select coalesce(sum(total_exec_time), 0) from pg_stat_statements s join pg_roles r on r.oid = s.userid where r.rolname in ('authenticated', 'anon', 'authenticator', 'service_role')",
        ),
      )
    : null;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const context = await browser.newContext({
  viewport: form === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
  isMobile: form !== "desktop",
  hasTouch: form !== "desktop",
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
if (rtt > 0) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: rtt,
    downloadThroughput: 5e6,
    uploadThroughput: 2e6,
  });
}

const requests = [];
cdp.on("Network.requestWillBeSent", (e) => {
  const h = e.request.headers;
  const rsc = h.RSC === "1" || h.rsc === "1" || /[?&]_rsc=/.test(e.request.url);
  if (!rsc) return;
  requests.push({
    id: e.requestId,
    at: Date.now(),
    url: e.request.url.replace(base, ""),
    prefetch: Boolean(h["Next-Router-Prefetch"] ?? h["next-router-prefetch"]),
  });
});

const t0 = Date.now();
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
// An account new to this seed goes through the welcome screen (terms) first.
if (new URL(page.url()).pathname.startsWith("/bienvenue")) {
  const first = page.getByLabel("Prénom", { exact: true });
  if ((await first.inputValue()) === "") await first.fill("Test");
  const last = page.getByLabel("Nom", { exact: true });
  if ((await last.inputValue()) === "") await last.fill("Banc");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Accéder à l'application" }).click();
  await page.waitForFunction(
    () => location.pathname === "/accueil" && document.querySelector("h1"),
    null,
    {
      timeout: 60_000,
    },
  );
  await page.waitForLoadState("networkidle");
}
console.log(
  `signed in as ${email} → ${new URL(page.url()).pathname} (${Date.now() - t0} ms), rtt ${rtt} ms, ${form}`,
);
await sleep(settle);

// The tabs this reader gets: the links of the visible navigation bar.
const tabs = await page.evaluate(() => {
  // `offsetParent` is null for a fixed bar, so visibility is read from its boxes.
  const navs = [...document.querySelectorAll("nav")].filter(
    (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden",
  );
  // The bar that carries the home tab: on a phone the bottom bar, on a desktop the header bar.
  const bar = navs.find(
    (n) => n.querySelector("a[href='/accueil']") && n.querySelectorAll("a[href^='/']").length >= 4,
  );
  return [...(bar?.querySelectorAll("a[href^='/']") ?? [])].map((a) => a.getAttribute("href"));
});
console.log(`tabs: ${tabs.join("  ")}`);

async function click(href) {
  await page.evaluate((target) => {
    const snapshot = (m) =>
      m ? `${m.innerHTML.length}:${m.querySelector("h1")?.textContent ?? ""}` : "";
    window.__nav = { contentTs: null };
    window.__before = snapshot(document.querySelector("main"));
    // Content counts as arrived once the address is the target's and <main> has changed: the
    // pending marker under a tab changes the page too, but before the address does.
    window.__observer = new MutationObserver(() => {
      if (
        window.__nav.contentTs == null &&
        location.pathname.startsWith(target) &&
        snapshot(document.querySelector("main")) !== window.__before
      )
        window.__nav.contentTs = performance.now();
    });
    window.__observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, href);
  const firstRequest = requests.length;
  const kongBefore = kongCount();
  dbReset();
  const clickAt = await page.evaluate(() => performance.now());
  const start = Date.now();
  await page.locator(`nav a[href="${href}"]`).locator("visible=true").first().click();
  await page.waitForFunction((h) => location.pathname.startsWith(h), href, { timeout: 60_000 });
  await page
    .waitForFunction(() => window.__nav.contentTs != null, null, { timeout: 60_000 })
    .catch(() => {});
  const contentTs = await page.evaluate(() => window.__nav.contentTs);
  // Requests sent during the click itself (not the background prefetches that follow it).
  const during = requests
    .slice(firstRequest)
    .filter((r) => r.at <= start + (contentTs ?? 0) - clickAt + 5);
  const result = {
    href,
    landed: new URL(page.url()).pathname,
    contentMs: contentTs == null ? null : contentTs - clickAt,
    navRequests: during.filter((r) => !r.prefetch).length,
    supabase: kongCount() - kongBefore,
    dbMs: dbTime(),
  };
  await page.evaluate(() => window.__observer?.disconnect());
  await sleep(settle);
  result.prefetchesAfter = requests.slice(firstRequest).filter((r) => r.prefetch).length;
  return result;
}

const order = (current) => {
  // Every tab once, starting with the first one that is not the current page, ending back home.
  const others = tabs.filter((t) => !current.startsWith(t));
  return [...others, tabs[0]];
};

const passes = [];
async function pass(label) {
  const current = new URL(page.url()).pathname;
  const rows = [];
  for (const href of order(current)) {
    if (new URL(page.url()).pathname.startsWith(href)) continue;
    rows.push(await click(href));
  }
  passes.push({ label, rows });
  console.log(`\n${label}`);
  console.log(
    "  tab              landed on                                  click→content  nav-req  supabase  db-ms  prefetch-after",
  );
  for (const r of rows)
    console.log(
      `  ${r.href.padEnd(16)} ${r.landed.slice(0, 42).padEnd(42)} ${fmt(r.contentMs, 13)} ${fmt(r.navRequests, 8)} ${fmt(r.supabase, 9)} ${fmt(r.dbMs, 6)} ${fmt(r.prefetchesAfter, 15)}`,
    );
}

await pass("1. first visit of every tab");
await pass("2. revisit, a few seconds later");

// A real pause, longer than the router keeps a page (`staleTimes`, five minutes), during which
// the application sits in the background, then comes back — what a phone does between two looks.
// Moving the page's clock instead does not work: the router keeps reusing what it holds.
const pauseS = Number(process.env.PAUSE_S ?? 0);
if (pauseS > 0) {
  const setVisibility = (state) =>
    page.evaluate((visible) => {
      Object.defineProperty(document, "visibilityState", {
        value: visible ? "visible" : "hidden",
        configurable: true,
      });
      Object.defineProperty(document, "hidden", { value: !visible, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  await setVisibility(false);
  console.log(`\n   … ${pauseS} s in the background …`);
  await sleep(pauseS * 1000);
  await setVisibility(true);
  await sleep(settle);
  await pass(`3. after ${pauseS} s in the background`);
}

const all = passes.flatMap((p) => p.rows.map((r) => ({ ...r, pass: p.label[0] })));
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
console.log(
  "\nmedian click→content per pass (ms):",
  ["1", "2", "3"]
    .map((p) => `${p}: ${fmt(median(all.filter((r) => r.pass === p).map((r) => r.contentMs)), 0)}`)
    .join("   "),
);
await browser.close();
