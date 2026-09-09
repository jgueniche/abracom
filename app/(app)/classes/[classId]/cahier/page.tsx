import { getFormatter, getTranslations } from "next-intl/server";

import { MediaGrid } from "@/components/domain/media-grid";
import { requireClassAccess } from "@/lib/auth/class-access";
import { getClassFeed } from "@/server/queries/class-space";

export default async function JournalPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ isTeacher, isStaff }, t, format, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.journal"),
    getFormatter(),
    getClassFeed(classId, "journal"),
  ]);
  const withMedia = posts.filter((p) => p.published_at && p.media.length > 0);
  const months = new Map<string, typeof withMedia>();
  for (const post of withMedia) {
    const key = post.published_at!.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), post]);
  }
  if (withMedia.length === 0) return <p className="text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-8">
      {[...months.entries()].map(([month, items]) => (
        <section key={month} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold capitalize">
            {format.dateTime(new Date(`${month}-01T12:00:00`), { month: "long", year: "numeric" })}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("photos", { count: items.reduce((n, p) => n + p.media.length, 0) })}
            </span>
          </h2>
          {items.map((post) => (
            <div key={post.id} className="flex flex-col gap-2">
              <p className="font-medium">{post.title}</p>
              <MediaGrid items={post.media} canDelete={isTeacher || isStaff} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
