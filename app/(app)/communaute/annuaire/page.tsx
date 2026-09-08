import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getMyTeachingClasses, getSchoolClasses } from "@/server/queries/classes";
import { getClassDirectory, getMyDirectorySettings } from "@/server/queries/community";
import { getMyChildren } from "@/server/queries/family";

import { DirectorySettingsForm } from "../_components/directory-settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.directory");
  return { title: t("title") };
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requireCurrentUser();
  const { c } = await searchParams;
  const schoolId = user.school?.id ?? "";
  const staff = schoolId !== "" && isSchoolStaff(user.roles, schoolId);
  const [t, settings, children, teaching, schoolClasses] = await Promise.all([
    getTranslations("community.directory"),
    schoolId ? getMyDirectorySettings(user.id, schoolId) : Promise.resolve(null),
    getMyChildren(),
    getMyTeachingClasses(user.id),
    staff ? getSchoolClasses(schoolId) : Promise.resolve([]),
  ]);
  const classes = new Map<string, string>();
  for (const child of children) {
    const cls = child.student.enrollments[0]?.class;
    if (cls) classes.set(cls.id, cls.name);
  }
  for (const row of teaching) if (row.class) classes.set(row.class.id, row.class.name);
  for (const cls of schoolClasses) classes.set(cls.id, cls.name);
  const selected = c && classes.has(c) ? c : ([...classes.keys()][0] ?? null);
  const entries = selected ? await getClassDirectory(selected) : [];
  const isParent = user.roles.some((r) => r.role === "parent" || r.role === "guardian");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {isParent && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{t("settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DirectorySettingsForm initial={settings} />
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-4">
          {classes.size === 0 ? (
            <p className="text-muted-foreground">{t("noClass")}</p>
          ) : (
            <>
              <nav className="flex flex-wrap gap-2" aria-label={t("class")}>
                {[...classes.entries()].map(([id, name]) => (
                  <Link
                    key={id}
                    href={`/communaute/annuaire?c=${id}`}
                    aria-current={id === selected ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
                      id === selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {name}
                  </Link>
                ))}
              </nav>
              {entries.length === 0 ? (
                <p className="text-muted-foreground">{t("empty")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.user_id}
                      className="flex flex-col gap-1 rounded-2xl border p-4 text-sm"
                    >
                      <p className="font-heading font-semibold">
                        {entry.first_name} {entry.last_name}
                        {entry.relation && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {t(`relation.${entry.relation}`)}
                          </span>
                        )}
                      </p>
                      {entry.children.length > 0 && (
                        <p className="text-muted-foreground">
                          {t("children", { names: entry.children.join(", ") })}
                        </p>
                      )}
                      {entry.phone && (
                        <a
                          href={`tel:${entry.phone}`}
                          className="flex min-h-9 items-center gap-2 text-primary underline"
                        >
                          <PhoneIcon className="size-4" aria-hidden />
                          {entry.phone}
                        </a>
                      )}
                      {entry.email && (
                        <a
                          href={`mailto:${entry.email}`}
                          className="flex min-h-9 items-center gap-2 text-primary underline"
                        >
                          <MailIcon className="size-4" aria-hidden />
                          {entry.email}
                        </a>
                      )}
                      {entry.address && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <MapPinIcon className="size-4" aria-hidden />
                          {entry.address}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
