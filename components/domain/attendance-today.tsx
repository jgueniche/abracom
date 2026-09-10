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
  const today = lists.filter((list) => list.scheduled_today || list.session_id);
  if (today.length === 0) return null;
  const t = await getTranslations("attendance");

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
