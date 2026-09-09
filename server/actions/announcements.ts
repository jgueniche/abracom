"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Idempotent read receipt (called when the announcement is displayed). */
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  if (!UUID.test(announcementId)) return;
  const user = await requireCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("announcement_reads")
    .upsert(
      { announcement_id: announcementId, user_id: user.id },
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
    );
}

/** "J'ai lu" — explicit acknowledgement requested by the direction. */
export async function acknowledgeAnnouncement(formData: FormData): Promise<void> {
  const announcementId = String(formData.get("announcementId") ?? "");
  if (!UUID.test(announcementId)) return;
  const user = await requireCurrentUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert(
      { announcement_id: announcementId, user_id: user.id, read_at: now, acked_at: now },
      { onConflict: "announcement_id,user_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/annonces");
  revalidatePath("/accueil");
}
