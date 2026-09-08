import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layouts/site-header";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
