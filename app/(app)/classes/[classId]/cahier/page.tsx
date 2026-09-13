import { ImagesIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import { PostCard } from "@/components/domain/post-card";
import { Column } from "@/components/layouts/column";
import { SectionHeader } from "@/components/layouts/section-header";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassFeed, JOURNAL_TYPES } from "@/server/queries/class-space";

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
 *
 * Since ADR-0059 it also holds what the composer used to file under "Info" and
 * "Rappel" — two values written since session 5 and read by no screen at all.
 * They are categories of the diary, and the chips filter on them.
 */
export default async function JournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ classId }, { c }] = await Promise.all([params, searchParams]);
  const [{ cls, isTeacher, isStaff }, t, tSpace, format, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.journal"),
    getTranslations("classSpace"),
    getFormatter(),
    getClassFeed(classId, JOURNAL_TYPES),
  ]);
  const canManage = isTeacher || isStaff;
  // Drafts are invisible to families (RLS), and were invisible to their own
  // author too: the diary dropped everything without a publication date.
  const visible = posts.filter((post) => post.published_at || canManage);
  const category = JOURNAL_TYPES.find((key) => key === c);
  const entries = category ? visible.filter((post) => post.type === category) : visible;

  const months = new Map<string, typeof entries>();
  for (const post of entries) {
    const key = (post.published_at ?? post.created_at).slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), post]);
  }

  const filters = visible.length > 0 && (
    <FilterChips label={tSpace("post.category")}>
      <FilterChip href={`/classes/${classId}/cahier`} active={!category}>
        {t("filterAll")}
      </FilterChip>
      {JOURNAL_TYPES.map((key) => (
        <FilterChip
          key={key}
          href={`/classes/${classId}/cahier?c=${key}`}
          active={category === key}
        >
          {tSpace(`type.${key}`)}
        </FilterChip>
      ))}
    </FilterChips>
  );

  if (entries.length === 0)
    return (
      <Column>
        <div className="flex flex-col gap-6">
          {filters}
          <EmptyState
            icon={ImagesIcon}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              canManage
                ? { href: `/classes/${classId}/publier`, label: tSpace("post.new") }
                : undefined
            }
          />
        </div>
      </Column>
    );

  return (
    <Column>
      <div className="flex flex-col gap-10">
        {filters}
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
                /* The journal used to render its own card — a title, a photo
                 grid and no menu at all, so an entry could be neither edited
                 nor removed from the only screen that shows it. One anatomy,
                 everywhere. */
                <PostCard
                  key={post.id}
                  post={post}
                  students={[]}
                  canManage={canManage}
                  totalFamilies={cls.students.length}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Column>
  );
}
