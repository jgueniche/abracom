/**
 * The calendar of homework, shared by the diary, the class tab, the composer and their tests.
 * Client-safe: no database, no request, only dates and names.
 */
import {
  addDays,
  type DateKey,
  isoWeekday,
  localDateKey,
  localTime,
  mondayOf,
} from "@/lib/calendar/dates";

export const SCHOOL_TIME_ZONE = "Europe/Paris";

/**
 * From this hour, the homework due today has been handed in: what a parent opens the diary for
 * is the next school day. A Tuesday-evening reader used to land on a list whose first group was
 * Tuesday — what the child gave in at 8:30 — with Wednesday's homework below it.
 */
export const HANDED_IN_AT = "12:00";

export function isSchoolDay(day: DateKey): boolean {
  return isoWeekday(day) <= 5;
}

/** The first school day strictly after `day`. */
export function nextSchoolDay(day: DateKey): DateKey {
  let next = addDays(day, 1);
  while (!isSchoolDay(next)) next = addDays(next, 1);
  return next;
}

/**
 * The day the reader is preparing for: today until noon if today is a school day, otherwise the
 * next school day — the Monday, on a Friday afternoon or over the weekend.
 */
export function pivotDay(now: Date, timeZone = SCHOOL_TIME_ZONE): DateKey {
  const today = localDateKey(now, timeZone);
  if (isSchoolDay(today) && localTime(now, timeZone) < HANDED_IN_AT) return today;
  return nextSchoolDay(today);
}

/**
 * The week the diary opens on: the week of the day being prepared. On a Friday afternoon and
 * over the weekend that is the week that starts — answering with the week that has just ended
 * meant opening on five days of homework already handed in (the menus had the same fault, and
 * the same answer: `menuWeekOf`).
 */
export function defaultWeek(now: Date, timeZone = SCHOOL_TIME_ZONE): DateKey {
  return mondayOf(pivotDay(now, timeZone));
}

/** The days of a week as the diary shows them: Monday to Friday, and a weekend day only if used. */
export function weekDays(monday: DateKey, used: ReadonlySet<DateKey> = new Set()): DateKey[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index)).filter(
    (day, index) => index < 5 || used.has(day),
  );
}

/** The next `count` school days after `day` — the composer's "for when?" choices. */
export function upcomingSchoolDays(day: DateKey, count: number): DateKey[] {
  const days: DateKey[] = [];
  let cursor = day;
  while (days.length < count) {
    cursor = nextSchoolDay(cursor);
    days.push(cursor);
  }
  return days;
}

/** "Mathématiques ", "mathematiques" and "MATHÉMATIQUES" are one subject. */
export function normalizeSubject(subject: string): string {
  return subject.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type TimetableSlot = { weekday: number; subject: string };

/**
 * The next day after `after` on which the class has a lesson of `subject` — "pour la prochaine
 * séance", which is how a teacher actually thinks a due date. Null when the timetable does not
 * know the subject.
 */
export function nextLessonDay(
  slots: readonly TimetableSlot[],
  subject: string,
  after: DateKey,
): DateKey | null {
  const wanted = normalizeSubject(subject);
  if (!wanted) return null;
  const weekdays = new Set(
    slots.filter((slot) => normalizeSubject(slot.subject) === wanted).map((slot) => slot.weekday),
  );
  if (weekdays.size === 0) return null;
  for (let offset = 1; offset <= 14; offset++) {
    const day = addDays(after, offset);
    if (weekdays.has(isoWeekday(day))) return day;
  }
  return null;
}

/**
 * The subjects a composer suggests: those of the class timetable first, in the order of the
 * week, then those already used for this class's homework — each named once, as it was written
 * the first time it appeared.
 */
export function suggestedSubjects(
  slots: readonly TimetableSlot[],
  used: readonly (string | null)[],
  limit = 8,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...slots.map((slot) => slot.subject), ...used]) {
    const clean = name?.trim();
    if (!clean) continue;
    const key = normalizeSubject(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Eight hues, each one a stroke the eye finds again from day to day: French is always the same
 * blue, the Jewish studies always the same violet. The colour is never the only carrier — the
 * subject is written beside it — so a reader who cannot tell them apart loses nothing.
 */
export const SUBJECT_TONES = [
  "blue",
  "green",
  "violet",
  "amber",
  "teal",
  "rose",
  "red",
  "slate",
] as const;
export type SubjectTone = (typeof SUBJECT_TONES)[number];

const KNOWN: ReadonlyArray<[RegExp, SubjectTone]> = [
  [
    /^(francais|lecture|ecriture|dictee|poesie|grammaire|conjugaison|orthographe|vocabulaire|langage|production d'ecrit|copie|redaction)/,
    "blue",
  ],
  [/^(math|calcul|geometrie|numeration|mesures|problemes)/, "green"],
  [
    /^(hebreu|ivrit|kodech|torah|limoud|paracha|houmach|michna|talmud|guemara|kriah|tefila|judaisme|halakha)/,
    "violet",
  ],
  [/^(anglais|english|langue vivante|lv)/, "amber"],
  [
    /^(histoire|geographie|sciences|questionner le monde|decouverte du monde|emc|enseignement moral)/,
    "teal",
  ],
  [/^(arts|art|musique|chant|dessin|arts plastiques|education musicale)/, "rose"],
  [/^(eps|sport|education physique|motricite|piscine)/, "red"],
];

export function subjectTone(subject: string | null | undefined): SubjectTone {
  const key = normalizeSubject(subject ?? "");
  if (!key) return "slate";
  for (const [pattern, tone] of KNOWN) if (pattern.test(key)) return tone;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SUBJECT_TONES[Math.abs(hash) % SUBJECT_TONES.length]!;
}

/** "Pour aujourd'hui", "Pour demain", "Pour lundi": how the day being prepared is named. */
export function pivotLabel(pivot: DateKey, now: Date, timeZone = SCHOOL_TIME_ZONE) {
  const today = localDateKey(now, timeZone);
  if (pivot === today) return "today" as const;
  if (pivot === addDays(today, 1)) return "tomorrow" as const;
  return "weekday" as const;
}

/** `postId:studentId` — one child's tick on one homework, the key every progress count uses. */
export function doneKey(postId: string, studentId: string): string {
  return `${postId}:${studentId}`;
}

/** Done / total for a set of homework keys, never dividing by zero. */
export function progressOf(total: number, done: number) {
  return { total, done: Math.min(done, total), complete: total > 0 && done >= total };
}
