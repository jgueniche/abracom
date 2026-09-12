import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { moderateClassified } from "@/server/actions/community";
import { getAdminClassifieds } from "@/server/queries/community";

const STATUS_VARIANT = {
  pending: "outline",
  published: "default",
  archived: "secondary",
  rejected: "destructive",
} as const;

export default async function AdminCommunityPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, tc, format, posts] = await Promise.all([
    getTranslations("community.admin"),
    getTranslations("community.classifieds"),
    getFormatter(),
    getAdminClassifieds(schoolId),
  ]);

  return (
    <Column>
      <PageHeader title={t("moderation")} description={t("moderationSubtitle")} />
      {posts.length === 0 ? (
        <EmptyState icon={ShieldCheckIcon} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[post.status]}>{tc(`status.${post.status}`)}</Badge>
                  <Badge variant="secondary">{tc(`categories.${post.category}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(post.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <Link
                  href={`/communaute/annonces/${post.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {post.title}
                </Link>
                <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                {post.author && (
                  <p className="text-xs text-muted-foreground">
                    {tc("by", { name: `${post.author.first_name} ${post.author.last_name}` })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["published", "rejected", "archived"] as const)
                  .filter(
                    (decision) =>
                      decision !== post.status &&
                      !(post.status === "rejected" && decision === "archived"),
                  )
                  .map((decision) => (
                    <form key={decision} action={moderateClassified}>
                      <input type="hidden" name="id" value={post.id} />
                      <input type="hidden" name="decision" value={decision} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={
                          decision === "published"
                            ? "default"
                            : decision === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                        className="min-h-11"
                      >
                        {t(
                          decision === "published"
                            ? "approve"
                            : decision === "rejected"
                              ? "reject"
                              : "archive",
                        )}
                      </Button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Column>
  );
}
