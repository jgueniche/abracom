import { ArrowRightIcon, PrinterIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { isBetaSubject, LEVEL_SLUGS } from "@/lib/practice/schema";

/**
 * What can be done with a homework, under its unfolded instruction (session 38): two small
 * buttons that say what they do — print it, get a few more exercises — and the way to its page.
 *
 * « Exercices en plus » goes straight to a sheet of the same level, which is prepared on arrival;
 * the page itself offers easier and harder. One button rather than three: the porteur asked for a
 * very simple wording, and the choice of level is better made in front of the sheet.
 */
export async function HomeworkActions({
  postId,
  subject,
  practice,
}: {
  postId: string;
  subject: string | null;
  /** Whether « S'entraîner » is offered for this homework and this reader (ADR-0087). */
  practice: boolean;
}) {
  const t = await getTranslations("diary");
  const button =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/devoirs/${postId}?imprimer=1`}
          className={`${button} border border-border bg-card text-foreground hover:bg-muted`}
        >
          <PrinterIcon aria-hidden className="size-4" />
          {t("print")}
        </Link>
        {practice && (
          <Link
            href={`/devoirs/${postId}/entrainement/${LEVEL_SLUGS.same}`}
            className={`${button} border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15`}
          >
            <SparklesIcon aria-hidden className="size-4" />
            {t("practice")}
            {isBetaSubject(subject) && (
              <Badge variant="secondary" className="ml-0.5">
                {t("beta")}
              </Badge>
            )}
          </Link>
        )}
      </div>
      {practice && <p className="mt-1.5 text-xs text-muted-foreground">{t("practiceHint")}</p>}
      <Link
        href={`/devoirs/${postId}`}
        className="mt-1 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-foreground/75 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("openPage")}
        <ArrowRightIcon aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
