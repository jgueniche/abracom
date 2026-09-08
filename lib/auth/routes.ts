export const LOGIN_PATH = "/connexion";
export const APP_HOME_PATH = "/accueil";
export const ONBOARDING_PATH = "/bienvenue";

/** Paths reachable without a session (the session cookie is still refreshed). */
const PUBLIC_PREFIXES = ["/connexion", "/auth/", "/dev/", "/manifest.webmanifest", "/robots.txt"];

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeNextPath(value: unknown, fallback: string = APP_HOME_PATH): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value.startsWith("/auth/") || value.startsWith(LOGIN_PATH)) return fallback;
  return value;
}

export const PERSPECTIVE_COOKIE = "kesher-perspective";
