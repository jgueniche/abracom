import { PartyPopperIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendPraise } from "@/server/actions/individual-notes";

/**
 * One tap per pupil. The row exists so that praise costs a single gesture,
 * where the form below costs four decisions.
 */
export async function PraiseRow({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; firstName: string; lastName: string }[];
}) {
  const t = await getTranslations("classSpace.notes");
  if (students.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopperIcon className="size-5 text-primary" aria-hidden />
          {t("praiseTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* The exact sentence that will be sent, shown before it is sent. */}
        <p className="text-sm text-muted-foreground">
          {t("praiseHint", { sentence: t("praiseBody") })}
        </p>
        <div className="flex flex-wrap gap-2">
          {students.map((student) => (
            <form key={student.id} action={sendPraise}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="classId" value={classId} />
              <Button type="submit" variant="outline" size="sm" className="min-h-11">
                {student.firstName}
                <span className="text-sm text-muted-foreground">{student.lastName.charAt(0)}.</span>
              </Button>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
