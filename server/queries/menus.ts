import "server-only";

import { createClient } from "@/lib/supabase/server";

const MENU_SELECT = `
  id, week_start, published_at, updated_at,
  days:weekly_menu_days ( id, day, starter, main_course, side, dessert, snack, note )
` as const;

/**
 * The menus of a set of weeks, keyed by their Monday.
 *
 * One request whatever the number of weeks, the days embedded and sorted: the
 * reading screen asks for one week, the office screen for the week and the one
 * before it, so that « Dupliquer la semaine précédente » costs nothing more.
 * The database runs on the shared compute tier and every request is paid in
 * full (ADR-0067) — a screen that needs one thing asks for it once.
 */
export async function getWeeklyMenus(schoolId: string, weekStarts: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_menus")
    .select(MENU_SELECT)
    .eq("school_id", schoolId)
    .in("week_start", weekStarts);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      row.week_start,
      { ...row, days: [...row.days].sort((a, b) => a.day - b.day) },
    ]),
  );
}

export type WeeklyMenu = NonNullable<ReturnType<Awaited<ReturnType<typeof getWeeklyMenus>>["get"]>>;
export type WeeklyMenuDay = WeeklyMenu["days"][number];
