import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { addDays, type DateKey, localDateKey, mondayOf, zonedToUtc } from "@/lib/calendar/dates";
import { articlesFor, toSearchEntry } from "@/lib/help/articles";
import { helpRolesFor } from "@/lib/help/roles";
import { buildIndex, searchHelp } from "@/lib/help/search";
import { SCHOOL_TIME_ZONE } from "@/lib/homework";
import { canUseMessaging, isSchoolStaff, rolesIn } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { plainExcerpt } from "@/lib/text";
import { getAgendaEvents } from "@/server/queries/agenda";
import { getAnnouncementsForUser } from "@/server/queries/announcements";
import { getHomeworkDiary } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getMyChildren } from "@/server/queries/family";
import { getWeeklyMenus } from "@/server/queries/menus";
import { globalSearch, hrefForResult } from "@/server/queries/search";

import type { AssistantLink, Plan, ToolArgs, ToolName } from "./plan";

/**
 * The reader, as the assistant knows them, and the seven tools it may run (ADR-0088).
 *
 * Every tool calls a query the application already runs for its own screens, with the reader's
 * own Supabase client — the row policies decide what comes back, as they do on screen. The
 * assistant therefore cannot tell a parent anything about a child that is not theirs: the
 * database does not give it to them. What leaves for the model is the result, cut to what an
 * answer needs — a homework's title and the start of its instruction, never a whole thread, an
 * assessment or the reason given for an absence.
 */

export type ReaderContext = {
  user: CurrentUser;
  schoolId: string | null;
  schoolName: string | null;
  today: DateKey;
  roles: string[];
  isFamily: boolean;
  isTeam: boolean;
  isStaff: boolean;
  canMessage: boolean;
  children: { id: string; firstName: string; classId: string | null; className: string | null }[];
  teaching: { id: string; name: string }[];
};

export async function readerContext(user: CurrentUser): Promise<ReaderContext> {
  const schoolId = user.school?.id ?? null;
  const [children, teaching] = await Promise.all([getMyChildren(), getMyTeachingClasses(user.id)]);
  const roles = [...new Set(rolesIn(user.roles, schoolId ?? undefined).map((r) => r.role))];
  return {
    user,
    schoolId,
    schoolName: user.school?.name ?? null,
    today: localDateKey(new Date(), SCHOOL_TIME_ZONE),
    roles,
    isFamily: roles.includes("parent") || roles.includes("guardian"),
    isTeam: roles.includes("teacher") || (schoolId ? isSchoolStaff(user.roles, schoolId) : false),
    isStaff: schoolId ? isSchoolStaff(user.roles, schoolId) : false,
    canMessage: schoolId ? canUseMessaging(user.roles, schoolId) : false,
    children: children.map((row) => {
      const enrolment = row.student.enrollments[0];
      return {
        id: row.student.id,
        firstName: row.student.first_name,
        classId: enrolment?.class?.id ?? null,
        className: enrolment?.class?.name ?? null,
      };
    }),
    teaching: teaching.flatMap((row) =>
      row.class ? [{ id: row.class.id, name: row.class.name }] : [],
    ),
  };
}

export type ToolResult = {
  tool: ToolName;
  /** What the model reads: compact, already filtered by the policies. */
  data: unknown;
  /** Links the answer may use, and only these. */
  links: AssistantLink[];
};

const MAX_DAYS = 31;

function range(args: ToolArgs, ctx: ReaderContext, back = 0, ahead = 7) {
  const from = args.from ?? addDays(ctx.today, back);
  let to = args.to ?? addDays(ctx.today, ahead);
  if (to < from) to = from;
  if (to > addDays(from, MAX_DAYS)) to = addDays(from, MAX_DAYS);
  return { from, to };
}

function childrenNamed(ctx: ReaderContext, name: string | undefined) {
  if (!name) return ctx.children;
  const wanted = name.toLowerCase();
  const found = ctx.children.filter((child) => child.firstName.toLowerCase() === wanted);
  return found.length > 0 ? found : ctx.children;
}

const RUNNERS: Record<ToolName, (args: ToolArgs, ctx: ReaderContext) => Promise<ToolResult>> = {
  async homework(args, ctx) {
    const { from, to } = range(args, ctx);
    const kids = childrenNamed(ctx, args.child);
    const classIds = [
      ...new Set([
        ...kids.flatMap((child) => (child.classId ? [child.classId] : [])),
        ...(args.child ? [] : ctx.teaching.map((cls) => cls.id)),
      ]),
    ];
    if (classIds.length === 0)
      return { tool: "homework", data: { from, to, items: [] }, links: [] };
    const entries = (await getHomeworkDiary(classIds, from, to)).filter((e) => e.published_at);
    const kidIds = new Set(kids.map((child) => child.id));
    return {
      tool: "homework",
      data: {
        from,
        to,
        items: entries.slice(0, 25).map((entry) => ({
          due_on: entry.due_on,
          subject: entry.subject,
          class: entry.class?.name ?? null,
          title: entry.title,
          instruction: plainExcerpt(entry.body_md, 280),
          pages: entry.media.length,
          done_for: ctx.children
            .filter((child) => kidIds.has(child.id))
            .filter((child) => entry.completions.some((c) => c.student_id === child.id))
            .map((child) => child.firstName),
          link: `/devoirs/${entry.id}`,
        })),
      },
      links: [
        ...entries
          .slice(0, 25)
          .map((entry) => ({ label: entry.title, href: `/devoirs/${entry.id}` })),
        { label: "Devoirs", href: `/devoirs?jour=${from}` },
      ],
    };
  },

  async agenda(args, ctx) {
    const { from, to } = range(args, ctx, 0, 30);
    const events = await getAgendaEvents(
      ctx.user.id,
      zonedToUtc(`${from}T00:00`, SCHOOL_TIME_ZONE).toISOString(),
      zonedToUtc(`${addDays(to, 1)}T00:00`, SCHOOL_TIME_ZONE).toISOString(),
    );
    return {
      tool: "agenda",
      data: {
        from,
        to,
        items: events.slice(0, 20).map((event) => ({
          title: event.title,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          all_day: event.all_day,
          location: event.location,
          kind: event.kind,
          requires_rsvp: event.requires_rsvp,
          link: `/agenda/${event.id}`,
        })),
      },
      links: [
        ...events
          .slice(0, 20)
          .map((event) => ({ label: event.title, href: `/agenda/${event.id}` })),
        { label: "Agenda", href: "/agenda" },
      ],
    };
  },

  async menus(args, ctx) {
    const monday = mondayOf(args.week ?? ctx.today);
    if (!ctx.schoolId) return { tool: "menus", data: { week: monday, days: [] }, links: [] };
    const menu = (await getWeeklyMenus(ctx.schoolId, [monday])).get(monday);
    const names = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];
    return {
      tool: "menus",
      data: {
        week: monday,
        published: Boolean(menu?.published_at),
        days: (menu?.days ?? []).map((day) => ({
          day: names[day.day] ?? String(day.day),
          starter: day.starter,
          main_course: day.main_course,
          side: day.side,
          dessert: day.dessert,
          snack: day.snack,
          note: day.note,
        })),
      },
      links: [{ label: "Menus de la semaine", href: `/ecole/menus?semaine=${monday}` }],
    };
  },

  async announcements(_args, ctx) {
    const rows = (await getAnnouncementsForUser(ctx.user.id)).slice(0, 10);
    return {
      tool: "announcements",
      data: {
        items: rows.map((row) => ({
          title: row.title,
          published_at: row.published_at,
          requires_ack: row.requires_ack,
          acknowledged: row.isAcked,
          read: row.isRead,
          summary: plainExcerpt(row.body_md, 220),
          link: `/annonces/${row.id}`,
        })),
      },
      links: [
        ...rows.map((row) => ({ label: row.title, href: `/annonces/${row.id}` })),
        { label: "Annonces", href: "/annonces" },
      ],
    };
  },

  async absences(args, ctx) {
    const { from, to } = range(args, ctx, -30, 7);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("absences")
      .select("id, kind, status, starts_on, ends_on, student:students ( id, first_name )")
      .gte("ends_on", from)
      .lte("starts_on", to)
      .order("starts_on", { ascending: false })
      .limit(40);
    if (error) throw error;
    const wanted = args.child?.toLowerCase();
    const rows = (data ?? []).filter(
      (row) => !wanted || row.student?.first_name.toLowerCase() === wanted,
    );
    const pages = [
      ...ctx.children.flatMap((child) =>
        child.classId
          ? [
              {
                label: `Absences de ${child.firstName}`,
                href: `/classes/${child.classId}/absences`,
              },
            ]
          : [],
      ),
      ...ctx.teaching.map((cls) => ({
        label: `Absences ${cls.name}`,
        href: `/classes/${cls.id}/absences`,
      })),
    ];
    return {
      tool: "absences",
      // The reason is left out: it can say a child was ill, and nothing an answer needs.
      data: {
        from,
        to,
        items: rows.map((row) => ({
          student: row.student?.first_name ?? null,
          kind: row.kind,
          status: row.status,
          from: row.starts_on,
          to: row.ends_on,
        })),
      },
      links: pages,
    };
  },

  async help(args, ctx) {
    const articles = await articlesFor(helpRolesFor(ctx.user.roles));
    const matches = searchHelp(buildIndex(articles.map(toSearchEntry)), args.query ?? "", 3);
    const bySlug = new Map(articles.map((article) => [article.slug, article]));
    return {
      tool: "help",
      data: {
        items: matches.map((match) => ({
          title: match.entry.title,
          text: toSearchEntry(bySlug.get(match.entry.slug)!).text.slice(0, 1600),
          link: `/aide/${match.entry.slug}`,
        })),
      },
      links: matches.map((match) => ({
        label: match.entry.title,
        href: `/aide/${match.entry.slug}`,
      })),
    };
  },

  async search(args) {
    const rows = (await globalSearch(args.query ?? "", 15))
      // Private conversations stay out of the assistant (ADR-0088).
      .filter((row) => row.kind !== "message")
      .slice(0, 8);
    return {
      tool: "search",
      data: {
        items: rows.map((row) => ({
          kind: row.kind,
          title: row.title,
          snippet: row.snippet,
          link: hrefForResult(row),
        })),
      },
      links: rows.map((row) => ({ label: row.title, href: hrefForResult(row) })),
    };
  },
};

/** Runs a plan; a tool that fails says so instead of sinking the answer. */
export async function runPlan(plan: Plan, ctx: ReaderContext): Promise<ToolResult[]> {
  return Promise.all(
    plan.calls.map(async (call) => {
      try {
        return await RUNNERS[call.tool](call.args, ctx);
      } catch (error) {
        console.warn(`[assistant] tool ${call.tool}:`, (error as Error).message);
        return { tool: call.tool, data: { error: "indisponible" }, links: [] };
      }
    }),
  );
}

/** Where the reader may be sent, by what they are — the screens their roles open. */
export function destinations(ctx: ReaderContext): AssistantLink[] {
  const list: AssistantLink[] = [
    { label: "Accueil", href: "/accueil" },
    { label: "Devoirs", href: "/devoirs" },
    { label: "Agenda", href: "/agenda" },
    { label: "Menus de la semaine", href: "/ecole/menus" },
    { label: "Annonces", href: "/annonces" },
    { label: "Documents", href: "/documents" },
    { label: "École", href: "/ecole" },
    { label: "Communauté", href: "/communaute" },
    { label: "Notifications", href: "/notifications" },
    { label: "Mon profil", href: "/profil" },
    { label: "Aide", href: "/aide" },
  ];
  if (ctx.canMessage) {
    list.push({ label: "Messages", href: "/messages" });
    list.push({ label: "Nouveau message", href: "/messages/nouveau" });
  }
  if (ctx.isFamily) list.push({ label: "Mes enfants", href: "/famille" });
  for (const child of ctx.children) {
    if (!child.classId) continue;
    list.push({ label: `Classe de ${child.firstName}`, href: `/classes/${child.classId}/cahier` });
    list.push({
      label: `Absences de ${child.firstName}`,
      href: `/classes/${child.classId}/absences`,
    });
  }
  if (ctx.isTeam) {
    list.push({ label: "Publier", href: "/publier" });
    list.push({ label: "Nouveau devoir", href: "/devoirs/nouveau" });
    list.push({ label: "Pointage", href: "/pointage" });
    for (const cls of ctx.teaching) {
      list.push({ label: `Classe ${cls.name}`, href: `/classes/${cls.id}/cahier` });
    }
  }
  if (ctx.isStaff) list.push({ label: "Administration", href: "/admin" });
  return list;
}
