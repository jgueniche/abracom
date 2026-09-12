import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";

import { PostForm } from "./post-form";

const TYPES = ["journal", "homework", "info", "reminder"] as const;
type PostType = (typeof TYPES)[number];

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ classId }, { type }] = await Promise.all([params, searchParams]);
  const [{ cls, isTeacher, isStaff }, t] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.post"),
  ]);
  if (!isTeacher && !isStaff) notFound();
  const defaultType = TYPES.includes(type as PostType) ? (type as PostType) : "journal";
  return (
    <Column width="text">
      <Card>
        <CardHeader>
          <CardTitle>{defaultType === "homework" ? t("newHomework") : t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostForm
            classId={classId}
            defaultType={defaultType}
            students={cls.students.map((s) => ({
              id: s.id,
              name: `${s.first_name} ${s.last_name}`,
              imageRights: s.image_rights_signed_at !== null,
            }))}
          />
        </CardContent>
      </Card>
    </Column>
  );
}
