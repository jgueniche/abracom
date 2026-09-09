import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { MembershipRole } from "@/lib/supabase/types";

export type AccountInput = {
  email: string;
  firstName: string;
  lastName: string;
  locale: "fr" | "en";
  phone?: string | null;
};
export type AccountResult = { userId: string; created: boolean };

/**
 * Finds the auth user for an e-mail or creates it (confirmed, no e-mail sent).
 * The invitation e-mail itself is sent later, in batches (`sendPendingInvitations`).
 */
export async function ensureAccount(
  admin: ReturnType<typeof createAdminClient>,
  input: AccountInput,
): Promise<AccountResult> {
  const { data: existing, error: lookupError } = await admin.rpc("find_user_id_by_email", {
    email: input.email,
  });
  if (lookupError) throw new Error(lookupError.message);
  if (existing) return { userId: existing, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { first_name: input.firstName, last_name: input.lastName, locale: input.locale },
  });
  if (error || !data.user) throw new Error(error?.message ?? "createUser failed");
  if (input.phone) {
    await admin
      .from("profile_contacts")
      .upsert({ user_id: data.user.id, phone: input.phone }, { onConflict: "user_id" });
  }
  return { userId: data.user.id, created: true };
}

/** Adds the membership (status `invited`) unless the user already holds that role in the school. */
export async function ensureMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  userId: string,
  role: MembershipRole,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (existing) return false;
  const { error } = await supabase
    .from("memberships")
    .insert({ school_id: schoolId, user_id: userId, role, status: "invited" });
  if (error) throw new Error(error.message);
  return true;
}
