import { SchoolIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
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
        // a bare "11" — the only string in the application built outside next-intl
        subtitle: t("students", { count: c.enrollments[0]?.count ?? 0 }),
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

  // A parent of one child — or a teacher of one class — had to cross a relay
  // screen carrying a single row before reaching anything.
  if (user.perspective !== "admin" && entries.size === 1) {
    redirect(`/classes/${[...entries.keys()][0]}`);
  }

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {entries.size === 0 ? (
        <EmptyState
          icon={SchoolIcon}
          title={t("empty")}
          description={staff ? t("emptyHintStaff") : t("emptyHint")}
          action={staff ? { href: "/admin/classes", label: t("manageClasses") } : undefined}
        />
      ) : (
        <RowList>
          {[...entries.entries()].map(([id, entry]) => (
            <Row
              key={id}
              href={`/classes/${id}`}
              kind={entry.level ?? undefined}
              title={entry.name}
              detail={entry.subtitle}
            />
          ))}
        </RowList>
      )}
    </Column>
  );
}
