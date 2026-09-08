"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { publicEnv } from "@/lib/env";
import { ForbiddenError } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { ensureAccount, ensureMembership } from "@/server/actions/admin/accounts";

import { type ActionState, field, toActionError, uuid } from "./_shared";

const inviteSchema = z.object({
  email: z.email().max(254),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["school_admin", "staff", "teacher"]),
  locale: z.enum(["fr", "en"]),
});

/** Sends a sign-in link to an existing (confirmed) account. */
async function sendMagicLink(email: string, next = "/accueil"): Promise<boolean> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? publicEnv.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) console.warn("[invite] signInWithOtp:", error.message);
  return !error;
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.members");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = inviteSchema.safeParse({
      email: field(formData, "email").toLowerCase(),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      role: field(formData, "role"),
      locale: field(formData, "locale") || "fr",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const admin = createAdminClient();
    const account = await ensureAccount(admin, parsed.data);
    const added = await ensureMembership(supabase, schoolId, account.userId, parsed.data.role);
    if (!added) return { status: "error", message: t("alreadyMember") };

    const sent = await sendMagicLink(parsed.data.email);
    if (sent) {
      await supabase
        .from("memberships")
        .update({ invited_at: new Date().toISOString(), invited_by: user.id })
        .eq("school_id", schoolId)
        .eq("user_id", account.userId)
        .eq("role", parsed.data.role);
    }
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "membership.invite",
      entity: "memberships",
      entityId: account.userId,
      diff: { role: parsed.data.role, created: account.created, sent },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: sent ? t("invited") : t("invitedNoMail") };
  } catch (error) {
    return toActionError(error);
  }
}

/** "Réinitialisation d'accès": a fresh sign-in link for any member of the school. */
export async function resendInvitation(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const userId = field(formData, "userId");
  if (!uuid.test(userId)) return;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("memberships")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!member) throw new ForbiddenError();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) throw new Error(error?.message ?? "user not found");

  const sent = await sendMagicLink(data.user.email);
  if (sent) {
    await supabase
      .from("memberships")
      .update({ invited_at: new Date().toISOString(), invited_by: user.id })
      .eq("school_id", schoolId)
      .eq("user_id", userId);
  }
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "membership.resend_link",
    entity: "memberships",
    entityId: userId,
    diff: { sent },
  });
  revalidatePath("/admin", "layout");
}

const statusSchema = z.object({
  membershipId: z.string().regex(uuid),
  status: z.enum(["active", "suspended"]),
});

export async function setMembershipStatus(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const parsed = statusSchema.safeParse({
    membershipId: field(formData, "membershipId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("memberships")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.membershipId)
    .eq("school_id", schoolId)
    .neq("role", "super_admin")
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) return;
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: `membership.${parsed.data.status}`,
    entity: "memberships",
    entityId: parsed.data.membershipId,
  });
  revalidatePath("/admin", "layout");
}

export async function removeMembership(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const membershipId = field(formData, "membershipId");
  if (!uuid.test(membershipId)) return;
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("school_id", schoolId)
    .neq("role", "super_admin")
    .select("id");
  if (error) throw new Error(error.message);
  if (!removed?.length) return;
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "membership.remove",
    entity: "memberships",
    entityId: membershipId,
  });
  revalidatePath("/admin", "layout");
}

export type InvitationBatchState = ActionState & {
  sent?: number;
  remaining?: number;
  failed?: number;
};

/** Sends up to `limit` pending invitations per call (keeps each request short). */
export async function sendPendingInvitations(
  _prev: InvitationBatchState,
  formData: FormData,
): Promise<InvitationBatchState> {
  try {
    const t = await getTranslations("admin.members");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const limit = Math.min(Math.max(Number(field(formData, "limit") || 20), 1), 50);

    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: pending, error } = await supabase
      .from("memberships")
      .select("id, user_id")
      .eq("school_id", schoolId)
      .eq("status", "invited")
      .is("invited_at", null)
      .order("created_at")
      .limit(limit);
    if (error) return { status: "error", message: t("saveError") };

    let sent = 0;
    let failed = 0;
    for (const membership of pending ?? []) {
      const { data } = await admin.auth.admin.getUserById(membership.user_id);
      const email = data.user?.email;
      const ok = email ? await sendMagicLink(email) : false;
      if (ok) {
        sent++;
        await supabase
          .from("memberships")
          .update({ invited_at: new Date().toISOString(), invited_by: user.id })
          .eq("id", membership.id);
      } else {
        failed++;
      }
    }

    const { count } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "invited")
      .is("invited_at", null);

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "membership.send_invitations",
      entity: "memberships",
      diff: { sent, failed },
    });
    revalidatePath("/admin", "layout");
    return {
      status: "success",
      message: t("batchSent", { sent }),
      sent,
      failed,
      remaining: count ?? 0,
    };
  } catch (error) {
    return toActionError(error);
  }
}
