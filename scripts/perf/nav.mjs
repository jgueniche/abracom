// Measures what a click costs, end to end, in a real browser — signed in.
//
// Chromium is driven through the DevTools protocol so that every navigation is
// decomposed: click → first byte of the RSC response → content swapped in →
// next paint, with the prefetch requests and (locally) the Supabase calls it
// caused. It runs against any deployment, production included (ADR-0067).
//
//   node scripts/perf/nav.mjs <baseUrl> <email> <password> [rttMs] [scenario]
//
//   baseUrl   http://127.0.0.1:3000 (a `pnpm build && pnpm start`) or https://…
//   rttMs     extra round-trip latency emulated by the browser (0 = none); a
//             local server with 40 ms stands in for a user on a good network
//   scenario  "stale" (default) — fresh navigations, then the same ones again
//             after 26 s and 35 s, to see the router cache boundary; "quick" —
//             seven navigations without pauses
//
// Environment: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use a pre-installed
// Chromium; KONG_LOG to count Supabase calls per navigation from a local
// gateway log (`docker logs -f supabase_kong_<project> > kong.log`).
//
// Numbers seen from far away carry the network: the sandbox this was written
// in sits in the United States, behind a proxy, so its "click → content" is
// 150 to 250 ms above what a Paris user pays. The server-side share (first
// byte, and the database timeline in the Supabase logs) is representative.
import { readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const [
  base = "http://127.0.0.1:3000",
  email = "parent-1@demo.local",
  password = "demo-password",
  rttArg = "0",
  scenario = "stale",
] = process.argv.slice(2);
const rtt = Number(rttArg);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (n) => (n == null ? "    – " : String(Math.round(n)).padStart(6));
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

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
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

// Every request the page makes, keyed by CDP request id.
const requests = new Map();
cdp.on("Network.requestWillBeSent", (e) => {
  requests.set(e.requestId, { url: e.request.url, headers: e.request.headers, type: e.type });
});
cdp.on("Network.responseReceived", (e) => {
  const r = requests.get(e.requestId);
  if (r) Object.assign(r, { status: e.response.status, timing: e.response.timing });
});
cdp.on("Network.loadingFinished", (e) => {
  const r = requests.get(e.requestId);
  if (r) r.bytes = e.encodedDataLength;
});

// Sign in (identifier + password), through the onboarding if the account is new to this seed.
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
if (new URL(page.url()).pathname.startsWith("/bienvenue")) {
  const first = page.getByLabel("Prénom", { exact: true });
  if ((await first.inputValue()) === "") await first.fill("Test");
  const last = page.getByLabel("Nom", { exact: true });
  if ((await last.inputValue()) === "") await last.fill("Parent");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Accéder à l'application" }).click();
  await page.waitForFunction(
    () => location.pathname === "/accueil" && document.querySelector("h1"),
    null,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle");
}
await page.waitForSelector('a[href="/devoirs"], a[href="/publier"]', { timeout: 30_000 });
console.log(`signed in → ${page.url()} (${Date.now() - t0} ms) rtt=${rtt} ms`);

async function navigate(label, href) {
  await page.evaluate(() => {
    window.__nav = { contentTs: null, paintTs: null, skeletonTs: null };
    const main = document.querySelector("main");
    const snapshot = (m) =>
      m ? `${m.innerHTML.length}:${m.querySelector("h1")?.textContent ?? ""}` : "";
    window.__before = snapshot(main);
    const observer = new MutationObserver(() => {
      const m = document.querySelector("main");
      if (m?.querySelector('[data-slot="page-loading"]')) {
        window.__nav.skeletonTs ??= performance.now();
        return;
      }
      if (snapshot(m) !== window.__before && window.__nav.contentTs == null) {
        window.__nav.contentTs = performance.now();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            window.__nav.paintTs = performance.now();
          }),
        );
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.__observer = observer;
  });
  const before = new Set(requests.keys());
  const kongBefore = kongCount();
  const clickAt = await page.evaluate(() => performance.now());
  await page.locator(`a[href="${href}"]`).first().click();
  await page.waitForFunction((h) => location.pathname === h, href, { timeout: 60_000 });
  await page
    .waitForFunction(() => window.__nav.contentTs != null, null, { timeout: 60_000 })
    .catch(() => {});
  await sleep(500);
  const nav = await page.evaluate(() => {
    window.__observer?.disconnect();
    return window.__nav;
  });
  const after = [...requests.entries()].filter(([id]) => !before.has(id)).map(([, r]) => r);
  const rsc = after.filter((r) => r.headers?.RSC === "1" || /[?&]_rsc=/.test(r.url));
  const rows = rsc.map((r) => ({
    status: r.status,
    ttfb: r.timing ? r.timing.receiveHeadersEnd - r.timing.sendEnd : null,
    bytes: r.bytes,
    url: r.url.replace(base, ""),
    prefetch: Boolean(r.headers?.["Next-Router-Prefetch"] ?? r.headers?.["next-router-prefetch"]),
  }));
  const result = {
    label,
    skeletonMs: nav.skeletonTs == null ? null : nav.skeletonTs - clickAt,
    contentMs: nav.contentTs == null ? null : nav.contentTs - clickAt,
    paintMs: nav.paintTs == null ? null : nav.paintTs - clickAt,
    rsc: rows,
    supabaseCalls: kongCount() - kongBefore,
  };
  console.log(
    `${label.padEnd(38)} click→skeleton=${fmt(result.skeletonMs)} click→content=${fmt(result.contentMs)} click→paint=${fmt(result.paintMs)} rsc=${rsc.length} supabase=${result.supabaseCalls}`,
  );
  for (const r of rows) {
    console.log(
      `     ${r.prefetch ? "PREFETCH" : "RSC     "} ${r.status} ttfb=${fmt(r.ttfb)} bytes=${String(r.bytes ?? "?").padStart(7)} ${r.url.slice(0, 70)}`,
    );
  }
  return result;
}

const results = [];
const run = async (label, href) => results.push(await navigate(label, href));
const wait = async (seconds) => {
  console.log(`   … ${seconds} s …`);
  await sleep(seconds * 1000);
};

if (scenario === "stale") {
  await run("1 accueil→devoirs (fresh)", "/devoirs");
  await run("2 devoirs→accueil (fresh)", "/accueil");
  await run("3 accueil→devoirs (5 s later)", "/devoirs");
  await run("4 devoirs→accueil (cached?)", "/accueil");
  await wait(25);
  await run("5 accueil→devoirs (~26 s after #3)", "/devoirs");
  await wait(35);
  await run("6 devoirs→accueil (>30 s after #4)", "/accueil");
  await run("7 accueil→messages (fresh)", "/messages");
  await run("8 messages→ecole (fresh)", "/ecole");
  await run("9 ecole→classes (fresh)", "/classes");
  await run("10 classes→accueil (<30 s)", "/accueil");
} else {
  await run("1 accueil→devoirs (fresh)", "/devoirs");
  await run("2 devoirs→accueil (fresh)", "/accueil");
  await run("3 accueil→messages (fresh)", "/messages");
  await run("4 messages→ecole (fresh)", "/ecole");
  await run("5 ecole→classes (fresh)", "/classes");
  await run("6 classes→accueil (<30 s)", "/accueil");
  await run("7 accueil→devoirs (<30 s)", "/devoirs");
}

console.log(
  "\nSummary (ms): click→skeleton | click→content | click→paint | rsc ttfb | bytes | prefetches | supabase calls",
);
for (const r of results) {
  const main = r.rsc.find((x) => !x.prefetch);
  const prefetches = r.rsc.filter((x) => x.prefetch).length;
  console.log(
    `  ${r.label.padEnd(38)} ${fmt(r.skeletonMs)} ${fmt(r.contentMs)} ${fmt(r.paintMs)}   ${fmt(main?.ttfb)} ${String(main?.bytes ?? "-").padStart(7)}   ${String(prefetches).padStart(3)}   ${String(r.supabaseCalls).padStart(3)}`,
  );
}
await browser.close();
