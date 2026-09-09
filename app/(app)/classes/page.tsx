import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getMyTeachingClasses, getSchoolClasses } from "@/server/queries/classes";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classSpace");
  return { title: t("title") };
}

export default async function ClassesPage() {
  const user = await requireCurrentUser();
  const t = await getTranslations("classSpace");
  const schoolId = user.school?.id;
  const staff = schoolId ? isSchoolStaff(user.roles, schoolId) : false;

  const entries = new Map<string, { name: string; level: string | null; subtitle: string }>();
  if (user.perspective === "admin" && schoolId && staff) {
    for (const c of await getSchoolClasses(schoolId)) {
      entries.set(c.id, {
        name: c.name,
        level: c.level?.code ?? null,
        subtitle: `${c.enrollments[0]?.count ?? 0}`,
      });
    }
  } else {
    const [teaching, children] = await Promise.all([
      getMyTeachingClasses(user.id),
      getMyChildren(),
    ]);
    for (const row of teaching) {
      entries.set(row.class!.id, {
        name: row.class!.name,
        level: row.class!.level?.code ?? null,
        subtitle: row.subject ?? "",
      });
    }
    for (const child of children) {
      const cls = child.student.enrollments[0]?.class;
      if (cls) {
        const existing = entries.get(cls.id);
        const name = `${child.student.first_name}`;
        entries.set(cls.id, {
          name: cls.name,
          level: cls.level?.code ?? null,
          subtitle: existing ? `${existing.subtitle}, ${name}`.replace(/^, /, "") : name,
        });
      }
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {entries.size === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {[...entries.entries()].map(([id, entry]) => (
            <li key={id}>
              <Link
                href={`/classes/${id}`}
                className="flex items-center gap-3 rounded-2xl border p-4 hover:bg-accent/60"
              >
                {entry.level && <Badge variant="secondary">{entry.level}</Badge>}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.name}</p>
                  {entry.subtitle && (
                    <p className="truncate text-sm text-muted-foreground">{entry.subtitle}</p>
                  )}
                </div>
                <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
