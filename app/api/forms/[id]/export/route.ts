import { type NextRequest, NextResponse } from "next/server";

import { requireSchoolStaff } from "@/lib/auth/guards";
import { getForm, getFormResponses } from "@/server/queries/community";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cell(value: unknown): string {
  const text =
    value === true
      ? "oui"
      : value === false
        ? "non"
        : Array.isArray(value)
          ? value.join(" | ")
          : value == null
            ? ""
            : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV export of a form's responses (staff only; RLS hides other schools). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  await requireSchoolStaff();
  const [form, responses] = await Promise.all([getForm(id), getFormResponses(id)]);
  if (!form) return new NextResponse(null, { status: 404 });
  const header = ["repondant", "enfant", "envoye_le", ...form.fields.map((f) => f.label)];
  const lines = responses.map((r) => {
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    return [
      r.user ? `${r.user.first_name} ${r.user.last_name}` : "",
      r.student ? `${r.student.first_name} ${r.student.last_name}` : "",
      r.submitted_at,
      ...form.fields.map((f) => answers[f.id]),
    ]
      .map(cell)
      .join(";");
  });
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="formulaire-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
