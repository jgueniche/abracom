/**
 * Help articles: front matter, role blocks, plain text.
 *
 * Plain `.mjs` on purpose. The application (TypeScript) and the freshness
 * guardrail (`scripts/ops/check-help.mjs`, a Node script run by `pnpm check`)
 * have to read an article exactly the same way. A second parser written for the
 * script would drift from this one the first time an article uses something it
 * does not know about, and a guardrail that disagrees with the page it guards is
 * worse than no guardrail at all.
 *
 * Nothing here touches the filesystem or the database: it takes a string and
 * gives back an object, so both consumers and the unit tests share one truth.
 */

/** The six roles of the brief (§7). An article says which of them it is for. */
export const HELP_ROLES = Object.freeze([
  "parent",
  "guardian",
  "teacher",
  "staff",
  "school_admin",
  "super_admin",
]);

/** The five shelves of `/aide`, in reading order. Labels live in next-intl. */
export const HELP_TOPICS = Object.freeze(["signin", "daily", "publish", "manage", "data"]);

const LIST_KEYS = new Set(["roles", "routes", "keywords"]);
const REQUIRED_KEYS = ["title", "roles", "routes", "topic", "keywords", "since", "reviewed"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Carries the file name, because a parse error is read by whoever broke it. */
export class HelpArticleError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "HelpArticleError";
    this.file = file;
  }
}

/** `[a, b]` → list · `all` → every role · anything else → a trimmed scalar. */
function parseValue(key, value) {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => unquote(item.trim()));
  }
  if (key === "roles" && value === "all") return [...HELP_ROLES];
  return unquote(value);
}

function unquote(value) {
  return value.replace(/^(['"])([\s\S]*)\1$/, "$2");
}

/**
 * Splits `---` front matter from the body. Deliberately not YAML: five key
 * shapes, no dependency, and an error message that names the offending line.
 */
export function parseFrontMatter(source, file = "article") {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(source);
  if (!match) {
    throw new HelpArticleError(file, "no front matter — the file must start with a `---` block");
  }
  const data = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new HelpArticleError(file, `front matter line without a "key: value" — ${line}`);
    }
    const key = line.slice(0, separator).trim();
    if (key in data) throw new HelpArticleError(file, `front matter key repeated — ${key}`);
    data[key] = parseValue(key, line.slice(separator + 1).trim());
  }
  return { data, body: source.slice(match[0].length) };
}

function assertRoles(file, key, roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new HelpArticleError(file, `${key} must be a non-empty list, or \`all\``);
  }
  for (const role of roles) {
    if (!HELP_ROLES.includes(role)) {
      throw new HelpArticleError(
        file,
        `unknown role "${role}" in ${key} (${HELP_ROLES.join(", ")})`,
      );
    }
  }
  return roles;
}

/**
 * One article, validated. `slug` is the file name: it is the URL, so a rename
 * breaks a bookmark — which is exactly why it is not a front-matter key someone
 * could change without noticing the file stayed put.
 */
export function parseArticle(slug, source, file = `${slug}.md`) {
  const { data, body } = parseFrontMatter(source, file);
  for (const key of REQUIRED_KEYS) {
    if (data[key] === undefined)
      throw new HelpArticleError(file, `missing front-matter key: ${key}`);
  }
  for (const key of Object.keys(data)) {
    if (!REQUIRED_KEYS.includes(key))
      throw new HelpArticleError(file, `unknown front-matter key: ${key}`);
  }
  for (const key of LIST_KEYS) {
    if (!Array.isArray(data[key]))
      throw new HelpArticleError(file, `${key} must be a list — [a, b]`);
  }
  assertRoles(file, "roles", data.roles);
  if (!HELP_TOPICS.includes(data.topic)) {
    throw new HelpArticleError(file, `unknown topic "${data.topic}" (${HELP_TOPICS.join(", ")})`);
  }
  for (const route of data.routes) {
    if (!route.startsWith("/"))
      throw new HelpArticleError(file, `route must start with "/" — ${route}`);
  }
  const since = Number(data.since);
  if (!Number.isInteger(since) || since < 1) {
    throw new HelpArticleError(
      file,
      `since must be the session number that introduced the screen — ${data.since}`,
    );
  }
  if (!DATE.test(String(data.reviewed))) {
    throw new HelpArticleError(file, `reviewed must be a YYYY-MM-DD date — ${data.reviewed}`);
  }
  if (body.trim() === "") throw new HelpArticleError(file, "the article has no body");
  assertRoleBlocks(body, file);

  return {
    slug,
    title: String(data.title),
    roles: [...data.roles],
    routes: [...data.routes],
    topic: data.topic,
    keywords: [...data.keywords],
    since,
    reviewed: String(data.reviewed),
    body,
  };
}

const BLOCK_OPEN = /^[ \t]*:::roles[ \t]+(.+?)[ \t]*$/;
const BLOCK_CLOSE = /^[ \t]*:::[ \t]*$/;

/** Fails on a stray or unclosed `:::` rather than silently swallowing a paragraph. */
function assertRoleBlocks(body, file) {
  let open = null;
  for (const line of body.split(/\r?\n/)) {
    const start = BLOCK_OPEN.exec(line);
    if (start) {
      if (open) throw new HelpArticleError(file, "a `:::roles` block cannot contain another one");
      open = assertRoles(
        file,
        "a `:::roles` block",
        start[1].split(",").map((role) => role.trim()),
      );
      continue;
    }
    if (BLOCK_CLOSE.test(line)) {
      if (!open) throw new HelpArticleError(file, "a `:::` closes a block that was never opened");
      open = null;
    }
  }
  if (open) throw new HelpArticleError(file, "a `:::roles` block is never closed");
}

/**
 * Keeps the sentences this reader is entitled to.
 *
 * A read-only guardian must never be told to "open the messaging" (brief, and
 * the four blockers of session 18). Rather than duplicating a whole article to
 * change one sentence — which is how three guides fell five sessions behind —
 * a paragraph declares its own audience and disappears for everyone else.
 */
export function filterBody(body, roles) {
  const audience = new Set(roles);
  const kept = [];
  let open = null;
  for (const line of body.split(/\r?\n/)) {
    const start = BLOCK_OPEN.exec(line);
    if (start) {
      open = start[1].split(",").map((role) => role.trim());
      continue;
    }
    if (BLOCK_CLOSE.test(line) && open) {
      open = null;
      continue;
    }
    if (open && !open.some((role) => audience.has(role))) continue;
    kept.push(line);
  }
  // A dropped block leaves its blank lines behind, which Markdown turns into a gap.
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Markdown reduced to the words, for search and for excerpts. */
export function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*][ \t]+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** First sentence or so of an article — the line under its title on `/aide`. */
export function excerpt(markdown, max = 160) {
  const text =
    plainText(markdown)
      .split("\n")
      .find((line) => line.trim() !== "") ?? "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Lower case, no diacritics: "Déclarer une absence" must be found by "declarer".
 * `french_unaccent` does the same thing in the database for `global_search()`;
 * articles are files, so the same rule is applied here (ADR-0045).
 */
export function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
