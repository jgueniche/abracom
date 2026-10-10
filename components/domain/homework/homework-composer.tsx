import { localDateKey } from "@/lib/calendar/dates";
import { SCHOOL_TIME_ZONE, suggestedSubjects, upcomingSchoolDays } from "@/lib/homework";
import { attachmentViews } from "@/server/queries/attachments";
import { getHomeworkComposerContext } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";

import { HomeworkForm } from "./homework-form";

type ExistingHomework = {
  id: string;
  title: string;
  body_md: string | null;
  subject: string | null;
  due_on: string | null;
  visibility: "parents" | "staff";
  published_at: string | null;
  media: Parameters<typeof attachmentViews>[0][number][];
};

/** Everything the homework form suggests, read once: the coming days, the subjects, the classes. */
export async function HomeworkComposer({
  classId,
  schoolId,
  userId,
  returnTo,
  existing,
}: {
  classId: string;
  schoolId: string;
  userId: string;
  returnTo: "devoirs" | "classe";
  existing?: ExistingHomework;
}) {
  const today = localDateKey(new Date(), SCHOOL_TIME_ZONE);
  const [context, teaching, media] = await Promise.all([
    getHomeworkComposerContext(classId),
    existing ? Promise.resolve([]) : getMyTeachingClasses(userId),
    existing ? attachmentViews(existing.media) : Promise.resolve(new Map()),
  ]);
  return (
    <HomeworkForm
      classId={classId}
      schoolId={schoolId}
      // Chosen here for a new homework, so its pages have a folder before the homework exists.
      postId={existing?.id ?? globalThis.crypto.randomUUID()}
      today={today}
      days={upcomingSchoolDays(today, 5)}
      slots={context.slots}
      subjects={suggestedSubjects(context.slots, context.usedSubjects)}
      otherClasses={teaching.flatMap((row) =>
        row.class && row.class.id !== classId ? [{ id: row.class.id, name: row.class.name }] : [],
      )}
      returnTo={returnTo}
      existing={
        existing
          ? {
              title: existing.title,
              bodyMd: existing.body_md ?? "",
              subject: existing.subject,
              dueOn: existing.due_on,
              visibility: existing.visibility,
              published: existing.published_at !== null,
              media: existing.media.flatMap((item) => {
                const view = media.get(item.id);
                return view ? [view] : [];
              }),
            }
          : undefined
      }
    />
  );
}
