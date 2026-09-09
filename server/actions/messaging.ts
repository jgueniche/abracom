"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { type MessageAttachment, REACTION_EMOJIS } from "@/lib/messaging/format";
import { safeFileName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { getMessagesBefore } from "@/server/queries/messaging";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

const MESSAGE_ATTACHMENT_MAX = 10 * 1024 * 1024;
const MESSAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const sendSchema = z.object({
  threadId: z.string().regex(uuid),
  body: z.string().trim().max(5000),
  replyTo: z.string().regex(uuid).nullable(),
});

export type SendState = ActionState & {
  sent?: {
    id: string;
    thread_id: string;
    author_id: string | null;
    body: string;
    attachments: MessageAttachment[];
    reply_to: string | null;
    created_at: string;
  };
};

export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  try {
    const t = await getTranslations("messaging");
    const user = await requireCurrentUser();
    const parsed = sendSchema.safeParse({
      threadId: field(formData, "threadId"),
      body: String(formData.get("body") ?? ""),
      replyTo: optional(formData, "replyTo"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, 3);
    if (!parsed.data.body && files.length === 0) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: thread } = await supabase
      .from("threads")
      .select("school_id")
      .eq("id", parsed.data.threadId)
      .maybeSingle();
    if (!thread) return { status: "error", message: t("sendError") };

    const attachments: MessageAttachment[] = [];
    for (const file of files) {
      if (file.size > MESSAGE_ATTACHMENT_MAX || !MESSAGE_MIME.has(file.type))
        return { status: "error", message: t("fileType") };
      const path = `${thread.school_id}/${parsed.data.threadId}/${safeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from("messages")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return { status: "error", message: t("uploadError") };
      attachments.push({ path, name: file.name.slice(0, 120), size: file.size, mime: file.type });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        thread_id: parsed.data.threadId,
        author_id: user.id,
        body: parsed.data.body,
        attachments,
        reply_to: parsed.data.replyTo,
      })
      .select("id, thread_id, author_id, body, attachments, reply_to, created_at")
      .single();
    if (error) {
      if (attachments.length > 0)
        await supabase.storage.from("messages").remove(attachments.map((a) => a.path));
      return {
        status: "error",
        message: error.code === "42501" ? t("notAllowed") : t("sendError"),
      };
    }

    await supabase
      .from("thread_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", parsed.data.threadId)
      .eq("user_id", user.id);
    revalidatePath("/messages");
    return { status: "success", sent: { ...data, attachments } };
  } catch (error) {
    return toActionError(error);
  }
}

/** Client-callable pagination for the thread view ("older messages"). */
export async function fetchOlderMessages(threadId: string, before: string) {
  if (!uuid.test(threadId) || Number.isNaN(Date.parse(before))) return [];
  await requireCurrentUser();
  return getMessagesBefore(threadId, before);
}

export async function markThreadRead(threadId: string): Promise<void> {
  if (!uuid.test(threadId)) return;
  const user = await requireCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);
}

export async function toggleMute(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const threadId = field(formData, "threadId");
  if (!uuid.test(threadId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("thread_members")
    .select("muted")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("thread_members")
    .update({ muted: !data.muted })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
}

export async function toggleReaction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const messageId = field(formData, "messageId");
  const emoji = field(formData, "emoji");
  if (!uuid.test(messageId) || !(REACTION_EMOJIS as readonly string[]).includes(emoji)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();
  if (data) {
    await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
  } else {
    await supabase
      .from("message_reactions")
      .insert({ message_id: messageId, user_id: user.id, emoji });
  }
}

export async function deleteOwnMessage(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const messageId = field(formData, "messageId");
  if (!uuid.test(messageId)) return;
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("author_id", user.id);
}

const moderateSchema = z.object({
  messageId: z.string().regex(uuid),
  reason: z.string().trim().min(1).max(300),
});

/** Moderators / direction remove a message with a reason (audited). */
export async function moderateMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("messaging");
    const user = await requireCurrentUser();
    const parsed = moderateSchema.safeParse({
      messageId: field(formData, "messageId"),
      reason: field(formData, "reason"),
    });
    if (!parsed.success) return { status: "error", message: t("reasonRequired") };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        moderated_by: user.id,
        moderation_reason: parsed.data.reason,
      })
      .eq("id", parsed.data.messageId)
      .select("id, thread:threads ( school_id )")
      .maybeSingle();
    if (error || !data) return { status: "error", message: t("notAllowed") };
    if (data.thread) {
      await logAudit(supabase, {
        schoolId: data.thread.school_id,
        actorId: user.id,
        action: "message.moderate",
        entity: "messages",
        entityId: parsed.data.messageId,
        diff: { reason: parsed.data.reason },
      });
    }
    await supabase
      .from("reports")
      .update({
        status: "resolved",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: parsed.data.reason,
      })
      .eq("message_id", parsed.data.messageId)
      .eq("status", "open");
    revalidatePath("/admin/signalements");
    return { status: "success", message: t("moderated") };
  } catch (error) {
    return toActionError(error);
  }
}

const reportSchema = z.object({
  messageId: z.string().regex(uuid),
  reason: z.string().trim().min(1).max(500),
});

export async function reportMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("messaging");
    const user = await requireCurrentUser();
    const parsed = reportSchema.safeParse({
      messageId: field(formData, "messageId"),
      reason: field(formData, "reason"),
    });
    if (!parsed.success) return { status: "error", message: t("reasonRequired") };
    const supabase = await createClient();
    const { data: message } = await supabase
      .from("messages")
      .select("thread:threads ( school_id )")
      .eq("id", parsed.data.messageId)
      .maybeSingle();
    if (!message?.thread) return { status: "error", message: t("sendError") };
    const { error } = await supabase.from("reports").insert({
      school_id: message.thread.school_id,
      message_id: parsed.data.messageId,
      reporter_id: user.id,
      reason: parsed.data.reason,
    });
    if (error) return { status: "error", message: t("sendError") };
    return { status: "success", message: t("reported") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resolveReport(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const reportId = field(formData, "reportId");
  if (!uuid.test(reportId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: optional(formData, "note"),
    })
    .eq("id", reportId)
    .select("school_id")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId: data.school_id,
      actorId: user.id,
      action: "report.resolve",
      entity: "reports",
      entityId: reportId,
    });
  revalidatePath("/admin/signalements");
}

const stateSchema = z.object({
  threadId: z.string().regex(uuid),
  locked: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function setThreadState(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const parsed = stateSchema.safeParse({
    threadId: field(formData, "threadId"),
    locked: formData.has("locked") ? formData.get("locked") === "true" : undefined,
    archived: formData.has("archived") ? formData.get("archived") === "true" : undefined,
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const patch: { locked?: boolean; archived?: boolean } = {};
  if (parsed.data.locked !== undefined) patch.locked = parsed.data.locked;
  if (parsed.data.archived !== undefined) patch.archived = parsed.data.archived;
  const { data } = await supabase
    .from("threads")
    .update(patch)
    .eq("id", parsed.data.threadId)
    .select("school_id")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId: data.school_id,
      actorId: user.id,
      action: "thread.update",
      entity: "threads",
      entityId: parsed.data.threadId,
      diff: patch,
    });
  revalidatePath(`/messages/${parsed.data.threadId}`);
  revalidatePath("/messages");
}

export async function openDm(formData: FormData): Promise<void> {
  const other = field(formData, "userId");
  if (!uuid.test(other)) return;
  await requireCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_dm", { other });
  if (error || !data) throw new Error(error?.message ?? "open_dm failed");
  redirect(`/messages/${data}`);
}

export async function openClassGroup(formData: FormData): Promise<void> {
  const classId = field(formData, "classId");
  if (!uuid.test(classId)) return;
  await requireCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_class_threads", { class_: classId });
  const row = data?.[0];
  if (error || !row?.parents_group)
    throw new Error(error?.message ?? "ensure_class_threads failed");
  redirect(`/messages/${row.parents_group}`);
}
