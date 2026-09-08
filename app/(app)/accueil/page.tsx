import { requireCurrentUser } from "@/lib/auth/session";

import { AdminHome } from "./_components/admin-home";
import { ParentHome } from "./_components/parent-home";
import { TeacherHome } from "./_components/teacher-home";

export default async function HomePage() {
  const user = await requireCurrentUser();

  switch (user.perspective) {
    case "admin":
      return <AdminHome user={user} />;
    case "teacher":
      return <TeacherHome user={user} />;
    default:
      return <ParentHome user={user} />;
  }
}
