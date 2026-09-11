import { CheckIcon, MessageSquareTextIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { SectionHeader } from "@/components/layouts/section-header";
import { Markdown } from "@/components/domain/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { markNoteRead } from "@/server/actions/individual-notes";
import { getIndividualNotesForStudents } from "@/server/queries/class-space";

import { NoteForm } from "./note-form";
import { PraiseRow } from "./praise-row";

export default async function NotesPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ user, cls, isTeacher, isStaff, myStudentIds }, t, format] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace.notes"),
    getFormatter(),
  ]);
  const canWrite = isTeacher || isStaff;
  const targets = canWrite ? cls.students : cls.students.filter((s) => myStudentIds.includes(s.id));
  const notes = await getIndividualNotesForStudents(targets.map((s) => s.id));
  const notesByStudent = targets.map((s) => ({ student: s, notes: notes.get(s.id) ?? [] }));
  const total = notesByStudent.reduce((n, s) => n + s.notes.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {canWrite && (
        <PraiseRow
          classId={classId}
          students={cls.students.map((s) => ({
            id: s.id,
            firstName: s.first_name,
            lastName: s.last_name,
          }))}
        />
      )}
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm
              classId={classId}
              students={cls.students.map((s) => ({
                id: s.id,
                name: `${s.first_name} ${s.last_name}`,
              }))}
            />
          </CardContent>
        </Card>
      )}
      {total === 0 && (
        <EmptyState
          icon={MessageSquareTextIcon}
          title={t("empty")}
          description={canWrite ? t("emptyHintTeacher") : t("emptyHint")}
        />
      )}
      {notesByStudent
        .filter((s) => s.notes.length > 0)
        .map(({ student, notes }) => (
          <section key={student.id} className="flex flex-col">
            <SectionHeader label={`${student.first_name} ${student.last_name}`} />
            {notes.map((note) => {
              const mine = note.reads.find((r) => r.user_id === user.id);
              return (
                <Card key={note.id}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          note.kind === "concern"
                            ? "destructive"
                            : note.kind === "praise"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {t(`kinds.${note.kind}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {note.author
                          ? t("from", {
                              name: `${note.author.first_name} ${note.author.last_name}`,
                            })
                          : ""}{" "}
                        · {format.dateTime(new Date(note.created_at), { dateStyle: "medium" })}
                      </span>
                      {canWrite && (
                        <span className="text-xs text-muted-foreground">
                          · {t("readBy", { count: note.reads.length })}
                        </span>
                      )}
                    </div>
                    <Markdown>{note.body_md}</Markdown>
                    {!canWrite &&
                      (mine ? (
                        <Badge variant="outline" className="w-fit">
                          <CheckIcon aria-hidden />
                          {t("readOn", {
                            date: format.dateTime(new Date(mine.read_at), { dateStyle: "medium" }),
                          })}
                        </Badge>
                      ) : (
                        <form action={markNoteRead}>
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="classId" value={classId} />
                          <Button type="submit" size="sm" className="min-h-11">
                            <CheckIcon aria-hidden />
                            {t("read")}
                          </Button>
                        </form>
                      ))}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))}
    </div>
  );
}
