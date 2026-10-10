"use server";

import { getTranslations } from "next-intl/server";

import { assertSchoolContext } from "@/lib/auth/guards";
import type { CredentialsState } from "@/lib/auth/credentials";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import { isSuperAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { field, toActionError, uuid } from "./_shared";

/**
 * « Nouveau mot de passe provisoire » (ADR-0075): until e-mail is connected, it
 * is how someone who forgot their password gets back in — the school gives them
 * a new provisional one, to replace at their next sign-in.
 *
 * It replaces a password, so who may be given one is narrow. A member of this
 * school, never oneself, never a platform administrator. And unless the platform
 * administrator asks, nobody who also belongs to another school (that school did
 * not ask) nor anyone of the direction (a director would otherwise take over a
 * fellow director's account). The previous password stops working at once.
 */
export async function giveTemporaryPassword(
  _previous: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  try {
    const t = await getTranslations("admin.passwords");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const userId = field(formData, "userId");
    if (!uuid.test(userId) || userId === user.id) {
      return { status: "error", message: t("refused") };
    }

    // The service key sees every membership of the person, in every school —
    // which is what the rules above need to look at.
    const admin = createAdminClient();
    const { data: memberships, error } = await admin
      .from("memberships")
      .select("school_id, role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const rows = memberships ?? [];
    const platform = isSuperAdmin(user.roles);
    const refused =
      !rows.some((m) => m.school_id === schoolId) ||
      rows.some((m) => m.role === "super_admin") ||
      (!platform && rows.some((m) => m.school_id !== schoolId || m.role === "school_admin"));
    if (refused) return { status: "error", message: t("refused") };

    const password = temporaryPassword();
    const { data, error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      app_metadata: { password_provisional: true },
    });
    if (updateError || !data.user) {
      throw new Error(updateError?.message ?? "updateUserById failed");
    }

    const supabase = await createClient();
    const [{ data: profile }] = await Promise.all([
      admin.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
      logAudit(supabase, {
        schoolId,
        actorId: user.id,
        action: "account.temporary_password",
        entity: "profiles",
        entityId: userId,
      }),
    ]);
    return {
      status: "success",
      credentials: [
        {
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "",
          email: data.user.email ?? "",
          password,
        },
      ],
    };
  } catch (error) {
    return toActionError(error);
  }
}
