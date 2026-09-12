import type { ReactNode } from "react";

import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { levelLabel } from "@/lib/levels";
import type { ChildWithClass } from "@/server/queries/family";

export async function StudentCard({
  child,
  compact = false,
  /**
   * What the card leads to — the tabs of the child's class. It is part of the
   * card, not a list floating under it: two children whose teams differ in
   * length gave two cards of different heights, and the two lists of links
   * below them then started at two different heights, as if the page had come
   * apart.
   */
  footer,
}: {
  child: ChildWithClass;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const t = await getTranslations("family");
  const locale = await getLocale();
  const format = await getFormatter();
  const { student } = child;
  const enrollment = student.enrollments[0];
  const cls = enrollment?.class ?? null;
  const teachers = cls?.class_teachers ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {student.first_name.charAt(0)}
              {student.last_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate">
              {student.first_name} {student.last_name}
            </CardTitle>
            <CardDescription>
              {cls
                ? `${cls.name}${cls.level ? ` · ${levelLabel(cls.level, locale)}` : ""}`
                : t("noClass")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {!compact && (
        <CardContent className="flex flex-col gap-3 text-sm">
          {student.birth_date && (
            <p className="text-muted-foreground">
              {t("born", {
                date: format.dateTime(new Date(student.birth_date), { dateStyle: "long" }),
              })}
            </p>
          )}
          {/* A relation is a label, not a status, and a right that is signed is
              a fact, not an alarm: two capsules with a shield in each of them
              carried more weight than the child's own name above. */}
          <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t(`relation.${child.relation}`)}</span>
            <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/45" />
            <span className={student.image_rights_signed_at ? undefined : "text-brick"}>
              {student.image_rights_signed_at ? t("imageRights.signed") : t("imageRights.unsigned")}
            </span>
          </p>
          {student.allergies_note && (
            <p>
              <span className="font-medium">{t("allergies")} :</span> {student.allergies_note}
            </p>
          )}
          {teachers.length > 0 && (
            <div>
              <p className="mb-1 font-medium">{t("teachers")}</p>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {teachers
                  .filter((ct) => ct.profile)
                  .map((ct) => (
                    <li key={ct.profile!.id}>
                      {ct.profile!.first_name} {ct.profile!.last_name} ·{" "}
                      {t(`teacherRole.${ct.role}`)}
                      {ct.subject ? ` (${ct.subject})` : ""}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
      {footer && <div className="border-t border-rule px-1.5 py-1">{footer}</div>}
    </Card>
  );
}
