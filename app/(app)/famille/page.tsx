import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StudentCard } from "@/components/domain/student-card";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("family");
  return { title: t("title") };
}

export default async function FamilyPage() {
  const user = await requireCurrentUser();
  const [t, tSpace, children] = await Promise.all([
    getTranslations("family"),
    getTranslations("classSpace.tabs"),
    getMyChildren(),
  ]);
  const readOnly =
    user.roles.some((r) => r.role === "guardian") && !user.roles.some((r) => r.role === "parent");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {readOnly && <p className="mb-4 text-sm text-muted-foreground">{t("readOnly")}</p>}
      {children.length === 0 ? (
        <p className="text-muted-foreground">{t("noChildren")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const classId = child.student.enrollments[0]?.class?.id;
            return (
              <div key={child.student.id} className="flex flex-col gap-2">
                <StudentCard child={child} />
                {classId && (
                  <div className="flex flex-wrap gap-2">
                    {(["", "devoirs", "cahier", "mots", "evaluations", "absences"] as const).map(
                      (segment, index) => (
                        <Button
                          key={segment}
                          asChild
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                        >
                          <Link
                            href={
                              segment ? `/classes/${classId}/${segment}` : `/classes/${classId}`
                            }
                          >
                            {tSpace(
                              (
                                [
                                  "feed",
                                  "homework",
                                  "journal",
                                  "notes",
                                  "assessments",
                                  "absences",
                                ] as const
                              )[index]!,
                            )}
                          </Link>
                        </Button>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
