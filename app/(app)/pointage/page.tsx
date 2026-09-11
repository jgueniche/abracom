import { ClipboardCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolAdmin } from "@/lib/permissions";
import { openAttendanceSession } from "@/server/actions/attendance";
import { getMyAttendanceLists } from "@/server/queries/attendance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("attendance");
  return { title: t("title") };
}

/** The lists this person may point today, scheduled ones first. */
export default async function AttendancePage() {
  const user = await requireCurrentUser();
  const [t, format, lists] = await Promise.all([
    getTranslations("attendance"),
    getFormatter(),
    getMyAttendanceLists(),
  ]);
  // This page used to redirect home when the reader held no list — the exact
  // silent bounce session 18 spent a day removing everywhere else. Before the
  // first list exists nobody could reach the feature at all, and the one screen
  // that creates a list was the hardest to find. It says what is missing now.
  const canCreate = user.school ? isSchoolAdmin(user.roles, user.school.id) : false;
  if (lists.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} description={t("noListSubtitle")} />
        <EmptyState
          icon={ClipboardCheckIcon}
          title={canCreate ? t("noListAdmin") : t("noListGranted")}
          description={canCreate ? t("noListAdminHint") : t("noListGrantedHint")}
          action={canCreate ? { href: "/admin/pointage", label: t("createFirstList") } : undefined}
        />
      </>
    );
  }

  const today = lists.filter((list) => list.scheduled_today || list.session_id);
  const others = lists.filter((list) => !list.scheduled_today && !list.session_id);

  const card = (list: (typeof lists)[number]) => (
    <Card key={list.list_id}>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{list.name}</h2>
            <Badge variant="outline">{t(`kinds.${list.kind}`)}</Badge>
            {list.session_id && list.closed_at && (
              <Badge variant="secondary">{t("closedBadge")}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {list.class_name ? `${list.class_name} · ` : ""}
            {list.session_id
              ? t("counterShort", {
                  present: Number(list.present),
                  expected: Number(list.expected),
                })
              : t("expectedCount", { count: Number(list.expected) })}
          </p>
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
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={format.dateTime(new Date(), { dateStyle: "full" })}
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {today.length === 0 ? (
            <EmptyState
              icon={ClipboardCheckIcon}
              title={t("nothingToday")}
              description={t("nothingTodayHint")}
            />
          ) : (
            today.map(card)
          )}
        </div>
        {others.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="eyebrow">{t("otherLists")}</h2>
            {others.map(card)}
          </section>
        )}
      </div>
    </>
  );
}
