import {
  BookOpenIcon,
  CheckIcon,
  ImageIcon,
  InfoIcon,
  MegaphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { MediaGrid } from "@/components/domain/media-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteClassPost, toggleHomeworkSeen } from "@/server/actions/class-posts";
import type { ClassPost } from "@/server/queries/class-space";

const ICONS = {
  homework: BookOpenIcon,
  journal: ImageIcon,
  info: InfoIcon,
  reminder: MegaphoneIcon,
} as const;

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

  return (
    <Card className={cn("shadow-soft", isDraft && "border-dashed")}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={post.type === "homework" ? "default" : "secondary"}>
            <Icon aria-hidden />
            {t(`type.${post.type}`)}
          </Badge>
          {post.subject && <Badge variant="outline">{post.subject}</Badge>}
          {post.visibility === "staff" && <Badge variant="outline">{t("visibility.staff")}</Badge>}
          {isDraft && <Badge variant="outline">{t("draft")}</Badge>}
          {post.due_on && (
            <span className="text-xs text-muted-foreground">
              {t("dueOn", {
                date: format.dateTime(new Date(post.due_on), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              })}
            </span>
          )}
        </div>
        <h3 className="font-heading text-lg font-semibold">{post.title}</h3>
        <p className="text-xs text-muted-foreground">
          {post.author ? `${post.author.first_name} ${post.author.last_name}` : ""}
          {post.published_at
            ? ` · ${format.dateTime(new Date(post.published_at), { dateStyle: "medium" })}`
            : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {post.body_md && <Markdown>{post.body_md}</Markdown>}
        <MediaGrid items={post.media} canDelete={canManage} />
        {post.type === "homework" && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {students.map((student) => {
              const done = post.completions.some((c) => c.student_id === student.id);
              return (
                <form key={student.id} action={toggleHomeworkSeen}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="classId" value={post.class_id} />
                  <input type="hidden" name="done" value={String(done)} />
                  <Button
                    type="submit"
                    variant={done ? "secondary" : "outline"}
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
            {canManage && totalFamilies !== undefined && (
              <span className="text-xs text-muted-foreground">
                {t("seenBy", { count: post.completions.length })}
              </span>
            )}
          </div>
        )}
        {canManage && (
          <form action={deleteClassPost} className="self-end">
            <input type="hidden" name="postId" value={post.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2Icon aria-hidden />
              {t("post.delete")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
