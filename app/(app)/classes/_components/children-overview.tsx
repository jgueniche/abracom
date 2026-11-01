import { ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/domain/user-avatar";
import { Link } from "@/components/ui/link";
import { pivotLabel, SCHOOL_TIME_ZONE } from "@/lib/homework";
import type { ChildWithClass } from "@/server/queries/family";
import { getChildrenDay } from "@/server/queries/parent-home";

const DESTINATIONS = ["cahier", "devoirs", "mots", "emploi-du-temps"] as const;

/**
 * « Mes enfants » (ADR-0081): one card per child, on the application's tint — the child, the
 * class and its teacher, what is due for the day being prepared, and the doors of the class
 * space. It replaces three screens that led to the same places: the « Classe(s) » list (two
 * lines of grey text on a white page), the « Mon enfant » tab, and the home's « Mes enfants »
 * block. The child's full record (birth date, image rights, the whole team) stays one tap away.
 */
export async function ChildrenOverview({ items }: { items: ChildWithClass[] }) {
  const [t, tTabs, format, day] = await Promise.all([
    getTranslations("classSpace.children"),
    getTranslations("classSpace.tabs"),
    getFormatter(),
    getChildrenDay(items),
  ]);
  const pivotKind = pivotLabel(day.pivot, new Date(), SCHOOL_TIME_ZONE);
  const pivotName =
    pivotKind === "weekday"
      ? t("forWeekday", {
          day: format.dateTime(new Date(`${day.pivot}T12:00:00`), { weekday: "long" }),
        })
      : t(pivotKind === "today" ? "forToday" : "forTomorrow");

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {items.map((child) => {
        const student = child.student;
        const klass = student.enrollments[0]?.class ?? null;
        const main = klass?.class_teachers.find((teacher) => teacher.role === "main")?.profile;
        const summary = day.days.find((row) => row.studentId === student.id);
        return (
          <li key={student.id} className="flex flex-col gap-3 rounded-xl bg-muted p-4">
            <div className="flex items-start gap-3">
              <UserAvatar
                name={student.first_name}
                initials={`${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase()}
                className="size-10 text-sm"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">{student.first_name}</h2>
                <p className="meta">
                  {klass ? klass.name : t("noClass")}
                  {main ? ` · ${main.first_name} ${main.last_name}` : ""}
                </p>
              </div>
              <Link
                href={`/famille#enfant-${student.id}`}
                prefetch={false}
                className="inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-[0.8125rem] font-medium text-primary hover:bg-background/60"
              >
                {t("record")}
                <ChevronRightIcon aria-hidden className="size-4" />
              </Link>
            </div>
            {klass && (
              <>
                <Link
                  href={`/devoirs?enfant=${student.id}`}
                  prefetch={false}
                  className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-background/60"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{pivotName}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {summary && summary.total > 0
                        ? t("homework", { count: summary.total, done: summary.done })
                        : t("nothing")}
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
                <nav aria-label={t("doors", { name: student.first_name })}>
                  <ul className="flex flex-wrap gap-x-1.5 gap-y-2.5">
                    {DESTINATIONS.map((segment) => (
                      <li key={segment}>
                        <Link
                          href={`/classes/${klass.id}/${segment}`}
                          prefetch={false}
                          className="relative inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[0.8125rem] font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:border-primary/40 hover:text-primary"
                        >
                          {tTabs(
                            segment === "cahier"
                              ? "journal"
                              : segment === "devoirs"
                                ? "homework"
                                : segment === "mots"
                                  ? "notes"
                                  : "timetable",
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
