import { CheckCircle2Icon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Row, RowList } from "@/components/domain/row-list";
import { UserAvatar } from "@/components/domain/user-avatar";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Link } from "@/components/ui/link";
import type { CurrentUser } from "@/lib/auth/session";
import { localDateKey } from "@/lib/calendar/dates";
import { pivotLabel, SCHOOL_TIME_ZONE } from "@/lib/homework";
import { rolesIn } from "@/lib/permissions";
import { cn } from "@/lib/utils";

import { UpcomingEvents, upcomingEventsFor } from "@/app/(app)/agenda/_components/upcoming-events";
import { getMyChildren } from "@/server/queries/family";
import {
  type ChildDay,
  getChildrenDay,
  getParentActions,
  getParentNews,
  type HomeAction,
} from "@/server/queries/parent-home";

/**
 * The parent's home, in the order a parent asks its questions (ADR-0081):
 * what the school is waiting for from me, what my children have for the day being
 * prepared, what is new — and, beside it on a wide screen, the week ahead.
 *
 * It used to be one « Aujourd'hui » list of ten rows of the same weight, where a
 * signature owed and a poem for Monday looked alike and nothing said what to do.
 */
export async function ParentHome({ user }: { user: CurrentUser }) {
  const canSign = rolesIn(user.roles, user.school?.id).some(
    (role) => role.role === "parent" && role.status === "active",
  );
  const children = await getMyChildren();
  // One wave: every query of the page leaves together (ADR-0067).
  const [tHome, t, format, actions, day, news, events] = await Promise.all([
    getTranslations("appHome"),
    getTranslations("appHome.parent"),
    getFormatter(),
    getParentActions(user.id, canSign),
    getChildrenDay(children),
    getParentNews(user.id, children),
    upcomingEventsFor(user.id),
  ]);

  const now = new Date();
  const today = localDateKey(now, SCHOOL_TIME_ZONE);
  const dayName = (key: string) =>
    format.dateTime(new Date(`${key}T12:00:00`), {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  const pivotKind = pivotLabel(day.pivot, now, SCHOOL_TIME_ZONE);
  const pivotWeekday = format.dateTime(new Date(`${day.pivot}T12:00:00`), { weekday: "long" });

  return (
    <Column
      rail={
        <div className="flex flex-col gap-7">
          {news.length > 0 && (
            <section aria-labelledby="home-news">
              <SectionHeader id="home-news" label={t("news")} />
              <RowList>
                {news.map((item) => (
                  <Row
                    key={item.key}
                    href={item.href}
                    leading={<UserAvatar initials={item.initials} className="size-9 text-xs" />}
                    kind={
                      item.kind === "note"
                        ? t("newsNote", { name: item.title })
                        : t("newsJournal", { name: item.title })
                    }
                    title={item.detail ?? ""}
                  />
                ))}
              </RowList>
            </section>
          )}
          <UpcomingEvents events={events} />
        </div>
      }
    >
      <PageHeader
        eyebrow={format.dateTime(now, { weekday: "long", day: "numeric", month: "long" })}
        title={tHome("greeting", { name: user.profile.first_name })}
      />

      <section aria-labelledby="home-todo" className="mb-7">
        {actions.length === 0 ? (
          <>
            <SectionHeader id="home-todo" label={t("todo")} />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2Icon className="size-4 text-success" aria-hidden />
              {t("todoNothing")}
            </p>
          </>
        ) : (
          // The one block of the page that is drawn as a box: it is the one the reader acts on
          // (ADR-0080 — a box for what is handled, never around what is only read).
          <div className="rounded-xl bg-muted px-4 pt-3 pb-1">
            <SectionHeader id="home-todo" label={t("todo")} className="[&_h2]:text-brick" />
            <ul className="flex flex-col">
              {actions.map((action) => (
                <ActionRow key={action.key} action={action} today={today} t={t} dayName={dayName} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {day.days.length > 0 && (
        <section aria-labelledby="home-day" className="mb-7">
          <SectionHeader
            id="home-day"
            label={
              pivotKind === "weekday"
                ? t("forWeekday", { day: pivotWeekday })
                : t(pivotKind === "today" ? "forToday" : "forTomorrow")
            }
            action={<span className="meta">{dayName(day.pivot)}</span>}
          />
          <RowList>
            {day.days.map((child) => (
              <ChildDayRow key={child.studentId} child={child} t={t} dayName={dayName} />
            ))}
          </RowList>
        </section>
      )}
    </Column>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"appHome.parent">>>;

function ActionRow({
  action,
  today,
  t,
  dayName,
}: {
  action: HomeAction;
  today: string;
  t: Translate;
  dayName: (key: string) => string;
}) {
  const late = action.dueOn !== null && action.dueOn < today;
  const kind = t(action.kind === "signature" ? "kindSignature" : "kindAck");
  return (
    <li className="border-t border-border/70 first:border-t-0">
      <Link
        href={action.href}
        prefetch={false}
        className="group -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-background/60 focus-visible:bg-background/60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm leading-snug font-medium text-pretty">
            {action.title}
          </span>
          <span className={cn("meta", late && "font-medium text-brick")}>
            {kind}
            {action.dueOn && ` · ${t(late ? "overdue" : "dueOn", { day: dayName(action.dueOn) })}`}
          </span>
        </span>
        {/* The verb, drawn as a button: the row itself is the one target, so a finger
            anywhere on it does what the button says. */}
        <span
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors",
            action.kind === "signature"
              ? "bg-primary text-primary-foreground group-hover:bg-primary/90"
              : "border border-border bg-background text-primary group-hover:border-primary/40",
          )}
        >
          {t(action.kind === "signature" ? "verbSign" : "verbRead")}
        </span>
      </Link>
    </li>
  );
}

function ChildDayRow({
  child,
  t,
  dayName,
}: {
  child: ChildDay;
  t: Translate;
  dayName: (key: string) => string;
}) {
  const detail =
    child.total > 0
      ? child.titles.join(" · ")
      : child.next
        ? t("next", { title: child.next.title, day: dayName(child.next.dueOn) })
        : (child.className ?? undefined);
  return (
    <Row
      href={`/devoirs?enfant=${child.studentId}`}
      leading={
        <UserAvatar name={child.firstName} initials={child.initials} className="size-9 text-xs" />
      }
      title={
        child.total > 0
          ? t("childHomework", { name: child.firstName, count: child.total })
          : t("childNothing", { name: child.firstName })
      }
      detail={detail}
      trailing={
        child.total > 0 ? (
          <span
            className={cn(
              "meta tabular-nums",
              child.done === child.total && "font-medium text-success",
            )}
          >
            {t("done", { done: child.done, total: child.total })}
          </span>
        ) : undefined
      }
    />
  );
}
