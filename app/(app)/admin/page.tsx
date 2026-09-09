import {
  CalendarDaysIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  HistoryIcon,
  MegaphoneIcon,
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

const GROUPS = [
  {
    key: "publications",
    items: [
      { href: "/admin/annonces", key: "announcements", icon: MegaphoneIcon },
      { href: "/admin/documents", key: "documents", icon: FolderIcon },
      { href: "/admin/evenements", key: "events", icon: CalendarDaysIcon },
      { href: "/admin/formulaires", key: "forms", icon: ClipboardListIcon },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/familles", key: "families", icon: UsersRoundIcon },
      { href: "/admin/classes", key: "classes", icon: GraduationCapIcon },
      { href: "/admin/utilisateurs", key: "members", icon: UsersIcon },
      { href: "/admin/import", key: "import", icon: UploadIcon },
    ],
  },
  {
    key: "moderation",
    items: [
      { href: "/admin/signalements", key: "reports", icon: ShieldAlertIcon },
      { href: "/admin/communaute", key: "community", icon: MegaphoneIcon },
    ],
  },
  {
    key: "year",
    items: [
      { href: "/admin/annees", key: "years", icon: FileTextIcon },
      { href: "/admin/journal", key: "audit", icon: HistoryIcon },
    ],
  },
] as const;

/**
 * Landing page of the management section. `/admin` used to redirect straight
 * to Families, so the section had no home and no map of what it contains.
 */
export default async function AdminIndexPage() {
  const [t, tNav, tGroups] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.nav"),
    getTranslations("admin.groups"),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("dashboard.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {GROUPS.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle>{tGroups(group.key)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {tNav(item.key)}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
