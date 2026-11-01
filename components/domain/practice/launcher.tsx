import { SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { LEVEL_SLUGS, PRACTICE_LEVELS, isBetaSubject } from "@/lib/practice/schema";
import type { PracticeState } from "@/server/queries/practice";

import { ClassPracticeSwitch } from "./team-controls";

/**
 * « S'entraîner » on the homework page (ADR-0087): three doors, one per difficulty. A block
 * one acts on, so it is tinted (ADR-0080). The team sees the class switch with it, and sees
 * the block even when the class is closed — to open it again; a family of a closed class sees
 * nothing.
 */
export async function PracticeLauncher({
  homework,
  state,
  team,
}: {
  homework: { id: string; class_id: string; subject: string | null };
  state: PracticeState;
  team: boolean;
}) {
  const t = await getTranslations("practice");
  if (!state.installed) return null;
  if (!state.offered && !team) return null;

  if (!state.offered) {
    return (
      <section id="entrainement" className="no-print mb-7 rounded-lg bg-muted px-5 py-4">
        <h2 className="section-label mb-1">{t("launcher.label")}</h2>
        <p className="text-sm text-muted-foreground">{t("launcher.closedTeam")}</p>
        {!state.classEnabled && (
          <div className="mt-2 -ml-3">
            <ClassPracticeSwitch
              classId={homework.class_id}
              postId={homework.id}
              enabled={false}
              label={t("launcher.reopen")}
            />
          </div>
        )}
      </section>
    );
  }

  const beta = isBetaSubject(homework.subject);
  return (
    <section
      id="entrainement"
      aria-labelledby="entrainement-titre"
      className="no-print mb-7 scroll-mt-24 rounded-lg bg-muted px-5 py-4"
    >
      <div className="flex items-center gap-2">
        <SparklesIcon aria-hidden className="size-4 text-primary" />
        <h2 id="entrainement-titre" className="section-label">
          {t("launcher.label")}
        </h2>
        {beta && <Badge variant="secondary">{t("launcher.beta")}</Badge>}
      </div>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">
        {beta ? t("launcher.betaHint") : t("launcher.hint")}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {PRACTICE_LEVELS.map((level) => {
          const ready = state.sheets.some(
            (sheet) => sheet.level === level && sheet.status === "ready",
          );
          return (
            <li key={level}>
              <Link
                href={`/devoirs/${homework.id}/entrainement/${LEVEL_SLUGS[level]}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t(`levels.${level}`)}
                {ready && <span className="meta font-normal">· {t("launcher.ready")}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {team && (
        <div className="mt-2 -ml-3 flex flex-wrap items-center gap-2">
          <ClassPracticeSwitch
            classId={homework.class_id}
            postId={homework.id}
            enabled
            label={t("launcher.close")}
          />
        </div>
      )}
    </section>
  );
}
