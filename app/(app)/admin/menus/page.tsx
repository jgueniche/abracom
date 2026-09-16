import { ChevronLeftIcon, ChevronRightIcon, CopyIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { addDays, isDateKey, localDateKey, mondayOf } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { type DayValues, MENU_DAYS, menuWeekOf } from "@/lib/menus";
import { deleteWeeklyMenu } from "@/server/actions/admin/menus";
import { getWeeklyMenus, type WeeklyMenu } from "@/server/queries/menus";

import { MenuForm } from "./menu-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menus");
  return { title: t("title") };
}

/** A calendar day at noon UTC, so that formatting it in Paris never shifts it. */
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/** The typed values of a saved week, day by day, as the form's defaults. */
function valuesOf(menu: WeeklyMenu): Record<number, DayValues> {
  return Object.fromEntries(
    menu.days.map((day) => [
      day.day,
      {
        starter: day.starter ?? "",
        mainCourse: day.main_course ?? "",
        side: day.side ?? "",
        dessert: day.dessert ?? "",
        snack: day.snack ?? "",
        note: day.note ?? "",
      },
    ]),
  );
}

/**
 * Where the office writes the menu: pick the week, fill in the days, save.
 *
 * « Dupliquer la semaine précédente » does not write anything by itself — it
 * opens the form pre-filled with last week's courses, and the secretariat
 * changes what changes before saving. The week and the one before it come back
 * in the same request, so offering the copy costs nothing. The secretariat
 * reaches this screen as well as the direction (`requireSchoolStaff`).
 */
export default async function AdminMenusPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; source?: string }>;
}) {
  const [{ semaine, source }, { schoolId }] = await Promise.all([
    searchParams,
    requireSchoolStaff(),
  ]);
  const today = localDateKey(new Date(), TIME_ZONE);
  const defaultMonday = menuWeekOf(today);
  const monday = isDateKey(semaine) ? mondayOf(semaine) : defaultMonday;
  const previous = addDays(monday, -7);
  const isCurrentWeek = monday === defaultMonday;
  const [t, format, menus] = await Promise.all([
    getTranslations("menus"),
    getFormatter(),
    getWeeklyMenus(schoolId, [monday, previous]),
  ]);
  const menu = menus.get(monday) ?? null;
  const previousMenu = menus.get(previous) ?? null;
  const copying = source === "precedente" && previousMenu !== null;
  const initial = copying ? valuesOf(previousMenu) : menu ? valuesOf(menu) : null;
  const edited =
    menu !== null &&
    new Date(menu.updated_at).getTime() - new Date(menu.published_at).getTime() > 60_000;

  const href = (key: string, copy = false) => {
    const params = new URLSearchParams({ semaine: key });
    if (copy) params.set("source", "precedente");
    return `/admin/menus?${params.toString()}`;
  };
  const days = MENU_DAYS.map((day) => ({
    day,
    label: format.dateTime(noon(addDays(monday, day - 1)), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  }));

  return (
    <Column width="text">
      <PageHeader
        eyebrow={t("week", {
          from: format.dateTime(noon(monday), { day: "numeric", month: "long" }),
          to: format.dateTime(noon(addDays(monday, 4)), { day: "numeric", month: "long" }),
        })}
        title={t("title")}
        description={t("admin.subtitle")}
        actions={
          <>
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={href(previous)} aria-label={t("previousWeek")}>
                <ChevronLeftIcon aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant={isCurrentWeek ? "secondary" : "default"}
              className="min-h-11"
              aria-current={isCurrentWeek ? "true" : undefined}
            >
              <Link href="/admin/menus">{t("thisWeek")}</Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={href(addDays(monday, 7))} aria-label={t("nextWeek")}>
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {/* The state of the week, and the ways out of it: see it as the
          families do, copy last week, or remove it. One line, not a card. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule pb-4">
        <p className="text-sm text-muted-foreground">
          {menu
            ? t("admin.published", {
                date: format.dateTime(new Date(menu.published_at), { dateStyle: "medium" }),
              }) +
              (edited
                ? ` · ${t("admin.updated", {
                    date: format.dateTime(new Date(menu.updated_at), { dateStyle: "medium" }),
                  })}`
                : "")
            : t("admin.none")}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {menu && (
            <Button asChild variant="ghost" size="sm" className="min-h-11">
              <Link href={`/ecole/menus?semaine=${monday}`}>{t("admin.view")}</Link>
            </Button>
          )}
          {previousMenu && !copying && (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={href(monday, true)}>
                <CopyIcon aria-hidden />
                {t("admin.duplicate")}
              </Link>
            </Button>
          )}
          {menu && (
            <form action={deleteWeeklyMenu}>
              <input type="hidden" name="menuId" value={menu.id} />
              <Button type="submit" variant="ghost" size="sm" className="min-h-11 text-destructive">
                {t("admin.delete")}
              </Button>
            </form>
          )}
        </div>
      </div>

      {copying && (
        <p
          role="status"
          className="mb-6 border-l-2 border-primary pl-3 text-sm text-muted-foreground"
        >
          {t("admin.duplicating", {
            date: format.dateTime(noon(previous), { day: "numeric", month: "long" }),
          })}
        </p>
      )}

      {/* The key resets the uncontrolled fields when the week — or the copy —
          changes; without it a navigation between two weeks keeps the old text. */}
      <MenuForm
        key={`${monday}-${copying ? "copy" : "own"}`}
        weekStart={monday}
        days={days}
        initial={initial}
      />
    </Column>
  );
}
