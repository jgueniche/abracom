import { ClipboardCheckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <section className="mb-6 flex flex-col gap-3">
      <h2 className="eyebrow">{t("todayTitle")}</h2>
      {today.map((list) => (
        <Card key={list.list_id}>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <ClipboardCheckIcon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{list.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
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
              <Button asChild className="min-h-12 sm:min-w-40">
                <Link href={`/pointage/${list.session_id}`}>{t("continue")}</Link>
              </Button>
            ) : (
              <form action={openAttendanceSession}>
                <input type="hidden" name="listId" value={list.list_id} />
                <Button type="submit" className="min-h-12 sm:min-w-40">
                  {t("start")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
