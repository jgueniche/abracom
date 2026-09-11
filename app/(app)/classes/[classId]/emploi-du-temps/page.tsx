import { CalendarClockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
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
    <div className="flex flex-col gap-6">
      {slots.length === 0 ? (
        <EmptyState
          icon={CalendarClockIcon}
          title={t("empty")}
          description={canEdit ? t("emptyHintTeacher") : t("emptyHint")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {days.map((day) => {
            const ofDay = slots.filter((slot) => slot.weekday === day);
            return (
              <section key={day} className="rounded-xl border border-border bg-card p-4">
                <SectionHeader label={t(`days.${day}`)} count={ofDay.length || undefined} />
                {ofDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("nothing")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {ofDay.map((slot) => (
                      <li key={slot.id} className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {slot.starts_at.slice(0, 5)} – {slot.ends_at.slice(0, 5)}
                        </span>
                        <span className="font-medium">{slot.subject}</span>
                        {(slot.teacher_name || slot.room) && (
                          <span className="text-xs text-muted-foreground">
                            {[slot.teacher_name, slot.room].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {canEdit && (
                          <form action={deleteTimetableSlot} className="mt-1">
                            <input type="hidden" name="slotId" value={slot.id} />
                            <input type="hidden" name="classId" value={classId} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="-ml-2 min-h-11"
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
  );
}
