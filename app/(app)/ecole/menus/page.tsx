import { ChevronLeftIcon, ChevronRightIcon, UtensilsIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Fragment } from "react";

import { EmptyState } from "@/components/domain/empty-state";
import { RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { requireCurrentUser } from "@/lib/auth/session";
import { addDays, isDateKey, localDateKey, mondayOf } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { COLUMN_OF, COURSES, menuWeekOf } from "@/lib/menus";
import { isSchoolStaff } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getWeeklyMenus, type WeeklyMenu } from "@/server/queries/menus";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menus");
  return { title: t("title") };
}

/** A calendar day at noon UTC, so that formatting it in Paris never shifts it. */
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/**
 * The canteen menu of a week, for everyone in the school.
 *
 * Read as a list of days, not as a grid of five cards: on a phone the question
 * is "what is there today", and the answer is the row with the bar in its
 * margin. A day with no canteen is simply absent — the office leaves it blank
 * and the database drops it — so a four-day week shows four days, not five
 * with a hole. Monday to Friday only; the school does not serve lunch on the
 * weekend, and the model says so (`weekly_menu_days.day` between 1 and 5).
 *
 * One request: the week and its days come back embedded (ADR-0067).
 */
export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const [{ semaine }, user] = await Promise.all([searchParams, requireCurrentUser()]);
  const today = localDateKey(new Date(), TIME_ZONE);
  const thisMonday = menuWeekOf(today);
  const monday = isDateKey(semaine) ? mondayOf(semaine) : thisMonday;
  const friday = addDays(monday, 4);
  const schoolId = user.school?.id ?? null;
  const [t, format, menus] = await Promise.all([
    getTranslations("menus"),
    getFormatter(),
    schoolId ? getWeeklyMenus(schoolId, [monday]) : Promise.resolve(new Map<string, WeeklyMenu>()),
  ]);
  const menu = menus.get(monday) ?? null;
  const staff = schoolId ? isSchoolStaff(user.roles, schoolId) : false;
  const isCurrentWeek = monday === thisMonday;
  const weekHref = (key: string) =>
    key === thisMonday ? "/ecole/menus" : `/ecole/menus?semaine=${key}`;
  const adminHref = `/admin/menus?semaine=${monday}`;
  const edited =
    new Date(menu?.updated_at ?? 0).getTime() - new Date(menu?.published_at ?? 0).getTime() >
    60_000;

  return (
    <Column width="text">
      <PageHeader
        eyebrow={t("week", {
          from: format.dateTime(noon(monday), { day: "numeric", month: "long" }),
          to: format.dateTime(noon(friday), { day: "numeric", month: "long" }),
        })}
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {staff && (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={adminHref}>{t("edit")}</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={weekHref(addDays(monday, -7))} aria-label={t("previousWeek")}>
                <ChevronLeftIcon aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant={isCurrentWeek ? "secondary" : "default"}
              className="min-h-11"
              aria-current={isCurrentWeek ? "true" : undefined}
            >
              <Link href="/ecole/menus">{t("thisWeek")}</Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={weekHref(addDays(monday, 7))} aria-label={t("nextWeek")}>
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {!menu ? (
        <EmptyState
          icon={UtensilsIcon}
          title={t("empty")}
          description={staff ? t("emptyHintStaff") : t("emptyHint")}
          action={staff ? { href: adminHref, label: t("enter") } : undefined}
        />
      ) : (
        <>
          <RowList>
            {menu.days.map((day) => {
              const key = addDays(monday, day.day - 1);
              const isToday = key === today;
              const courses = COURSES.filter((course) => day[COLUMN_OF[course]]);
              return (
                <li key={day.id} className="relative px-3.5 py-3">
                  {/* the day that is being asked about, marked in the margin
                      and in words — never by colour alone */}
                  {isToday && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
                  )}
                  <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={cn(
                        "font-heading text-base first-letter:uppercase",
                        isToday && "text-primary",
                      )}
                    >
                      {format.dateTime(noon(key), {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    {isToday && <span className="eyebrow text-primary">{t("today")}</span>}
                  </p>
                  {courses.length > 0 && (
                    /* One measure for the whole week, not one per day: an
                       `auto` column is computed inside its own day, so a
                       Thursday without a side dish set its courses at a
                       different left edge from Monday's — the misalignment of
                       `/famille` in session 27, in a smaller frame. */
                    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
                      {courses.map((course) => (
                        <Fragment key={course}>
                          <dt className="text-muted-foreground">{t(`courses.${course}`)}</dt>
                          <dd>{day[COLUMN_OF[course]]}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}
                  {day.note && <p className="mt-1.5 text-xs text-muted-foreground">{day.note}</p>}
                </li>
              );
            })}
          </RowList>
          <p className="meta mt-3">
            {t("publishedOn", {
              date: format.dateTime(new Date(menu.published_at), { dateStyle: "medium" }),
            })}
            {edited &&
              ` · ${t("updatedOn", {
                date: format.dateTime(new Date(menu.updated_at), { dateStyle: "medium" }),
              })}`}
          </p>
        </>
      )}
    </Column>
  );
}
