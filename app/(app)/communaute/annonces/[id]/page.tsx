import { ArrowLeftIcon, MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { archiveClassified, moderateClassified } from "@/server/actions/community";
import { getClassified } from "@/server/queries/community";

export default async function ClassifiedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [t, ta, format, post] = await Promise.all([
    getTranslations("community.classifieds"),
    getTranslations("community.admin"),
    getFormatter(),
    getClassified(id),
  ]);
  if (!post) notFound();
  const staff = user.school !== null && isSchoolStaff(user.roles, user.school.id);
  const own = post.author_id === user.id;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/communaute/annonces">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={post.title}
        description={[
          post.author
            ? t("by", { name: `${post.author.first_name} ${post.author.last_name}` })
            : null,
          t("on", { date: format.dateTime(new Date(post.created_at), { dateStyle: "long" }) }),
          post.status === "published"
            ? t("expires", {
                date: format.dateTime(new Date(post.expires_at), { dateStyle: "medium" }),
              })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{t(`categories.${post.category}`)}</Badge>
        {post.status !== "published" && (
          <Badge variant="outline">{t(`status.${post.status}`)}</Badge>
        )}
      </div>
      {own && post.status === "pending" && (
        <p className="mb-4 text-sm text-muted-foreground">{t("pendingBanner")}</p>
      )}
      {own && post.status === "rejected" && (
        <p className="mb-4 text-sm text-destructive">{t("rejectedBanner")}</p>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent>
            <p className="whitespace-pre-line">{post.body}</p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          {post.status === "published" && !own && (
            <Card>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{t("contact")}</p>
                {post.contact?.phone && (
                  <a
                    href={`tel:${post.contact.phone}`}
                    className="flex min-h-11 items-center gap-2 text-primary underline"
                  >
                    <PhoneIcon className="size-4" aria-hidden />
                    {post.contact.phone}
                  </a>
                )}
                {post.contact?.email && (
                  <a
                    href={`mailto:${post.contact.email}`}
                    className="flex min-h-11 items-center gap-2 text-primary underline"
                  >
                    <MailIcon className="size-4" aria-hidden />
                    {post.contact.email}
                  </a>
                )}
                {!post.contact?.phone && !post.contact?.email && (
                  <p className="text-sm text-muted-foreground">{t("noContact")}</p>
                )}
              </CardContent>
            </Card>
          )}
          {own && post.status !== "archived" && (
            <form action={archiveClassified}>
              <input type="hidden" name="id" value={post.id} />
              <Button type="submit" variant="outline" className="min-h-11 w-full">
                {t("archive")}
              </Button>
            </form>
          )}
          {staff && (
            <Card>
              <CardContent className="flex flex-wrap gap-2">
                {(["published", "rejected", "archived"] as const)
                  .filter((decision) => decision !== post.status)
                  .map((decision) => (
                    <form key={decision} action={moderateClassified}>
                      <input type="hidden" name="id" value={post.id} />
                      <input type="hidden" name="decision" value={decision} />
                      <Button
                        type="submit"
                        variant={
                          decision === "published"
                            ? "default"
                            : decision === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                        className="min-h-11"
                      >
                        {ta(
                          decision === "published"
                            ? "approve"
                            : decision === "rejected"
                              ? "reject"
                              : "archive",
                        )}
                      </Button>
                    </form>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
