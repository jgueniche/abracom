import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import { PostCard } from "@/components/domain/post-card";
import { Column } from "@/components/layouts/column";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { requireClassAccess } from "@/lib/auth/class-access";
import { cn } from "@/lib/utils";
import { getClassFeed, JOURNAL_TYPES } from "@/server/queries/class-space";

/**
 * Two categories a family can tell apart (ADR-0081): what the class lived, and what to know
 * or to bring. The database keeps its three types; « info » and « reminder » read as one.
 */
const CATEGORY_TYPES = {
  vie: ["journal"],
  infos: ["info", "reminder"],
} as const satisfies Record<string, ReadonlyArray<(typeof JOURNAL_TYPES)[number]>>;
type CategoryKey = keyof typeof CATEGORY_TYPES;

/**
 * The class journal, a month at a time.
 *
 * Every month used to run into the next in one scroll, each headed by a count nobody could
 * read (« Octobre 2026 · 11 »), with a third of a wide screen left empty beside a single
 * column of text. A month is now chosen like a week in the homework diary — the latest by
 * default, the arrows to go back — and a wide screen lays its pages two by two.
 */
export default async function JournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ c?: string; mois?: string }>;
}) {
  const [{ classId }, { c, mois }] = await Promise.all([params, searchParams]);
  const [{ isTeacher, isStaff }, t, tSpace, format, posts] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.journal"),
    getTranslations("classSpace"),
    getFormatter(),
    getClassFeed(classId, JOURNAL_TYPES),
  ]);
  const canManage = isTeacher || isStaff;
  const visible = posts.filter((post) => post.published_at || canManage);
  const category: CategoryKey | null = c === "vie" || c === "infos" ? c : null;
  const entries = category
    ? visible.filter((post) =>
        (CATEGORY_TYPES[category] as ReadonlyArray<string>).includes(post.type),
      )
    : visible;

  const monthOf = (post: (typeof entries)[number]) =>
    (post.published_at ?? post.created_at).slice(0, 7);
  // newest first, as the feed is
  const months = [...new Set(entries.map(monthOf))];
  const month = months.includes(mois ?? "") ? mois! : (months[0] ?? null);
  const index = month ? months.indexOf(month) : -1;
  const older = index >= 0 ? (months[index + 1] ?? null) : null;
  const newer = index > 0 ? months[index - 1]! : null;
  const shown = month ? entries.filter((post) => monthOf(post) === month) : [];

  const href = (next: { c?: CategoryKey | null; mois?: string | null }) => {
    const query = new URLSearchParams();
    const cat = next.c === undefined ? category : next.c;
    const m = next.mois === undefined ? month : next.mois;
    if (cat) query.set("c", cat);
    if (m && m !== months[0]) query.set("mois", m);
    const qs = query.toString();
    return `/classes/${classId}/cahier${qs ? `?${qs}` : ""}`;
  };
  const monthName = (key: string) =>
    format.dateTime(new Date(`${key}-01T12:00:00`), { month: "long", year: "numeric" });

  const filters = visible.length > 0 && (
    <FilterChips label={tSpace("post.category")} className="mb-1">
      <FilterChip href={href({ c: null, mois: null })} active={!category}>
        {t("filterAll")}
      </FilterChip>
      <FilterChip href={href({ c: "vie", mois: null })} active={category === "vie"}>
        {t("filterLife")}
      </FilterChip>
      <FilterChip href={href({ c: "infos", mois: null })} active={category === "infos"}>
        {t("filterPractical")}
      </FilterChip>
    </FilterChips>
  );

  if (shown.length === 0)
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

  const arrow = (target: string | null, label: string, Icon: typeof ChevronLeftIcon) =>
    target ? (
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={href({ mois: target })} aria-label={`${label} : ${monthName(target)}`}>
          <Icon aria-hidden className="size-5" />
        </Link>
      </Button>
    ) : (
      <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center">
        <Icon className="size-5 text-muted-foreground/40" />
      </span>
    );

  return (
    <Column width="full">
      {filters}
      <nav aria-label={t("months")} className="mb-4 flex max-w-xl items-center gap-2">
        <h2 className="section-label min-w-0 flex-1 first-letter:uppercase">{monthName(month!)}</h2>
        {arrow(older, t("previousMonth"), ChevronLeftIcon)}
        <span className="-ml-2">{arrow(newer, t("nextMonth"), ChevronRightIcon)}</span>
      </nav>
      <div
        className={cn("grid items-start gap-x-12 gap-y-8", shown.length > 1 && "xl:grid-cols-2")}
      >
        {shown.map((post) => (
          // One anatomy, everywhere: the journal used to render its own card, with no menu, so an
          // entry could be neither edited nor removed from the only screen that shows it.
          <PostCard key={post.id} post={post} canManage={canManage} />
        ))}
      </div>
    </Column>
  );
}
