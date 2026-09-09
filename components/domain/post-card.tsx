import { BookOpenIcon, CheckIcon, ImageIcon, InfoIcon, MegaphoneIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { ContentCard, EyebrowDot, MetaChip } from "@/components/domain/content-card";
import { Markdown } from "@/components/domain/markdown";
import { MediaGrid } from "@/components/domain/media-grid";
import { PostActions } from "@/components/domain/post-actions";
import { Button } from "@/components/ui/button";
import { plainExcerpt } from "@/lib/text";
import { toggleHomeworkSeen } from "@/server/actions/class-posts";
import type { ClassPost } from "@/server/queries/class-space";

const ICONS = {
  homework: BookOpenIcon,
  journal: ImageIcon,
  info: InfoIcon,
  reminder: MegaphoneIcon,
} as const;

/** Past this many characters the body is folded behind "Lire la suite". */
const FOLD_AT = 320;

export async function PostCard({
  post,
  students,
  canManage,
  totalFamilies,
}: {
  post: ClassPost;
  /** Children of the viewer in this class (parents) — used for the "vu" toggles. */
  students: Array<{ id: string; first_name: string }>;
  canManage: boolean;
  totalFamilies?: number;
}) {
  const [t, format] = await Promise.all([getTranslations("classSpace"), getFormatter()]);
  const Icon = ICONS[post.type];
  const isDraft = post.published_at === null;
  const body = post.body_md ?? "";
  const long = body.length > FOLD_AT;

  return (
    <ContentCard
      muted={isDraft}
      eyebrow={
        <>
          <Icon className="size-3.5" aria-hidden />
          {t(`type.${post.type}`)}
          {post.subject && (
            <>
              <EyebrowDot />
              {post.subject}
            </>
          )}
          {post.visibility === "staff" && (
            <>
              <EyebrowDot />
              {t("visibility.staff")}
            </>
          )}
          {isDraft && (
            <>
              <EyebrowDot />
              {t("draft")}
            </>
          )}
          {post.due_on && (
            <>
              <EyebrowDot />
              <span className="text-brick">
                {t("dueOn", {
                  date: format.dateTime(new Date(post.due_on), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }),
                })}
              </span>
            </>
          )}
        </>
      }
      title={post.title}
      menu={canManage ? <PostActions postId={post.id} /> : undefined}
      body={
        body ? (
          // The full Markdown used to be printed inside every feed row: a
          // 400-word journal entry with twelve photos, in a list.
          long ? (
            <details className="group/body">
              <summary className="cursor-pointer list-none">
                <span className="prose-kesher block text-[0.9375rem] text-pretty group-open/body:hidden">
                  {plainExcerpt(body, 260)}
                </span>
                <span className="mt-1 inline-block text-sm font-semibold text-primary group-open/body:hidden">
                  {t("readMore")}
                </span>
              </summary>
              <Markdown>{body}</Markdown>
            </details>
          ) : (
            <Markdown>{body}</Markdown>
          )
        ) : undefined
      }
      media={
        <MediaGrid items={post.media} canDelete={canManage} limit={canManage ? undefined : 4} />
      }
      footer={
        <>
          <span className="text-xs text-muted-foreground">
            {post.author ? `${post.author.first_name} ${post.author.last_name}` : ""}
            {post.published_at
              ? ` · ${format.dateTime(new Date(post.published_at), { dateStyle: "medium" })}`
              : ""}
          </span>
          {post.type === "homework" &&
            students.map((student) => {
              const done = post.completions.some((c) => c.student_id === student.id);
              return (
                <form key={student.id} action={toggleHomeworkSeen} className="ml-auto">
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="classId" value={post.class_id} />
                  <input type="hidden" name="done" value={String(done)} />
                  <Button
                    type="submit"
                    variant={done ? "secondary" : "default"}
                    size="sm"
                    className="min-h-11"
                    aria-pressed={done}
                  >
                    <CheckIcon aria-hidden />
                    {done
                      ? `${t("seen")} · ${student.first_name}`
                      : t("markSeen", { name: student.first_name })}
                  </Button>
                </form>
              );
            })}
          {post.type === "homework" && canManage && totalFamilies !== undefined && (
            // The denominator was passed in as a prop and never printed:
            // "Vu par 4" told nobody whether that was 4 out of 5 or 4 out of 27.
            <MetaChip tone={post.completions.length >= totalFamilies ? "success" : "neutral"}>
              {t("seenByTotal", { count: post.completions.length, total: totalFamilies })}
            </MetaChip>
          )}
        </>
      }
    />
  );
}
