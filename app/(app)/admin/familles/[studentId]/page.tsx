import { ArrowLeftIcon, CameraIcon, UserMinusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { enrollStudent, setImageRights, unlinkGuardian } from "@/server/actions/admin/students";
import { getAdminClasses, getStudentDetail } from "@/server/queries/admin";

import { StudentForm } from "../student-form";
import { GuardianFlagsForm } from "./guardian-flags-form";
import { LinkGuardianForm } from "./link-guardian-form";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tFamily, tMembers, format, student, classes] = await Promise.all([
    getTranslations("admin.students"),
    getTranslations("family"),
    getTranslations("admin.members"),
    getFormatter(),
    getStudentDetail(schoolId, studentId),
    getAdminClasses(schoolId),
  ]);
  if (!student) notFound();
  const admin = isSchoolAdmin(user.roles, schoolId);

  return (
    <Column>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/familles">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        description={`${student.currentEnrollment?.class?.name ?? t("noClass")}${student.family ? ` · ${student.family.name}` : ""}`}
      />
      {/* `items-start`: the two columns hold unrelated things of unrelated
          lengths — the pupil on the left, the guardians on the right — and a
          grid stretches its cells by default, so the left card was padded out
          with seven hundred pixels of white to match the right one. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* The left column is the pupil — the record and the image right that
            belongs to it; the right column is the guardians. Three cards in one
            two-column grid put the image right in a second row, which the tall
            guardians card pushed seven hundred pixels down the page. */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("save")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <StudentForm
                classes={[]}
                initial={{
                  id: student.id,
                  firstName: student.first_name,
                  lastName: student.last_name,
                  birthDate: student.birth_date,
                  allergiesNote: student.allergies_note,
                  status: student.status,
                }}
              />
              <form action={enrollStudent} className="flex flex-col gap-2 border-t pt-4">
                <input type="hidden" name="studentId" value={student.id} />
                <label htmlFor="classId" className="text-sm font-medium">
                  {t("enroll")}
                </label>
                <div className="flex gap-2">
                  <select
                    id="classId"
                    name="classId"
                    defaultValue={student.currentEnrollment?.class?.id ?? ""}
                    className="min-h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      {t("noClass")}
                    </option>
                    {classes
                      .filter((c) => !c.archived)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <Button type="submit" variant="outline" className="min-h-11">
                    {t("enrollAction")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CameraIcon className="size-4" aria-hidden />
                {t("imageRights")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm">
                {student.image_rights_signed_at
                  ? t("imageRightsSigned", {
                      date: format.dateTime(new Date(student.image_rights_signed_at), {
                        dateStyle: "long",
                      }),
                    })
                  : t("imageRightsMissing")}
              </p>
              {admin && (
                <form action={setImageRights}>
                  <input type="hidden" name="studentId" value={student.id} />
                  <input
                    type="hidden"
                    name="signed"
                    value={student.image_rights_signed_at ? "false" : "true"}
                  />
                  <Button
                    type="submit"
                    variant={student.image_rights_signed_at ? "destructive" : "outline"}
                    className="min-h-11"
                  >
                    {student.image_rights_signed_at ? t("imageRightsRevoke") : t("imageRightsMark")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("guardians")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {student.guardians.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noGuardians")}</p>
            )}
            {student.guardians.map((g) => (
              <div key={g.user_id} className="flex flex-col gap-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {g.profile ? `${g.profile.first_name} ${g.profile.last_name}` : g.user_id}
                      {g.is_primary && (
                        <Badge variant="secondary" className="ml-2">
                          {t("primary")}
                        </Badge>
                      )}
                      {g.access_blocked && (
                        <Badge variant="destructive" className="ml-2">
                          {t("blockedShort")}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tFamily(`relation.${g.relation}`)}
                      {g.profile?.contact?.phone ? ` · ${g.profile.contact.phone}` : ""}
                      {g.membership
                        ? ` · ${t(`guardianRole.${g.membership.role === "guardian" ? "guardian" : "parent"}`)} · ${tMembers(`status.${g.membership.status}`)}`
                        : ""}
                      {g.membership?.status === "invited"
                        ? ` · ${g.membership.invited_at ? t("invitedOn", { date: format.dateTime(new Date(g.membership.invited_at), { dateStyle: "medium" }) }) : t("notInvited")}`
                        : ""}
                    </p>
                  </div>
                  {admin && (
                    <form action={unlinkGuardian}>
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="userId" value={g.user_id} />
                      <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                        <UserMinusIcon aria-hidden />
                        {t("unlink")}
                      </Button>
                    </form>
                  )}
                </div>
                <GuardianFlagsForm
                  studentId={student.id}
                  userId={g.user_id}
                  canViewGrades={g.can_view_grades}
                  canMessage={g.can_message}
                  receivesNotifications={g.receives_notifications}
                  accessBlocked={g.access_blocked}
                  accessBlockedReason={g.restriction?.reason ?? null}
                  isAdmin={admin}
                />
              </div>
            ))}
            {admin && (
              <div className="border-t pt-4">
                <p className="mb-3 font-medium">{t("linkGuardian")}</p>
                <LinkGuardianForm studentId={student.id} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Column>
  );
}
