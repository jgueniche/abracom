import { getFormatter, getTranslations } from "next-intl/server";

import { ContentCard, EyebrowDot } from "@/components/domain/content-card";
import { Markdown } from "@/components/domain/markdown";
import { MediaGrid } from "@/components/domain/media-grid";
import { PostActions } from "@/components/domain/post-actions";
import { plainExcerpt } from "@/lib/text";
import type { ClassPost } from "@/server/queries/class-space";

/** Past this many characters the body is folded behind "Lire la suite". */
const FOLD_AT = 320;

/**
 * An entry of the cahier de vie. Homework used to share this card, « vu » buttons included; it
 * has its own layout in the diary since session 33 (ADR-0070), so this card is the diary's only.
 */
export async function PostCard({ post, canManage }: { post: ClassPost; canManage: boolean }) {
  const [t, format] = await Promise.all([getTranslations("classSpace"), getFormatter()]);
  const isDraft = post.published_at === null;
  const body = post.body_md ?? "";
  const long = body.length > FOLD_AT;

  return (
    <ContentCard
      muted={isDraft}
      eyebrow={
        <>
          {/* The type used to be preceded by its own pictogram — a megaphone
              beside the word "Rappel", an image beside "Vie de classe". Once the
              diary shows all three categories at once the icons became a column
              of decoration repeating, in a picture, the word written next to
              them (ADR-0056 removed the same thing elsewhere). */}
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
        </>
      }
      title={post.title}
      menu={
        canManage ? (
          <PostActions
            postId={post.id}
            editHref={`/classes/${post.class_id}/publier?post=${post.id}`}
          />
        ) : undefined
      }
      body={
        body ? (
          // The full Markdown used to be printed inside every feed row: a
          // 400-word journal entry with twelve photos, in a list.
          long ? (
            <details className="group/body">
              <summary className="cursor-pointer list-none">
                <span className="block text-sm text-pretty text-muted-foreground group-open/body:hidden">
                  {plainExcerpt(body, 260)}
                </span>
                <span className="mt-1 inline-block text-sm font-semibold text-primary group-open/body:hidden">
                  {t("readMore")}
                </span>
              </summary>
              <Markdown size="compact">{body}</Markdown>
            </details>
          ) : (
            <Markdown size="compact">{body}</Markdown>
          )
        ) : undefined
      }
      media={
        <MediaGrid
          items={post.media}
          title={post.title}
          canDelete={canManage}
          limit={canManage ? undefined : 4}
        />
      }
      footer={
        <>
          <span className="text-xs text-muted-foreground">
            {post.author ? `${post.author.first_name} ${post.author.last_name}` : ""}
            {post.published_at
              ? ` · ${format.dateTime(new Date(post.published_at), { dateStyle: "medium" })}`
              : ""}
          </span>
        </>
      }
    />
  );
}
