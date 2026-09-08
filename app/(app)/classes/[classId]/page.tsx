import { getTranslations } from "next-intl/server";

import { PostCard } from "@/components/domain/post-card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassFeed } from "@/server/queries/class-space";

export default async function ClassFeedPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ cls, isTeacher, isStaff, myStudentIds }, t, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace"),
    getClassFeed(classId),
  ]);
  const myStudents = cls.students.filter((s) => myStudentIds.includes(s.id));

  return posts.length === 0 ? (
    <p className="text-muted-foreground">{t("noPosts")}</p>
  ) : (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          students={myStudents}
          canManage={isTeacher || isStaff}
          totalFamilies={cls.students.length}
        />
      ))}
    </div>
  );
}
