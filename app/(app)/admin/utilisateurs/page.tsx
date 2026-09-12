import { getFormatter, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import {
  removeMembership,
  resendInvitation,
  setMembershipStatus,
} from "@/server/actions/admin/members";
import { getMembers, MEMBERS_PAGE_SIZE } from "@/server/queries/admin";

import { InviteForm } from "./invite-form";
import { SendInvitations } from "./send-invitations";

type Member = Awaited<ReturnType<typeof getMembers>>["team"][number];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tRoles, format, members] = await Promise.all([
    getTranslations("admin.members"),
    getTranslations("roles"),
    getFormatter(),
    getMembers(schoolId, q),
  ]);
  const admin = isSchoolAdmin(user.roles, schoolId);

  const row = (m: Member) => (
    <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">
          {m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : m.user_id}
          <Badge
            variant={
              m.status === "active"
                ? "secondary"
                : m.status === "suspended"
                  ? "destructive"
                  : "outline"
            }
            className="ml-2"
          >
            {t(`status.${m.status}`)}
          </Badge>
        </p>
        <p className="text-sm text-muted-foreground">
          {tRoles(m.role)}
          {m.profile?.contact?.phone ? ` · ${m.profile.contact.phone}` : ""}
          {m.invited_at
            ? ` · ${t("lastLink", { date: format.dateTime(new Date(m.invited_at), { dateStyle: "medium" }) })}`
            : ""}
        </p>
      </div>
      {m.role !== "super_admin" && (
        <div className="flex flex-wrap gap-2">
          <form action={resendInvitation}>
            <input type="hidden" name="userId" value={m.user_id} />
            <Button type="submit" variant="outline" size="sm" className="min-h-11">
              {t("resend")}
            </Button>
          </form>
          {admin && m.user_id !== user.id && (
            <>
              <form action={setMembershipStatus}>
                <input type="hidden" name="membershipId" value={m.id} />
                <input
                  type="hidden"
                  name="status"
                  value={m.status === "suspended" ? "active" : "suspended"}
                />
                <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                  {m.status === "suspended" ? t("reactivate") : t("suspend")}
                </Button>
              </form>
              <form action={removeMembership}>
                <input type="hidden" name="membershipId" value={m.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 text-destructive"
                >
                  {t("remove")}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </li>
  );

  return (
    <Column width="full">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("team")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">{members.team.map(row)}</ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("parents")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {admin && <SendInvitations pending={members.pending} />}
              <form method="get" className="flex flex-wrap items-end gap-2">
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <label htmlFor="member-search" className="text-sm font-medium">
                    {t("search")}
                  </label>
                  <Input
                    id="member-search"
                    name="q"
                    defaultValue={q}
                    placeholder={t("searchPlaceholder")}
                    className="min-h-11"
                  />
                </div>
                <Button type="submit" variant="outline" className="min-h-11">
                  {t("search")}
                </Button>
              </form>
              {members.parentsTotal > members.parents.length && (
                <p className="text-sm text-muted-foreground">
                  {t("truncated", { count: MEMBERS_PAGE_SIZE })}
                </p>
              )}
              <details open={q.trim() !== ""}>
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
                  {t("showParents", { count: members.parentsTotal })}
                </summary>
                <ul className="divide-y">{members.parents.map(row)}</ul>
              </details>
            </CardContent>
          </Card>
        </div>
        {admin && (
          <Card className="self-start">
            <CardHeader>
              <CardTitle>{t("invite")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
        )}
      </div>
    </Column>
  );
}
