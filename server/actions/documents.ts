"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, toActionError, uuid } from "./admin/_shared";

/** Simple electronic signature: checkbox + timestamp + IP + user agent (brief §7.7). */
export async function signDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("documents");
    const user = await requireCurrentUser();
    const documentId = field(formData, "documentId");
    const studentId = field(formData, "studentId") || null;
    if (!uuid.test(documentId) || (studentId && !uuid.test(studentId)))
      return { status: "error", message: t("signError") };
    if (formData.get("consent") !== "on") return { status: "error", message: t("consentRequired") };

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const supabase = await createClient();
    const { data: doc } = await supabase
      .from("documents")
      .select("version")
      .eq("id", documentId)
      .maybeSingle();
    const { error } = await supabase.from("document_signatures").insert({
      document_id: documentId,
      user_id: user.id,
      student_id: studentId,
      document_version: doc?.version ?? 1,
      ip,
      user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    });
    if (error && error.code !== "23505") return { status: "error", message: t("signError") };

    revalidatePath("/documents");
    revalidatePath("/famille");
    return { status: "success", message: t("signed") };
  } catch (error) {
    return toActionError(error);
  }
}
