import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChildWithClass } from "@/server/queries/family";

export async function StudentCard({
  child,
  compact = false,
}: {
  child: ChildWithClass;
  compact?: boolean;
}) {
  const t = await getTranslations("family");
  const format = await getFormatter();
  const { student } = child;
  const enrollment = student.enrollments[0];
  const cls = enrollment?.class ?? null;
  const teachers = cls?.class_teachers ?? [];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
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
              {cls ? `${cls.name}${cls.level ? ` · ${cls.level.label_fr}` : ""}` : t("noClass")}
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
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t(`relation.${child.relation}`)}</Badge>
            {student.image_rights_signed_at ? (
              <Badge variant="secondary">
                <ShieldCheckIcon aria-hidden />
                {t("imageRights.signed")}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <ShieldAlertIcon aria-hidden />
                {t("imageRights.unsigned")}
              </Badge>
            )}
          </div>
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
    </Card>
  );
}
