import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";

import { PostForm } from "./post-form";

export default async function PublishPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ cls, isTeacher, isStaff }, t] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.post"),
  ]);
  if (!isTeacher && !isStaff) notFound();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("new")}</CardTitle>
      </CardHeader>
      <CardContent>
        <PostForm
          classId={classId}
          students={cls.students.map((s) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            imageRights: s.image_rights_signed_at !== null,
          }))}
        />
      </CardContent>
    </Card>
  );
}
