import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/layouts/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMfaStatus } from "@/lib/auth/mfa";
import { APP_HOME_PATH, safeNextPath } from "@/lib/auth/routes";
import { requireCurrentUser } from "@/lib/auth/session";
import { appName } from "@/lib/env";

import { VerificationForm } from "./verification-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("verification");
  return { title: t("title") };
}

/** Second sign-in step for people who enabled two-factor authentication. */
export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireCurrentUser();
  const { next } = await searchParams;
  const target = safeNextPath(next, APP_HOME_PATH);
  const status = await getMfaStatus();
  if (!status.enrolled || status.verified) redirect(target);
  const t = await getTranslations("verification");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <p className="text-center font-heading text-xl font-semibold">{appName}</p>
      <Card>
        <CardHeader>
          <ShieldCheckIcon className="size-8 text-primary" aria-hidden />
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <VerificationForm next={target} />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">{t("help")}</p>
      <div className="flex justify-center">
        <SignOutButton className="min-h-11" />
      </div>
    </main>
  );
}
