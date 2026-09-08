import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layouts/app-shell";
import { getLegalStatus, needsOnboarding } from "@/lib/auth/legal";
import { getMfaStatus } from "@/lib/auth/mfa";
import { ONBOARDING_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const [legal, mfa] = await Promise.all([getLegalStatus(user), getMfaStatus()]);
  if (needsOnboarding(user, legal)) redirect(ONBOARDING_PATH);
  if (mfa.enrolled && !mfa.verified) redirect("/verification");

  return <AppShell user={user}>{children}</AppShell>;
}
