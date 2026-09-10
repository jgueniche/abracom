import type { ReactNode } from "react";

import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";

import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, schoolId } = await requireSchoolStaff();
  // Import and Journal are the direction's alone: the secretariat used to see
  // them in the sidebar, click them, and be sent back to the home page silently.
  const isAdmin = isSchoolAdmin(user.roles, schoolId);
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 2xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:gap-12">
      <AdminNav isAdmin={isAdmin} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
