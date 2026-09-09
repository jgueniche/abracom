import type { ReactNode } from "react";

import { requireSchoolStaff } from "@/lib/auth/guards";

import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSchoolStaff();
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
