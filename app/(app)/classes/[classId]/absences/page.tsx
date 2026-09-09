import { PaperclipIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { canWriteInSchool } from "@/lib/permissions";
import { reviewAbsence } from "@/server/actions/absences";
import { getAbsences, getClassAbsences } from "@/server/queries/class-space";

import { AbsenceForm } from "./absence-form";

export default async function AbsencesPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ user, cls, isTeacher, isStaff, myStudentIds }, t, format] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.absences"),
    getFormatter(),
  ]);
  const staffView = isTeacher || isStaff;
  const absences = staffView ? await getClassAbsences(classId) : await getAbsences(myStudentIds);
  const myStudents = cls.students.filter((s) => myStudentIds.includes(s.id));
  const canDeclare = !staffView && canWriteInSchool(user.roles, cls.school_id);
  const variant = {
    declared: "outline",
    justified: "secondary",
    unjustified: "destructive",
  } as const;

  return (
    <div className="flex flex-col gap-6">
      {!staffView && (
        <Card>
          <CardHeader>
            <CardTitle>{t("declare")}</CardTitle>
          </CardHeader>
          <CardContent>
            {canDeclare ? (
              <AbsenceForm
                students={myStudents.map((s) => ({
                  id: s.id,
                  name: `${s.first_name} ${s.last_name}`,
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
            )}
          </CardContent>
        </Card>
      )}
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {absences.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {absences.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-medium">
                  {a.student ? `${a.student.first_name} ${a.student.last_name} · ` : ""}
                  {t(`kinds.${a.kind}`)}
                  <Badge variant={variant[a.status]} className="ml-2">
                    {t(`status.${a.status}`)}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("period", {
                    from: format.dateTime(new Date(a.starts_on), { dateStyle: "medium" }),
                    to: format.dateTime(new Date(a.ends_on), { dateStyle: "medium" }),
                  })}
                  {a.reason ? ` · ${a.reason}` : ""}
                  {a.justification_path ? (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <PaperclipIcon className="size-3" aria-hidden />
                      {t("withFile")}
                    </span>
                  ) : null}
                </p>
              </div>
              {isStaff && a.status === "declared" && (
                <div className="flex gap-2">
                  <form action={reviewAbsence}>
                    <input type="hidden" name="absenceId" value={a.id} />
                    <input type="hidden" name="status" value="justified" />
                    <Button type="submit" variant="outline" size="sm" className="min-h-11">
                      {t("justify")}
                    </Button>
                  </form>
                  <form action={reviewAbsence}>
                    <input type="hidden" name="absenceId" value={a.id} />
                    <input type="hidden" name="status" value="unjustified" />
                    <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                      {t("unjustify")}
                    </Button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
