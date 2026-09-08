import { type NextRequest, NextResponse } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { appName } from "@/lib/env";
import { isGuideSlug, outlineGuide, readGuide } from "@/lib/guides";
import { renderGuide } from "@/lib/pdf/guide";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return new NextResponse(null, { status: 404 });
  await requireCurrentUser();
  const [markdown, t, format] = await Promise.all([
    readGuide(slug),
    getTranslations("help"),
    getFormatter(),
  ]);
  const outline = outlineGuide(markdown);
  const buffer = await renderGuide({
    appName,
    title: outline.title,
    sections: outline.sections,
    footer: t("pdfFooter", {
      app: appName,
      date: format.dateTime(new Date(), { dateStyle: "long" }),
    }),
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="guide-${slug}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
