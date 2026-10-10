import { notFound, redirect } from "next/navigation";
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
  searchParams: Promise<{ type?: string; post?: string; retour?: string }>;
}) {
  const [{ classId }, { type, post: postId, retour }] = await Promise.all([params, searchParams]);
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

  // Homework has its own composer in the homework space since session 33 (ADR-0070); the old
  // addresses — bookmarks, the teacher's queue of drafts — still land on it.
  if (defaultType === "homework")
    redirect(
      existing
        ? `/devoirs/${existing.id}/modifier`
        : `/devoirs/nouveau?classe=${classId}${retour === "classe" ? "&retour=classe" : ""}`,
    );

  return (
    <Column width="index">
      <Card>
        <CardHeader>
          <CardTitle>{existing ? t("editTitle") : t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostForm
            classId={classId}
            schoolId={cls.school_id}
            postId={existing?.id ?? globalThis.crypto.randomUUID()}
            defaultType={defaultType}
            post={
              existing
                ? {
                    title: existing.title,
                    bodyMd: existing.body_md ?? "",
                    subject: existing.subject,
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
