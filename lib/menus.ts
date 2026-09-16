/**
 * The shape of a weekly canteen menu, shared by the office form, the action
 * that saves it and the screen that reads it. Client-safe: no database here.
 */
import { addDays, type DateKey, isoWeekday, mondayOf } from "@/lib/calendar/dates";

/** The school days a menu can name: ISO weekdays, Monday to Friday. */
export const MENU_DAYS = [1, 2, 3, 4, 5] as const;
export type MenuDay = (typeof MENU_DAYS)[number];

/** The courses of a canteen day, in the order they are eaten. */
export const COURSES = ["starter", "mainCourse", "side", "dessert", "snack"] as const;
export type Course = (typeof COURSES)[number];

/** Everything a day carries: its courses and one free remark. */
export const DAY_FIELDS = [...COURSES, "note"] as const;
export type DayField = (typeof DAY_FIELDS)[number];
export type DayValues = Record<DayField, string>;

export const EMPTY_DAY: DayValues = {
  starter: "",
  mainCourse: "",
  side: "",
  dessert: "",
  snack: "",
  note: "",
};

/** The column of `weekly_menu_days` behind each field. */
export const COLUMN_OF = {
  starter: "starter",
  mainCourse: "main_course",
  side: "side",
  dessert: "dessert",
  snack: "snack",
  note: "note",
} as const satisfies Record<DayField, string>;

/** `mainCourse-3`: the form field of one course of one day. */
export function dayFieldName(day: number, field: DayField): string {
  return `${field}-${day}`;
}

/**
 * The week a reader is asking about on a given day.
 *
 * Monday to Friday, that is this week. On Saturday and Sunday it is the week
 * that starts: a canteen menu is looked up on a Sunday evening to know what
 * tomorrow holds, and `mondayOf()` alone would answer with the week that has
 * just ended — five days of meals already eaten.
 */
export function menuWeekOf(today: DateKey): DateKey {
  const monday = mondayOf(today);
  return isoWeekday(today) >= 6 ? addDays(monday, 7) : monday;
}
