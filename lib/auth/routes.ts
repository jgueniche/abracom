export const LOGIN_PATH = "/connexion";
export const APP_HOME_PATH = "/accueil";
export const ONBOARDING_PATH = "/bienvenue";

/** Paths reachable without a session (the session cookie is still refreshed). */
const PUBLIC_PREFIXES = [
  "/connexion",
  "/auth/",
  "/dev/",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sw.js",
  "/hors-ligne",
  // authenticated by their own secret (private feed token, CRON_SECRET), never by a session
  "/api/calendar/",
  "/api/jobs/",
];

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeNextPath(value: unknown, fallback: string = APP_HOME_PATH): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  // control characters and spaces (raw or percent-encoded) are stripped by URL parsers and can
  // turn a relative path into an absolute one
  if (hasControlCharacter(value) || hasControlCharacter(decoded)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(value, "http://n");
  } catch {
    return fallback;
  }
  if (parsed.host !== "n" || parsed.protocol !== "http:") return fallback;
  if (value.startsWith("/auth/") || value.startsWith(LOGIN_PATH)) return fallback;
  return value;
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

export const PERSPECTIVE_COOKIE = "kesher-perspective";
