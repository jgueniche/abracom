import { ClipboardCheckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import { openAttendanceSession } from "@/server/actions/attendance";
import { getMyAttendanceLists } from "@/server/queries/attendance";

/**
 * The pointeuse on the home screen, because a phone bar of five tabs has no
 * sixth slot and the person about to point is standing in the entrance hall,
 * not browsing a menu. Renders nothing when nothing is scheduled today.
 */
export async function AttendanceToday() {
  const lists = await getMyAttendanceLists().catch(() => []);
  // Someone who holds no list at all has nothing to see here.
  if (lists.length === 0) return null;
  const t = await getTranslations("attendance");
  const today = lists.filter((list) => list.scheduled_today || list.session_id);

  // Holding lists but none scheduled today used to render nothing, which left a
  // phone with no route to the pointeuse at all: five tabs are full and the
  // desktop bar is the only place that names it. One quiet line fixes that.
  if (today.length === 0) {
    return (
      <p className="mb-6">
        <Link
          href="/pointage"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ClipboardCheckIcon className="size-4" aria-hidden />
          {t("nothingTodaySeeLists", { count: lists.length })}
        </Link>
      </p>
    );
  }

  return (
    // A medallion in front of each line said "attendance" a third time, after
    // the section label and the name of the list. The line is the object.
    <section className="mb-10">
      <SectionHeader label={t("todayTitle")} count={today.length} />
      {today.map((list) => (
        <div key={list.list_id} className="border-b border-rule last:border-b-0">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{list.name}</p>
                <p className="meta">
                  {list.session_id
                    ? t("counterShort", {
                        present: Number(list.present),
                        expected: Number(list.expected),
                      })
                    : t("expectedCount", { count: Number(list.expected) })}
                </p>
              </div>
            </div>
            {list.session_id ? (
              <Button asChild className="shrink-0 sm:min-w-36">
                <Link href={`/pointage/${list.session_id}`}>{t("continue")}</Link>
              </Button>
            ) : (
              <form action={openAttendanceSession}>
                <input type="hidden" name="listId" value={list.list_id} />
                <Button type="submit" className="shrink-0 sm:min-w-36">
                  {t("start")}
                </Button>
              </form>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
