import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClassAccess } from "@/lib/auth/class-access";
import { localDateKey } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { canWriteInSchool } from "@/lib/permissions";
import { cancelAppointment, deleteAppointmentSlot } from "@/server/actions/community";
import { getAppointmentSlots, getClassAppointments } from "@/server/queries/community";

import { BookForm } from "./book-form";
import { SlotsForm } from "./slots-form";

type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  booked_by: string | null;
  parent_name: string | null;
  student_name: string | null;
};

export default async function AppointmentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const [{ user, cls, isTeacher, isStaff, myStudentIds }, t, format] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("community.appointments"),
    getFormatter(),
  ]);
  const teamView = isTeacher || isStaff;
  const slots: Slot[] = teamView
    ? (await getClassAppointments(classId)).map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        location: s.location,
        booked_by: s.booked_by,
        parent_name: s.parent_name,
        student_name: s.student_name,
      }))
    : (await getAppointmentSlots(classId)).map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        location: s.location,
        booked_by: s.booked_by,
        parent_name: null,
        student_name: null,
      }));
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.starts_at, TIME_ZONE);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  const myStudents = cls.students
    .filter((s) => myStudentIds.includes(s.id))
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));
  const canBook = !teamView && canWriteInSchool(user.roles, cls.school_id) && myStudents.length > 0;
  const time = (iso: string) => format.dateTime(new Date(iso), { timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      {teamView && (
        <Card>
          <CardHeader>
            <CardTitle>{t("create")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SlotsForm classId={classId} />
          </CardContent>
        </Card>
      )}
      {!teamView && !canBook && (
        <p className="text-sm text-muted-foreground">
          {myStudents.length === 0 ? t("noChild") : t("readOnly")}
        </p>
      )}
      {slots.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        [...days.entries()].map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 font-semibold capitalize">
              {format.dateTime(new Date(`${day}T12:00:00Z`), { dateStyle: "full" })}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {t("slots", { count: list.length })}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((slot) => {
                const mine = slot.booked_by === user.id;
                const booked = slot.booked_by !== null;
                return (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {time(slot.starts_at)} – {time(slot.ends_at)}
                      </span>
                      {slot.location && (
                        <span className="text-sm text-muted-foreground">{slot.location}</span>
                      )}
                      {mine ? (
                        <Badge>{t("mine")}</Badge>
                      ) : booked ? (
                        <Badge variant="secondary">
                          {t("booked")}
                          {slot.parent_name
                            ? ` · ${slot.parent_name}${slot.student_name ? ` (${slot.student_name})` : ""}`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("free")}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!booked && canBook && (
                        <BookForm classId={classId} slotId={slot.id} students={myStudents} />
                      )}
                      {booked && (mine || teamView) && (
                        <form action={cancelAppointment}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <input type="hidden" name="classId" value={classId} />
                          <Button type="submit" variant="outline" size="sm" className="min-h-11">
                            {t("cancel")}
                          </Button>
                        </form>
                      )}
                      {!booked && teamView && (
                        <form action={deleteAppointmentSlot}>
                          <input type="hidden" name="id" value={slot.id} />
                          <input type="hidden" name="classId" value={classId} />
                          <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                            {t("delete")}
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
