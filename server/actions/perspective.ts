"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { APP_HOME_PATH, PERSPECTIVE_COOKIE } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { ForbiddenError, isPerspective } from "@/lib/permissions";

/** Switches the navigation perspective of a multi-role user (parent + teacher, …). */
export async function switchPerspective(formData: FormData): Promise<void> {
  const value = formData.get("perspective");
  const user = await requireCurrentUser();
  if (!isPerspective(value) || !user.perspectives.includes(value)) throw new ForbiddenError();

  (await cookies()).set(PERSPECTIVE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  redirect(APP_HOME_PATH);
}
