export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Cookie read by `lib/i18n/request.ts` (until the user profile carries a locale, session 4). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const TIME_ZONE = "Europe/Paris";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
