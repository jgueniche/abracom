import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PasswordForm } from "@/components/forms/password-form";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { appName } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("password");
  return { title: t("title") };
}

/**
 * The first stop of an account the school opened with a provisional password
 * (ADR-0075): the application stays closed until the person has chosen theirs.
 */
export default async function ChoosePasswordPage() {
  const user = await requireCurrentUser();
  if (!user.passwordProvisional) redirect(APP_HOME_PATH);
  const t = await getTranslations("password");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1>{t("title")}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{t("intro", { appName })}</p>
      </div>
      <PasswordForm mode="choose" email={user.email} />
    </div>
  );
}
