#!/usr/bin/env node
/**
 * Coverage and freshness of the in-app help.
 *
 *   pnpm ops:check-help        # also run by `pnpm check` and by the CI
 *
 * Help rots in silence. Nobody gets an error because a guide describes a screen
 * that moved three sessions ago — which is exactly how the three guides written
 * in session 15 ended up five sessions behind, talking to three roles out of six
 * and never mentioning the pointeuse, the timetable or the signed absence note.
 *
 * So the build notices instead of a human:
 *
 *  1. **Coverage** — every screen under `app/(app)` must be documented by at
 *     least one article addressed to each role that can actually open it. The
 *     roles are read from the guard the page (or its nearest layout) calls, so a
 *     new screen demands its article without anyone maintaining a list.
 *  2. **No dangling routes** — an article may not declare a screen that no
 *     longer exists. Help that describes a deleted screen is worse than none.
 *  3. **Freshness** — an article carries `reviewed:`. If the last commit that
 *     touched the screen it documents is *newer than that date*, the article is
 *     stale and the check fails. A session that changes a screen therefore has
 *     to re-read its article and move `reviewed:` forward, which is precisely
 *     the habit worth forcing (CLAUDE.md §9).
 *
 * Everything here reads the articles through `lib/help/frontmatter.mjs`, the
 * same parser the application uses: a guardrail that disagrees with the page it
 * guards would be worth nothing.
 */
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { HELP_ROLES, parseArticle } from "../../lib/help/frontmatter.mjs";

const run = promisify(execFile);
const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const HELP_DIR = path.join(ROOT, "content", "help");
/** Only the signed-in application is *required* to be documented. */
const REQUIRED_PREFIX = path.join("app", "(app)");

const ALL = [...HELP_ROLES];
const STAFF = ["staff", "school_admin", "super_admin"];
const ADMIN = ["school_admin", "super_admin"];
const TEAM = ["teacher", ...STAFF];

/**
 * Guard → who gets through. `requireSchoolRole([...])` is read from its literal
 * argument instead, and a super admin passes every school-role check
 * (`hasSchoolRole` short-circuits on it), so it is added to each set.
 */
const GUARDS = {
  requireCurrentUser: ALL,
  // Teachers of the class, staff of the school, and guardians of its pupils.
  requireClassAccess: ALL,
  requireSchoolStaff: STAFF,
  requireSchoolAdmin: ADMIN,
};

/**
 * Screens whose real audience is narrower than their guard, because the page
 * itself sends part of it away. One line each, and the reason is the point: an
 * override nobody can justify is a bug in the page, not in this list.
 */
const ROLE_OVERRIDES = {
  // `canUseMessaging` — a read-only guardian has no messaging at all (ADR-0035).
  "/messages": ALL.filter((role) => role !== "guardian"),
  "/messages/[threadId]": ALL.filter((role) => role !== "guardian"),
  "/messages/nouveau": ALL.filter((role) => role !== "guardian"),
  // Creating a group is reserved to the team; a parent is redirected.
  "/messages/nouveau-groupe": TEAM,
  // `canSeeAssessments` — neither the secretariat nor a read-only guardian.
  "/classes/[classId]/evaluations": ["parent", "teacher", ...ADMIN],
  // `notFound()` for anyone who is not a teacher of the class or staff.
  "/classes/[classId]/publier": TEAM,
  // Redirected back to the class: a cross-class reading, never a family one (ADR-0042).
  "/classes/[classId]/retards": TEAM,
  // A parent with nothing to publish is redirected home.
  "/publier": TEAM,
  // `canWriteInSchool` — a read-only guardian is sent back to the list.
  "/communaute/annonces/nouvelle": ALL.filter((role) => role !== "guardian"),
};

/**
 * Screens that legitimately need no article. Each entry must carry a reason;
 * the map is empty on purpose today — every screen of the application is
 * documented, and that is the state worth defending.
 */
const EXEMPT = {};

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** `app/(app)/classes/[classId]/devoirs/page.tsx` → `/classes/[classId]/devoirs`. */
function routeOf(file) {
  const segments = path
    .relative(APP_DIR, path.dirname(file))
    .split(path.sep)
    .filter((segment) => segment !== "" && !segment.startsWith("("));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

const GUARD_CALL = new RegExp(`\\b(${Object.keys(GUARDS).join("|")})\\s*\\(`);
const SCHOOL_ROLE_CALL = /requireSchoolRole\s*\(\s*\[([^\]]*)\]/;

function rolesFromSource(source) {
  const list = SCHOOL_ROLE_CALL.exec(source);
  if (list) {
    const roles = list[1]
      .split(",")
      .map((role) => role.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    return [...new Set([...roles, "super_admin"])];
  }
  const guard = GUARD_CALL.exec(source);
  return guard ? GUARDS[guard[1]] : null;
}

/**
 * The guard of a page, or of the closest layout above it — the class space
 * carries its own on the layout, and its index page is a bare `redirect()`.
 */
async function rolesFor(file) {
  let dir = path.dirname(file);
  const roles = rolesFromSource(await readFile(file, "utf8"));
  if (roles) return roles;
  while (dir.startsWith(APP_DIR)) {
    const layout = path.join(dir, "layout.tsx");
    if (await exists(layout)) {
      const inherited = rolesFromSource(await readFile(layout, "utf8"));
      if (inherited) return inherited;
    }
    dir = path.dirname(dir);
  }
  return null;
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Last commit that touched the screen, as a YYYY-MM-DD day in the repo's log. */
async function lastTouched(dirs) {
  if (dirs.length === 0) return null;
  try {
    const { stdout } = await run("git", ["log", "-1", "--format=%cI", "--", ...dirs], {
      cwd: ROOT,
    });
    const iso = stdout.trim();
    return iso === "" ? null : iso.slice(0, 10);
  } catch {
    return null;
  }
}

const errors = [];
const warnings = [];

// ── Articles ────────────────────────────────────────────────────────────────
const articles = [];
for (const name of (await readdir(HELP_DIR)).filter((n) => n.endsWith(".md")).sort()) {
  try {
    articles.push(
      parseArticle(name.slice(0, -3), await readFile(path.join(HELP_DIR, name), "utf8"), name),
    );
  } catch (error) {
    errors.push(String(error.message ?? error));
  }
}
if (errors.length > 0) {
  console.error(`check-help: ${errors.length} article(s) could not be read\n`);
  for (const error of errors) console.error(`  · ${error}`);
  process.exit(1);
}

// ── Screens ─────────────────────────────────────────────────────────────────
const pages = (await walk(APP_DIR)).filter((file) => path.basename(file) === "page.tsx");
const known = new Map();
for (const file of pages) known.set(routeOf(file), file);

const required = pages.filter((file) => path.relative(ROOT, file).startsWith(REQUIRED_PREFIX));

// ── 1. Coverage ─────────────────────────────────────────────────────────────
for (const file of required) {
  const route = routeOf(file);
  if (route in EXEMPT) continue;
  const guarded = await rolesFor(file);
  if (!guarded) {
    errors.push(
      `${path.relative(ROOT, file)} uses no guard this script knows about.\n` +
        `    → teach it: add the guard to GUARDS in scripts/ops/check-help.mjs, ` +
        `or state the real audience in ROLE_OVERRIDES["${route}"].`,
    );
    continue;
  }
  const audience = ROLE_OVERRIDES[route] ?? guarded;
  const uncovered = audience.filter(
    (role) => !articles.some((a) => a.routes.includes(route) && a.roles.includes(role)),
  );
  if (uncovered.length > 0) {
    errors.push(
      `${route} is reachable by ${uncovered.join(", ")} and no article addresses ${uncovered.length > 1 ? "them" : "that role"}.\n` +
        `    → write content/help/<slug>.md with "routes: [${route}]" and those roles in "roles:",\n` +
        `      or add the screen to EXEMPT in scripts/ops/check-help.mjs with a one-line reason.`,
    );
  }
}

// ── 2. No dangling route ────────────────────────────────────────────────────
for (const article of articles) {
  for (const route of article.routes) {
    if (known.has(route)) continue;
    errors.push(
      `content/help/${article.slug}.md documents ${route}, which is not a screen of this application.\n` +
        `    → fix the path (dynamic segments are written as in the folder: /classes/[classId]/devoirs),\n` +
        `      or remove the route and the paragraphs that describe it.`,
    );
  }
}

// ── 3. Freshness ────────────────────────────────────────────────────────────
let judged = 0;
for (const article of articles) {
  const dirs = article.routes
    .map((route) => known.get(route))
    .filter(Boolean)
    .map((file) => path.relative(ROOT, path.dirname(file)));
  const touched = await lastTouched(dirs);
  if (!touched) continue;
  judged += 1;
  // Day granularity on purpose: touching a screen and re-reading its article on
  // the same day is the wanted behaviour, and must not turn the build red.
  if (touched > article.reviewed) {
    errors.push(
      `content/help/${article.slug}.md was reviewed on ${article.reviewed}, but ${dirs.length > 1 ? "one of the screens it documents" : "the screen it documents"} changed on ${touched}.\n` +
        `    → read the article against ${article.routes.join(", ")}, correct what has moved,\n` +
        `      then set "reviewed: ${touched}" (or today's date) in its front matter.`,
    );
  }
}
if (judged === 0 && articles.length > 0) {
  warnings.push(
    "no commit date could be read (shallow clone?) — freshness was not verified. " +
      "Use actions/checkout with fetch-depth: 0.",
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const warning of warnings) console.warn(`check-help: warning: ${warning}`);

if (errors.length > 0) {
  console.error(`\ncheck-help: ${errors.length} problem(s) in the in-app help\n`);
  for (const error of errors) console.error(`  · ${error}\n`);
  console.error(
    "The help is part of the deliverable: a screen without an article is a screen nobody can use.\n" +
      "See CLAUDE.md §9 — every session that adds or changes a screen updates its article and its reviewed: date.",
  );
  process.exit(1);
}

console.log(
  `check-help: ${articles.length} articles · ${required.length} screens covered for every role that reaches them · ${judged} checked against the git log`,
);
