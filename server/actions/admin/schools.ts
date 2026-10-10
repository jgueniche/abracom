"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, toActionError } from "./_shared";

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120),
});

export type OpenSchoolState = ActionState & { schoolId?: string; schoolName?: string };

/**
 * Opens a school (ADR-0074): the platform administrator only. `create_school`
 * gives it its nine levels and its creator its direction, so it appears in the
 * school selector at once — empty, as a real school starts.
 */
export async function openSchool(
  _previous: OpenSchoolState,
  formData: FormData,
): Promise<OpenSchoolState> {
  try {
    const t = await getTranslations("admin.schools");
    await assertSchoolContext(["super_admin"]);
    const parsed = schoolSchema.safeParse({
      name: field(formData, "name"),
      city: field(formData, "city"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_school", {
      p_name: parsed.data.name,
      p_city: parsed.data.city || undefined,
    });
    if (error || !data) throw new Error(error?.message ?? "create_school failed");

    // every page reads the schools of the reader: the selector must learn of this one
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: t("opened", { name: parsed.data.name }),
      schoolId: data,
      schoolName: parsed.data.name,
    };
  } catch (error) {
    return toActionError(error);
  }
}

const testPasswordSchema = z.object({
  password: z.string().min(10).max(72),
  confirm: z.string().max(72),
});

/**
 * Sets the one password of the test school's accounts — the « Espace de test »
 * door's (ADR-0073). Through the service key, because it writes `auth.users`;
 * the function itself never touches a platform administrator nor anyone who
 * also belongs to a real school.
 */
export async function setTestPassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.schools");
    const { user } = await assertSchoolContext(["super_admin"]);
    const parsed = testPasswordSchema.safeParse({
      password: String(formData.get("password") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
    if (!parsed.success) return { status: "error", message: t("testPasswordTooShort") };
    if (parsed.data.password !== parsed.data.confirm) {
      return { status: "error", message: t("testPasswordMismatch") };
    }

    const admin = createAdminClient();
    const { data: count, error } = await admin.rpc("set_test_school_password", {
      p_password: parsed.data.password,
    });
    if (error) throw new Error(error.message);

    const supabase = await createClient();
    const { data: testSchool } = await supabase
      .from("schools")
      .select("id")
      .contains("modules", { test: true })
      .limit(1)
      .maybeSingle();
    if (testSchool) {
      await logAudit(supabase, {
        schoolId: testSchool.id,
        actorId: user.id,
        action: "test_school.password",
        entity: "schools",
        entityId: testSchool.id,
        diff: { accounts: count ?? 0 },
      });
    }
    return { status: "success", message: t("testPasswordSet", { count: count ?? 0 }) };
  } catch (error) {
    return toActionError(error);
  }
}
