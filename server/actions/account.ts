"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LOGIN_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, toActionError } from "./admin/_shared";

/**
 * Self-service account deletion (docs/RGPD.md): the SQL function anonymises and detaches the
 * data, then the auth account itself is removed when the service key is configured.
 */
export async function deleteMyAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("dataRights");
    const user = await requireCurrentUser();
    if (field(formData, "confirm").toUpperCase() !== t("confirmWord").toUpperCase()) {
      return { status: "error", message: t("confirmMismatch") };
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      return { status: "error", message: error.code === "23514" ? error.message : t("error") };
    }
    if (getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient();
      await admin.auth.admin.deleteUser(user.id);
    }
    await supabase.auth.signOut();
  } catch (error) {
    return toActionError(error);
  }
  redirect(`${LOGIN_PATH}?deleted=1`);
}
