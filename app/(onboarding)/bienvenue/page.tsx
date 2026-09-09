import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLegalStatus, needsOnboarding } from "@/lib/auth/legal";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { appName } from "@/lib/env";

import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  const user = await requireCurrentUser();
  const legal = await getLegalStatus(user);
  if (!needsOnboarding(user, legal)) redirect(APP_HOME_PATH);

  const t = await getTranslations("auth.onboarding");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("subtitle", { appName })}</p>
      </div>
      <OnboardingForm
        firstName={user.profile.first_name}
        lastName={user.profile.last_name}
        invitations={user.memberships
          .filter((m) => m.status === "invited")
          .map((m) => ({
            schoolId: m.school_id,
            schoolName: m.school?.name ?? t("unknownSchool"),
            role: m.role,
          }))
          .filter((m, index, all) => all.findIndex((x) => x.schoolId === m.schoolId) === index)}
        legal={legal.documents.map((d) => ({
          id: d.id,
          kind: d.kind,
          version: d.version,
          body: d.body_md,
          accepted: d.accepted,
        }))}
      />
    </div>
  );
}
