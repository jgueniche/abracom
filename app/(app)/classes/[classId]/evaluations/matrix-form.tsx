"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type SaveAssessmentsState, saveAssessments } from "@/server/actions/assessments";
import { ASSESSMENT_LEVELS, type AssessmentLevel } from "@/lib/assessments";

export type MatrixCell = {
  level: AssessmentLevel | null;
  score: number | null;
  published: boolean;
};

const TINT: Record<AssessmentLevel, string> = {
  not_yet: "bg-destructive/15",
  in_progress: "bg-amber-500/20",
  acquired: "bg-primary/15",
  mastered: "bg-primary/35",
};

const initialState: SaveAssessmentsState = { status: "idle" };

function LevelSelect({
  name,
  initial,
  published,
  labels,
}: {
  name: string;
  initial: AssessmentLevel | null;
  published: boolean;
  labels: Record<AssessmentLevel, string>;
}) {
  const [value, setValue] = useState<AssessmentLevel | "">(initial ?? "");
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value as AssessmentLevel | "")}
      className={cn(
        "h-10 w-16 rounded-md border border-input text-center text-xs font-semibold",
        value ? TINT[value] : "bg-background",
        published && "ring-1 ring-primary/40",
      )}
      title={published ? "✓" : undefined}
    >
      <option value="">—</option>
      {ASSESSMENT_LEVELS.map((level) => (
        <option key={level} value={level}>
          {labels[level]}
        </option>
      ))}
    </select>
  );
}

/** `"Mobiliser le langage · Comprendre les consignes"` under the domain
 * `"Mobiliser le langage"` is just `"Comprendre les consignes"`. */
function withoutDomain(label: string, domain: string): string {
  const prefix = `${domain} · `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

export function MatrixForm({
  classId,
  periodId,
  students,
  domains,
  cells,
  remarks,
  scoresEnabled,
}: {
  classId: string;
  periodId: string;
  students: Array<{ id: string; name: string }>;
  domains: Array<{ domain: string; skills: Array<{ id: string; label: string; code: string }> }>;
  cells: Record<string, MatrixCell>;
  remarks: Record<string, string>;
  scoresEnabled: boolean;
}) {
  const t = useTranslations("assessments");
  const [state, action] = useActionState(saveAssessments, initialState);
  const shortLabels = {
    not_yet: t("short.not_yet"),
    in_progress: t("short.in_progress"),
    acquired: t("short.acquired"),
    mastered: t("short.mastered"),
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="periodId" value={periodId} />
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background p-2 text-left font-medium">
                {t("student")}
              </th>
              {domains.map((group) => (
                <th
                  key={group.domain}
                  colSpan={group.skills.length}
                  className="border-b px-2 py-1 text-left text-xs font-medium text-muted-foreground"
                >
                  {group.domain}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-background p-2" />
              {domains.flatMap((group) =>
                group.skills.map((skill) => (
                  <th
                    key={skill.id}
                    scope="col"
                    className="max-w-24 px-1 pb-2 text-left align-bottom text-[11px] leading-tight font-normal"
                    title={skill.label}
                  >
                    {/* The domain is already the header spanning these columns.
                        A catalogue that repeats it in every label — the seed did,
                        and an imported one may — left three columns all reading
                        "Mobiliser le langage · …" with the only distinguishing
                        words cut off. The full label stays in the tooltip. */}
                    <span className="line-clamp-3">{withoutDomain(skill.label, group.domain)}</span>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background p-2 text-left font-medium whitespace-nowrap"
                >
                  {student.name}
                </th>
                {domains.flatMap((group) =>
                  group.skills.map((skill) => {
                    const cell = cells[`${student.id}:${skill.id}`];
                    return (
                      <td key={skill.id} className="p-1 align-top">
                        <LevelSelect
                          name={`cell:${student.id}:${skill.id}`}
                          initial={cell?.level ?? null}
                          published={cell?.published ?? false}
                          labels={shortLabels}
                        />
                        {scoresEnabled && (
                          <input
                            type="number"
                            name={`score:${student.id}:${skill.id}`}
                            min={0}
                            max={20}
                            step={0.5}
                            defaultValue={cell?.score ?? ""}
                            aria-label={t("score")}
                            className="mt-1 h-9 w-16 rounded-md border border-input px-1 text-center text-xs"
                          />
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("legend")}</p>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">{t("remarks")}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {students.map((student) => (
            <label key={student.id} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{student.name}</span>
              <Textarea
                name={`remark:${student.id}`}
                defaultValue={remarks[student.id] ?? ""}
                placeholder={t("remarkPlaceholder")}
                rows={3}
                maxLength={2000}
              />
            </label>
          ))}
        </div>
      </details>

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("save")}</SubmitButton>
    </form>
  );
}
