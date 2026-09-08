"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getMfaStatus } from "@/lib/auth/mfa";
import { APP_HOME_PATH, safeNextPath } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { requiresStrongAuth } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, toActionError } from "./admin/_shared";

export type EnrollmentState = ActionState & {
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

const CODE = /^\d{6}$/;

/** Starts a TOTP enrolment: returns the QR code (SVG data URL) and the secret for manual entry. */
export async function startTotpEnrollment(): Promise<EnrollmentState> {
  try {
    const t = await getTranslations("security");
    await requireCurrentUser();
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Kesher",
    });
    if (error || !data) return { status: "error", message: t("error") };
    return {
      status: "idle",
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function confirmTotpEnrollment(
  _prev: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  try {
    const t = await getTranslations("security");
    const user = await requireCurrentUser();
    const factorId = field(formData, "factorId");
    const code = field(formData, "code").replace(/\s+/g, "");
    if (!factorId || !CODE.test(code)) return { status: "error", message: t("invalidCode") };
    const supabase = await createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) return { status: "error", message: t("error") };
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return { status: "error", message: t("invalidCode") };
    if (user.school) {
      await logAudit(supabase, {
        schoolId: user.school.id,
        actorId: user.id,
        action: "security.mfa_enabled",
        entity: "profiles",
        entityId: user.id,
      });
    }
    revalidatePath("/profil", "layout");
    return { status: "success", message: t("enabled") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Disables TOTP after a fresh code; school administrators cannot disable it (brief §9). */
export async function disableTotp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("security");
    const user = await requireCurrentUser();
    if (requiresStrongAuth(user.roles)) {
      return { status: "error", message: t("adminCannotDisable") };
    }
    const status = await getMfaStatus();
    const code = field(formData, "code").replace(/\s+/g, "");
    if (!status.factorId || !CODE.test(code)) return { status: "error", message: t("invalidCode") };
    const supabase = await createClient();
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: status.factorId });
    if (!challenge) return { status: "error", message: t("error") };
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: status.factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) return { status: "error", message: t("invalidCode") };
    const { error } = await supabase.auth.mfa.unenroll({ factorId: status.factorId });
    if (error) return { status: "error", message: t("error") };
    if (user.school) {
      await logAudit(supabase, {
        schoolId: user.school.id,
        actorId: user.id,
        action: "security.mfa_disabled",
        entity: "profiles",
        entityId: user.id,
      });
    }
    revalidatePath("/profil", "layout");
    return { status: "success", message: t("disabled") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Second step of the sign-in for enrolled users: elevates the session to AAL2. */
export async function verifyLoginTotp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("verification");
    await requireCurrentUser();
    const status = await getMfaStatus();
    const code = field(formData, "code").replace(/\s+/g, "");
    const next = safeNextPath(field(formData, "next"), APP_HOME_PATH);
    if (!status.factorId) redirect(next);
    if (!CODE.test(code)) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: status.factorId });
    if (!challenge) return { status: "error", message: t("invalid") };
    const { error } = await supabase.auth.mfa.verify({
      factorId: status.factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) return { status: "error", message: t("invalid") };
    redirect(next);
  } catch (error) {
    return toActionError(error);
  }
}
