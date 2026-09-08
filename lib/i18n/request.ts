import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, LOCALE_COOKIE, TIME_ZONE, type Locale } from "./config";

/**
 * Locale resolution order (no locale prefix in URLs, see docs/DECISIONS.md ADR-0002):
 * 1. `NEXT_LOCALE` cookie (set by the locale switcher, later by the user profile),
 * 2. `Accept-Language` header,
 * 3. `fr` (default).
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .find(isLocale);

  return preferred ?? defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: TIME_ZONE,
  };
});
