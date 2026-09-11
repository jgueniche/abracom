import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  getClassifieds,
  getMyClassifieds,
} from "@/server/queries/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.classifieds");
  return { title: t("title") };
}

const STATUS_VARIANT = {
  pending: "outline",
  published: "default",
  archived: "secondary",
  rejected: "destructive",
} as const;

export default async function ClassifiedsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requireCurrentUser();
  const { c } = await searchParams;
  const category = (COMMUNITY_CATEGORIES as readonly string[]).includes(c ?? "")
    ? (c as CommunityCategory)
    : null;
  const [t, format, posts, mine] = await Promise.all([
    getTranslations("community.classifieds"),
    getFormatter(),
    getClassifieds({ category }),
    getMyClassifieds(user.id),
  ]);
  const schoolId = user.school?.id;
  const modules = (user.school?.modules ?? {}) as { marketplace?: unknown };
  const enabled = modules.marketplace !== false;
  const canPost = enabled && schoolId !== undefined && canWriteInSchool(user.roles, schoolId);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canPost ? (
            <Button asChild className="min-h-11">
              <Link href="/communaute/annonces/nouvelle">
                <PlusIcon aria-hidden />
                {t("new")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!enabled && <p className="mb-4 text-sm text-muted-foreground">{t("disabled")}</p>}
      <FilterChips label={t("title")}>
        {[null, ...COMMUNITY_CATEGORIES].map((key) => (
          <FilterChip
            key={key ?? "all"}
            href={key ? `/communaute/annonces?c=${key}` : "/communaute/annonces"}
            active={category === key}
          >
            {key ? t(`categories.${key}`) : t("all")}
          </FilterChip>
        ))}
      </FilterChips>
      {posts.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={canPost ? { href: "/communaute/annonces/nouvelle", label: t("new") } : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/communaute/annonces/${post.id}`}
                className="block rounded-xl border p-4 hover:bg-muted/60"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`categories.${post.category}`)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(post.created_at), { dateStyle: "medium" })}
                  </span>
                </div>
                <p className="font-heading text-lg font-semibold">{post.title}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                {post.author && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("by", { name: `${post.author.first_name} ${post.author.last_name}` })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mine.length > 0 && (
        <section className="mt-10">
          <SectionHeader label={t("mine")} count={mine.length} />
          <ul className="flex flex-col gap-2">
            {mine.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/communaute/annonces/${post.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
                >
                  <Badge variant={STATUS_VARIANT[post.status]}>{t(`status.${post.status}`)}</Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{post.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
