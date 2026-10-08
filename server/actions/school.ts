"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { APP_HOME_PATH, PERSPECTIVE_COOKIE, SCHOOL_COOKIE } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions";

/**
 * Switches the school someone works in (ADR-0074). Only a school they belong to
 * is accepted — the cookie is read back through the same check, so a forged
 * value would be ignored anyway. The perspective chosen in the previous school
 * may not exist in this one: it is dropped, and the highest one applies.
 */
export async function switchSchool(formData: FormData): Promise<void> {
  const value = formData.get("school");
  const user = await requireCurrentUser();
  if (typeof value !== "string" || !user.schools.some((school) => school.id === value)) {
    throw new ForbiddenError();
  }

  const store = await cookies();
  store.set(SCHOOL_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  store.delete(PERSPECTIVE_COOKIE);
  revalidatePath("/", "layout");
  redirect(APP_HOME_PATH);
}
