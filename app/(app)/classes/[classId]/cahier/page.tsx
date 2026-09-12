import { ImagesIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { ContentCard, EyebrowDot } from "@/components/domain/content-card";
import { EmptyState } from "@/components/domain/empty-state";
import { Markdown } from "@/components/domain/markdown";
import { MediaGrid } from "@/components/domain/media-grid";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassFeed } from "@/server/queries/class-space";

/**
 * The cahier de vie: what happened in the class, month by month.
 *
 * It used to keep only the entries that carried a photo, and of those it
 * rendered the title and the grid — never the text. So a teacher who wrote
 * "belle sortie au parc, les enfants ont rapporté des feuilles" without taking
 * a picture published into the void, and one who wrote it *with* a picture had
 * their words dropped on the floor. There is no other screen where a journal
 * entry appears: the "Fil" tab that used to carry them was removed in session
 * 16 because it duplicated Homework and Journal. A cahier de vie is a diary,
 * not an album; the photographs illustrate it.
 */
export default async function JournalPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ isTeacher, isStaff }, t, tSpace, format, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.journal"),
    getTranslations("classSpace"),
    getFormatter(),
    getClassFeed(classId, "journal"),
  ]);
  const entries = posts.filter((post) => post.published_at);
  const months = new Map<string, typeof entries>();
  for (const post of entries) {
    const key = post.published_at!.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), post]);
  }

  if (entries.length === 0)
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
    <div className="flex flex-col gap-10">
      {[...months.entries()].map(([month, items]) => (
        <section key={month} className="flex flex-col">
          <SectionHeader
            label={format.dateTime(new Date(`${month}-01T12:00:00`), {
              month: "long",
              year: "numeric",
            })}
            count={items.length}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((post) => (
              /* The journal used to render a bare <p> and a grid: the third
                 rendering of the very same post. One anatomy, everywhere. */
              <ContentCard
                key={post.id}
                title={post.title}
                eyebrow={
                  <>
                    {format.dateTime(new Date(post.published_at!), { dateStyle: "long" })}
                    {post.media.length > 0 && (
                      <>
                        <EyebrowDot />
                        {t("photos", { count: post.media.length })}
                      </>
                    )}
                  </>
                }
                body={post.body_md ? <Markdown size="compact">{post.body_md}</Markdown> : undefined}
                media={
                  post.media.length > 0 ? (
                    <MediaGrid items={post.media} canDelete={isTeacher || isStaff} />
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
