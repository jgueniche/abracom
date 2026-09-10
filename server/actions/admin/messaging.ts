"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { zonedToUtc } from "@/lib/calendar/dates";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const SCOPES = ["teachers", "staff", "direction", "all"] as const;

const modeSchema = z.object({
  mode: z.enum(["open", "closed", "scheduled"]),
  scopes: z.array(z.enum(SCOPES)).min(1),
  urgencyContact: z.string().trim().max(200).nullable(),
});

/**
 * The school-wide tap (chantier A). `set_messaging_mode` normalises
 * `modules -> 'messaging'`, which the seed still stores as a bare `true`, and
 * writes the audit entry itself.
 */
export async function setMessagingMode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.messaging");
    const { schoolId } = await assertSchoolContext(["school_admin"]);
    const scopes = formData.getAll("scopes").map(String);
    const parsed = modeSchema.safeParse({
      mode: field(formData, "mode"),
      scopes: scopes.length > 0 ? scopes : ["teachers"],
      urgencyContact: optional(formData, "urgencyContact"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { error } = await supabase.rpc("set_messaging_mode", {
      school_: schoolId,
      mode_: parsed.data.mode,
      scopes_: parsed.data.scopes,
      urgency_: parsed.data.urgencyContact ?? undefined,
    });
    if (error) return { status: "error", message: t("saveError") };

    revalidatePath("/admin/messagerie");
    revalidatePath("/messages", "layout");
    return { status: "success", message: t("modeSaved") };
  } catch (error) {
    return toActionError(error);
  }
}

const windowSchema = z
  .object({
    kind: z.enum(["open", "closed"]),
    scope: z.enum(SCOPES),
    classId: z.string().regex(uuid).nullable(),
    targetUserId: z.string().regex(uuid).nullable(),
    opensAt: z.string().min(10),
    closesAt: z.string().min(10),
    note: z.string().trim().max(200).nullable(),
  })
  .refine((v) => v.closesAt > v.opensAt, { path: ["closesAt"] });

/** One dated period that opens or closes a channel — the "ponctuellement" of the brief. */
export async function createMessagingWindow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.messaging");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = windowSchema.safeParse({
      kind: field(formData, "kind"),
      scope: field(formData, "scope") || "teachers",
      classId: optional(formData, "classId"),
      targetUserId: optional(formData, "targetUserId"),
      opensAt: field(formData, "opensAt"),
      closesAt: field(formData, "closesAt"),
      note: optional(formData, "note"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const timeZone = user.school?.timezone ?? "Europe/Paris";
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("messaging_windows")
      .insert({
        school_id: schoolId,
        kind: parsed.data.kind,
        scope: parsed.data.scope,
        class_id: parsed.data.classId,
        target_user_id: parsed.data.targetUserId,
        opens_at: zonedToUtc(parsed.data.opensAt, timeZone).toISOString(),
        closes_at: zonedToUtc(parsed.data.closesAt, timeZone).toISOString(),
        note: parsed.data.note,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: `messaging.window.${parsed.data.kind}`,
      entity: "messaging_windows",
      entityId: data.id,
      diff: {
        scope: parsed.data.scope,
        opensAt: parsed.data.opensAt,
        closesAt: parsed.data.closesAt,
      },
    });
    revalidatePath("/admin/messagerie");
    revalidatePath("/messages", "layout");
    return { status: "success", message: t("windowSaved") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteMessagingWindow(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const windowId = field(formData, "windowId");
  if (!uuid.test(windowId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("messaging_windows")
    .delete()
    .eq("id", windowId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "messaging.window.delete",
      entity: "messaging_windows",
      entityId: windowId,
    });
  revalidatePath("/admin/messagerie");
  revalidatePath("/messages", "layout");
}
