import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassPost } from "@/server/queries/class-space";

import { PostForm } from "./post-form";

const TYPES = ["journal", "homework", "info", "reminder"] as const;
type PostType = (typeof TYPES)[number];

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ type?: string; post?: string }>;
}) {
  const [{ classId }, { type, post: postId }] = await Promise.all([params, searchParams]);
  const [{ cls, isTeacher, isStaff }, t] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.post"),
  ]);
  if (!isTeacher && !isStaff) notFound();

  // Editing has been possible in `saveClassPost` since session 5 — it takes an
  // `id` and updates — but nothing in the interface ever passed one. A teacher
  // who mistyped a due date could only delete the homework in front of the
  // families and set it again.
  const existing = postId ? await getClassPost(classId, postId) : null;
  if (postId && !existing) notFound();

  const defaultType: PostType = existing
    ? existing.type
    : TYPES.includes(type as PostType)
      ? (type as PostType)
      : "journal";

  return (
    <Column width="index">
      <Card>
        <CardHeader>
          <CardTitle>
            {existing ? t("editTitle") : defaultType === "homework" ? t("newHomework") : t("new")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PostForm
            classId={classId}
            defaultType={defaultType}
            post={
              existing
                ? {
                    id: existing.id,
                    title: existing.title,
                    bodyMd: existing.body_md ?? "",
                    subject: existing.subject,
                    dueOn: existing.due_on,
                    visibility: existing.visibility,
                  }
                : undefined
            }
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
