import { CalendarClockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { deleteTimetableSlot } from "@/server/actions/timetable";
import { getClassWeek } from "@/server/queries/timetable";

import { SlotForm } from "./slot-form";

/** School days, in the order a French week is read. Sunday only if used. */
const WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * The weekly grid — one of the three reasons a family kept Educartable open.
 *
 * Read as a list of days rather than a cross-tab: on a 390 px screen an hour ×
 * day matrix is unreadable, and even on a desktop a class week is short enough
 * that days in columns say everything.
 */
export default async function TimetablePage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [{ cls, isTeacher, isStaff }, t] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("timetable"),
  ]);
  const slots = await getClassWeek(classId);
  const canEdit = isTeacher || isStaff;
  const used = WEEK.filter((day) => slots.some((slot) => slot.weekday === day));
  const days = used.length > 0 ? used : ([1, 2, 4, 5] as const);

  return (
    <Column>
      <div className="flex flex-col gap-6">
        {slots.length === 0 ? (
          <EmptyState
            icon={CalendarClockIcon}
            title={t("empty")}
            description={canEdit ? t("emptyHintTeacher") : t("emptyHint")}
          />
        ) : (
          // The days side by side, each a column under its name — five framed panels were five more
          // rectangles around what is a plain week (ADR-0078).
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {days.map((day) => {
              const ofDay = slots.filter((slot) => slot.weekday === day);
              return (
                <section key={day}>
                  <SectionHeader label={t(`days.${day}`)} count={ofDay.length || undefined} />
                  {ofDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("nothing")}</p>
                  ) : (
                    // The hours are the left edge of every slot — what the avatar is to a
                    // conversation in Messages — and the way to remove one stays on its line
                    // instead of adding a third (ADR-0078).
                    <ul className="flex flex-col gap-3">
                      {ofDay.map((slot) => (
                        <li key={slot.id} className="flex items-start gap-3">
                          <span className="flex w-11 shrink-0 flex-col pt-0.5 text-xs leading-tight text-muted-foreground tabular-nums">
                            <span>{slot.starts_at.slice(0, 5)}</span>
                            <span>{slot.ends_at.slice(0, 5)}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">{slot.subject}</span>
                            {(slot.teacher_name || slot.room) && (
                              <span className="text-xs text-muted-foreground">
                                {[slot.teacher_name, slot.room].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                          {canEdit && (
                            <form action={deleteTimetableSlot} className="-my-2 shrink-0">
                              <input type="hidden" name="slotId" value={slot.id} />
                              <input type="hidden" name="classId" value={classId} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="-mr-2 min-h-11 text-muted-foreground"
                              >
                                {t("remove")}
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>{t("addTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SlotForm
                classId={classId}
                teachers={cls.class_teachers
                  .filter((ct) => ct.profile)
                  .map((ct) => ({
                    id: ct.profile!.id,
                    name: `${ct.profile!.first_name} ${ct.profile!.last_name}`,
                  }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Column>
  );
}
