import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PostCard } from "@/components/domain/post-card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { canWriteInSchool } from "@/lib/permissions";
import { getClassFeed } from "@/server/queries/class-space";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function HomeworkPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ user, cls, isTeacher, isStaff, myStudentIds }, t, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.week"),
    getClassFeed(classId, "homework"),
  ]);
  // read-only guardians see the homework but cannot tick it
  const myStudents = canWriteInSchool(user.roles, cls.school_id)
    ? cls.students.filter((s) => myStudentIds.includes(s.id))
    : [];
  const today = new Date();
  const week = startOfWeek(today);
  const nextWeek = new Date(week);
  nextWeek.setDate(week.getDate() + 7);
  const afterNext = new Date(week);
  afterNext.setDate(week.getDate() + 14);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const groups = [
    { key: "overdue", items: posts.filter((p) => p.due_on && p.due_on < iso(today)) },
    {
      key: "thisWeek",
      items: posts.filter((p) => p.due_on && p.due_on >= iso(today) && p.due_on < iso(nextWeek)),
    },
    {
      key: "nextWeek",
      items: posts.filter(
        (p) => p.due_on && p.due_on >= iso(nextWeek) && p.due_on < iso(afterNext),
      ),
    },
    { key: "later", items: posts.filter((p) => p.due_on && p.due_on >= iso(afterNext)) },
  ] as const;

  if (posts.length === 0) return <EmptyState title={t("noHomework")} />;

  return (
    <div className="flex flex-col gap-8">
      {groups
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <h2>{t(group.key)}</h2>
            <div className="grid gap-4 2xl:grid-cols-2">
              {[...group.items]
                .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""))
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    students={myStudents}
                    canManage={isTeacher || isStaff}
                    totalFamilies={cls.students.length}
                  />
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}
