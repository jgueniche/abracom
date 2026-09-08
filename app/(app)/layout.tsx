import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layouts/app-shell";
import { getLegalStatus, needsOnboarding } from "@/lib/auth/legal";
import { ONBOARDING_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const legal = await getLegalStatus(user);
  if (needsOnboarding(user, legal)) redirect(ONBOARDING_PATH);

  return <AppShell user={user}>{children}</AppShell>;
}
