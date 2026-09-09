import "server-only";

import {
  type ChannelPreference,
  DEFAULT_QUIET_HOURS,
  defaultChannels,
  NOTIFICATION_GROUPS,
  type NotificationGroup,
  parseQuietHours,
  type QuietHours,
} from "@/lib/notifications/kinds";
import { createClient } from "@/lib/supabase/server";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getNotifications(userId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, payload, channel, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type NotificationPreferences = {
  channels: Record<NotificationGroup, ChannelPreference>;
  quietHours: QuietHours | null;
  shabbatMode: boolean;
};

/** Stored rows merged with the defaults (see `effective_preference()` in SQL). */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("kind, push, email, digest, quiet_hours, shabbat_mode")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = data ?? [];
  const channels = Object.fromEntries(
    NOTIFICATION_GROUPS.map((group) => {
      const row = rows.find((r) => r.kind === group);
      const base = defaultChannels(group);
      return [
        group,
        row
          ? { push: row.push, email: group === "message" ? false : row.email, digest: row.digest }
          : base,
      ];
    }),
  ) as Record<NotificationGroup, ChannelPreference>;
  const global = rows.find((r) => r.kind === "*");
  const quiet = global ? parseQuietHours(global.quiet_hours) : DEFAULT_QUIET_HOURS;
  return {
    channels,
    quietHours: quiet && quiet.start !== quiet.end ? quiet : null,
    shabbatMode: global ? global.shabbat_mode : true,
  };
}
