import { importTemplateCsv } from "@/lib/import/families";

/** Sample CSV (fictional data) for the families import. */
export function GET() {
  return new Response(importTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-familles.csv"',
      "Cache-Control": "no-store",
    },
  });
}
