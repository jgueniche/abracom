import { type NextRequest, NextResponse } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { appName } from "@/lib/env";
import { articlesFor, groupByTopic } from "@/lib/help/articles";
import { outlineArticle } from "@/lib/help/outline";
import { helpRolesFor } from "@/lib/help/roles";
import { renderGuide } from "@/lib/pdf/guide";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "My guide" — every article this reader sees, in the order of `/aide`.
 *
 * The PDF used to be one file per role, which only worked while the help was
 * three monolithic guides. Now that an article is cut by question, the printable
 * unit is the reader, not the file (ADR-0044): the roles are read from the
 * session, so there is nothing to put in the URL.
 */
export async function GET(_request: NextRequest) {
  const user = await requireCurrentUser();
  const roles = helpRolesFor(user.roles);
  const [articles, t, tTopics, tRoles, format] = await Promise.all([
    articlesFor(roles),
    getTranslations("help"),
    getTranslations("help.topics"),
    getTranslations("roles"),
    getFormatter(),
  ]);

  const buffer = await renderGuide({
    appName,
    title: t("pdfTitle"),
    subtitle: t("pdfSubtitle", { roles: roles.map((role) => tRoles(role)).join(" · ") }),
    topics: groupByTopic(articles).map((group) => ({
      heading: tTopics(group.topic),
      articles: group.articles.map((article) => ({
        title: article.title,
        blocks: outlineArticle(article.body),
      })),
    })),
    footer: t("pdfFooter", {
      app: appName,
      date: format.dateTime(new Date(), { dateStyle: "long" }),
    }),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="guide-kesher.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
