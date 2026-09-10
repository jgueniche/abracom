import {
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  HistoryIcon,
  MegaphoneIcon,
  RadioIcon,
  ShieldAlertIcon,
  UploadIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { getAdminCounts } from "@/server/queries/school";

import { adminGroupsFor } from "./_components/groups";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

const ICONS: Record<string, typeof MegaphoneIcon> = {
  announcements: MegaphoneIcon,
  documents: FolderIcon,
  events: CalendarDaysIcon,
  forms: ClipboardListIcon,
  families: UsersRoundIcon,
  classes: GraduationCapIcon,
  members: UsersIcon,
  import: UploadIcon,
  attendance: ClipboardCheckIcon,
  reports: ShieldAlertIcon,
  community: MegaphoneIcon,
  messaging: RadioIcon,
  years: FileTextIcon,
  audit: HistoryIcon,
};

/** Entries whose figure means "something is waiting", not "here is the stock". */
const WAITING = new Set(["reports", "community", "messaging"]);

/**
 * Landing page of the management section.
 *
 * It used to repeat the twelve links of the sidebar shown right beside it, under
 * the same four family names, with a subtitle borrowed from the dashboard —
 * "what is waiting for a decision today" — while nothing on it was a queue.
 * Each entry now carries its own live figure, so the page says something the
 * navigation cannot.
 */
export default async function AdminIndexPage() {
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tNav, tGroups, counts] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.nav"),
    getTranslations("admin.groups"),
    getAdminCounts(schoolId),
  ]);
  const groups = adminGroupsFor(isSchoolAdmin(user.roles, schoolId));

  return (
    <>
      <PageHeader title={t("title")} description={t("nav.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {groups.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle>{tGroups(group.key)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = ICONS[item.key] ?? FileTextIcon;
                const count = counts[item.key];
                const waiting = WAITING.has(item.key) && (count ?? 0) > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{tNav(item.key)}</span>
                    {count !== undefined && (
                      <span
                        className={
                          waiting
                            ? "text-sm font-semibold text-brick tabular-nums"
                            : "text-sm text-muted-foreground tabular-nums"
                        }
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
