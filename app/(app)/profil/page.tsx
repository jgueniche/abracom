import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { SignOutButton } from "@/components/layouts/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLegalStatus } from "@/lib/auth/legal";
import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  const [t, tRoles, tOnboarding, format, legal, supabase] = await Promise.all([
    getTranslations("profile"),
    getTranslations("roles"),
    getTranslations("auth.onboarding"),
    getFormatter(),
    getLegalStatus(user),
    createClient(),
  ]);
  const { data: acceptances } = await supabase
    .from("legal_acceptances")
    .select("legal_document_id, accepted_at")
    .eq("user_id", user.id);
  const acceptedAt = new Map((acceptances ?? []).map((a) => [a.legal_document_id, a.accepted_at]));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<SignOutButton className="min-h-11" />}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent>
            <ProfileForm
              email={user.email ?? ""}
              firstName={user.profile.first_name}
              lastName={user.profile.last_name}
              phone={user.profile.phone ?? ""}
              locale={user.profile.locale}
              showHebrewDate={user.profile.show_hebrew_date}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("roles")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {user.memberships.map((m) => (
                <Badge key={m.id} variant={m.status === "active" ? "secondary" : "outline"}>
                  {tRoles(m.role)}
                  {m.school ? ` · ${m.school.name}` : ""}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("legal")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {legal.documents.map((d) => {
                  const when = acceptedAt.get(d.id);
                  return (
                    <li key={d.id} className="flex flex-col">
                      <span className="font-medium">
                        {tOnboarding(`kind.${d.kind as "terms" | "charter" | "privacy"}`)} ·{" "}
                        {tOnboarding("version", { version: d.version })}
                      </span>
                      <span className="text-muted-foreground">
                        {when
                          ? t("acceptedOn", {
                              date: format.dateTime(new Date(when), {
                                dateStyle: "long",
                                timeStyle: "short",
                              }),
                            })
                          : t("notAccepted")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
