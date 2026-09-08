"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { LOCALE_COOKIE, locales } from "./config";

const localeSchema = z.enum(locales);

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Server Action: persists the UI locale in a cookie and re-renders the tree. */
export async function setLocale(input: unknown): Promise<void> {
  const locale = localeSchema.parse(input);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
