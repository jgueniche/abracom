import "server-only";

import { notFound } from "next/navigation";

import { type CurrentUser, requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getClassSummary, getMyClassIds } from "@/server/queries/class-space";

export type ClassContext = {
  user: CurrentUser;
  cls: NonNullable<Awaited<ReturnType<typeof getClassSummary>>>;
  isTeacher: boolean;
  isStaff: boolean;
  /** Children of the user enrolled in this class (parents / guardians). */
  myStudentIds: string[];
};

/** Opens a class for teachers of the class, staff of the school and guardians of its students. */
export async function requireClassAccess(classId: string): Promise<ClassContext> {
  const user = await requireCurrentUser();
  const [cls, myClassIds] = await Promise.all([getClassSummary(classId), getMyClassIds(user.id)]);
  if (!cls) notFound();
  const isStaff = isSchoolStaff(user.roles, cls.school_id);
  const isTeacher = cls.class_teachers.some((ct) => ct.user_id === user.id);
  if (!isStaff && !isTeacher && !myClassIds.includes(classId)) notFound();

  const myStudentIds = isTeacher || isStaff ? [] : cls.students.map((s) => s.id);
  return { user, cls, isTeacher, isStaff, myStudentIds };
}
