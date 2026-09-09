import type { ReactNode } from "react";

import { requireSchoolStaff } from "@/lib/auth/guards";

import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSchoolStaff();
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 2xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:gap-12">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
