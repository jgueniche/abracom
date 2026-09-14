import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layouts/app-shell";
import { buildLegalStatus, fetchLegalRows, needsOnboarding } from "@/lib/auth/legal";
import { isMfaEnrolled } from "@/lib/auth/mfa";
import { ONBOARDING_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { mfaRequiredFor } from "@/lib/auth/policy";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // One stage, not two. Everything here needs at most the reader's identifier,
  // which the token already carries, so nothing waits for the profile to come
  // back before it can start (ADR-0061).
  const [user, legalRows, mfaEnrolled] = await Promise.all([
    requireCurrentUser(),
    fetchLegalRows(),
    isMfaEnrolled(),
  ]);
  const legal = buildLegalStatus(user, legalRows);
  const mfa = { enrolled: mfaEnrolled, verified: user.aal === "aal2" };
  if (needsOnboarding(user, legal)) redirect(ONBOARDING_PATH);
  if (mfa.enrolled && !mfa.verified) redirect("/verification");
  // administrators hold no admin right until they enrol (RLS requires aal2): send them there first
  if (!mfa.enrolled && mfaRequiredFor(user)) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/profil/securite")) redirect("/profil/securite?requis=1");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
