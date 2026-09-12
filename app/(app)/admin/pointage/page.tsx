import { ClipboardListIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { archiveAttendanceList, setAttendanceListManager } from "@/server/actions/admin/attendance";
import { getAttendanceLists } from "@/server/queries/attendance";
import { getAdminClasses, getMembers } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.attendance");
  return { title: t("title") };
}

import { AttendanceListForm } from "./list-form";

/**
 * The direction's side of the pointeuse: the lists, and who may point on each.
 * The right is granted list by list so that an evening supervisor does not
 * inherit the secretariat's reach (ADR-0039).
 */
export default async function AdminAttendancePage() {
  const { schoolId } = await requireSchoolAdmin();
  const [t, lists, classes, members] = await Promise.all([
    getTranslations("admin.attendance"),
    getAttendanceLists(schoolId),
    getAdminClasses(schoolId),
    getMembers(schoolId),
  ]);

  // Only people who could hold the right: parents never point. `getMembers`
  // already splits the team from the families, so the team is the whole list.
  const uniqueCandidates = [
    ...new Map(
      members.team
        .filter((m) => m.profile && m.status === "active")
        .map((m) => [
          m.user_id,
          { id: m.user_id, name: `${m.profile!.first_name} ${m.profile!.last_name}`.trim() },
        ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Column>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("listsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lists.length === 0 ? (
              <EmptyState
                icon={ClipboardListIcon}
                title={t("noList")}
                description={t("noListHint")}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {lists.map((list) => {
                  const managers = list.managers ?? [];
                  const managerIds = new Set(managers.map((m) => m.user_id));
                  return (
                    <li
                      key={list.id}
                      className="flex flex-col gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{list.name}</span>
                        <Badge variant="outline">{t(`kinds.${list.kind}`)}</Badge>
                        {list.class && <Badge variant="secondary">{list.class.name}</Badge>}
                        {list.visible_to_guardians && (
                          <Badge variant="secondary">{t("visibleToFamilies")}</Badge>
                        )}
                        <form action={archiveAttendanceList} className="ms-auto">
                          <input type="hidden" name="listId" value={list.id} />
                          <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                            {t("archive")}
                          </Button>
                        </form>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">{t("managers")}</p>
                        <div className="flex flex-wrap gap-2">
                          {uniqueCandidates.map((person) => {
                            const granted = managerIds.has(person.id);
                            return (
                              <form key={person.id} action={setAttendanceListManager}>
                                <input type="hidden" name="listId" value={list.id} />
                                <input type="hidden" name="userId" value={person.id} />
                                <input type="hidden" name="remove" value={String(granted)} />
                                <Button
                                  type="submit"
                                  variant={granted ? "default" : "outline"}
                                  size="sm"
                                  className="min-h-11"
                                  aria-pressed={granted}
                                >
                                  {person.name}
                                </Button>
                              </form>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">
              {t.rich("outingHint", {
                link: (chunks) => (
                  <Link href="/agenda" className="underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("newListTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceListForm classes={classes.map((c) => ({ id: c.id, name: c.name }))} />
          </CardContent>
        </Card>
      </div>
    </Column>
  );
}
