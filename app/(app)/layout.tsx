import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layouts/app-shell";
import { getLegalStatus, needsOnboarding } from "@/lib/auth/legal";
import { getMfaStatus } from "@/lib/auth/mfa";
import { ONBOARDING_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { requiresStrongAuth } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const [legal, mfa] = await Promise.all([getLegalStatus(user), getMfaStatus()]);
  if (needsOnboarding(user, legal)) redirect(ONBOARDING_PATH);
  if (mfa.enrolled && !mfa.verified) redirect("/verification");
  // administrators hold no admin right until they enrol (RLS requires aal2): send them there first
  if (!mfa.enrolled && requiresStrongAuth(user.roles)) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/profil/securite")) redirect("/profil/securite?requis=1");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
