#!/usr/bin/env node
/**
 * Build guard: the Supabase origin must really be inside the client bundles.
 *
 *   pnpm ops:check-bundle          # runs automatically after `next build`
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a build that ran without
 * them — or, on Vercel, a build that reused a cache produced before the
 * variables were set — ships a browser bundle whose Supabase URL is `undefined`.
 * Nothing fails: the deployment is green, and every visitor gets a client that
 * cannot reach the database. This turns that into a build failure, where it is
 * cheap to notice.
 *
 * Nothing to check when the variables are absent on purpose: the application is
 * meant to build and boot without a Supabase stack (its clients then raise an
 * explicit French error), which is how the first sessions of the project ran.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), ".next", "static");

/**
 * The variables come from the platform on Vercel and from `.env.local` on a
 * workstation, which only Next itself reads — without this the guard would
 * quietly skip on every local build, exactly where it is first useful.
 */
async function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    let content;
    try {
      content = await readFile(path.join(process.cwd(), name), "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

await loadEnvFiles();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  console.log("check-bundle: NEXT_PUBLIC_SUPABASE_* not set, nothing to verify");
  process.exit(0);
}

let origin;
try {
  origin = new URL(url).origin;
} catch {
  console.error(`check-bundle: NEXT_PUBLIC_SUPABASE_URL is not a URL (${url})`);
  process.exit(1);
}

async function* jsFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(full);
    else if (entry.name.endsWith(".js")) yield full;
  }
}

let scanned = 0;
let withOrigin = 0;
let withKey = 0;
for await (const file of jsFiles(DIR)) {
  scanned += 1;
  const source = await readFile(file, "utf8");
  if (source.includes(origin)) withOrigin += 1;
  if (source.includes(anonKey)) withKey += 1;
}

if (scanned === 0) {
  console.error(`check-bundle: no client bundle found under ${DIR} — was the build run?`);
  process.exit(1);
}

const missing = [];
if (withOrigin === 0) missing.push(`the Supabase origin (${origin})`);
if (withKey === 0) missing.push("the anon key");

if (missing.length > 0) {
  console.error(
    [
      `check-bundle: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} absent from the ${scanned} client bundles.`,
      "The browser client would be built without its configuration and every page would fail at runtime.",
      "Rebuild with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set;",
      "on Vercel, redeploy with « Use existing Build Cache » unchecked.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `check-bundle: Supabase origin in ${withOrigin} and anon key in ${withKey} of ${scanned} client bundles`,
);
