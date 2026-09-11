import { ImagesIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { ContentCard, EyebrowDot } from "@/components/domain/content-card";
import { EmptyState } from "@/components/domain/empty-state";
import { SectionHeader } from "@/components/layouts/section-header";
import { MediaGrid } from "@/components/domain/media-grid";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassFeed } from "@/server/queries/class-space";

export default async function JournalPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ isTeacher, isStaff }, t, tSpace, format, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.journal"),
    getTranslations("classSpace"),
    getFormatter(),
    getClassFeed(classId, "journal"),
  ]);
  const withMedia = posts.filter((p) => p.published_at && p.media.length > 0);
  const months = new Map<string, typeof withMedia>();
  for (const post of withMedia) {
    const key = post.published_at!.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), post]);
  }
  if (withMedia.length === 0)
    return (
      <EmptyState
        icon={ImagesIcon}
        title={t("empty")}
        description={t("emptyHint")}
        action={
          isTeacher || isStaff
            ? { href: `/classes/${classId}/publier`, label: tSpace("post.new") }
            : undefined
        }
      />
    );

  return (
    <div className="flex flex-col gap-8">
      {[...months.entries()].map(([month, items]) => (
        <section key={month} className="flex flex-col">
          <SectionHeader
            label={format.dateTime(new Date(`${month}-01T12:00:00`), {
              month: "long",
              year: "numeric",
            })}
            count={t("photos", { count: items.reduce((n, p) => n + p.media.length, 0) })}
          />
          <div className="grid gap-4 2xl:grid-cols-2">
            {items.map((post) => (
              /* The journal used to render a bare <p> and a grid: the third
                 rendering of the very same post. One anatomy, everywhere. */
              <ContentCard
                key={post.id}
                title={post.title}
                eyebrow={
                  post.published_at ? (
                    <>
                      {format.dateTime(new Date(post.published_at), { dateStyle: "long" })}
                      <EyebrowDot />
                      {t("photos", { count: post.media.length })}
                    </>
                  ) : undefined
                }
                media={<MediaGrid items={post.media} canDelete={isTeacher || isStaff} />}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
