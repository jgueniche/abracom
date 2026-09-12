// @vitest-environment node
import { describe, expect, it } from "vitest";

import { type ReportCardData, renderReportCard } from "@/lib/pdf/report-card";

const data: ReportCardData = {
  appName: "Kesher",
  school: "École Démo (fictive)",
  student: { firstName: "Maya", lastName: "Démo", birthDate: "2023-03-14" },
  className: "PS Tournesols",
  levelLabel: "Petite section",
  teachers: ["Enseignant·e Démo"],
  periods: [
    {
      label: "Période 1",
      range: "1 sept. 2026 – 18 déc. 2026",
      domains: [
        {
          domain: "Mobiliser le langage",
          skills: [
            {
              label: "Écouter une histoire",
              level: "acquired",
              score: null,
              comment: null,
              published: true,
            },
            {
              label: "Reformuler",
              level: "in_progress",
              score: null,
              comment: "Beaux progrès.",
              published: true,
            },
          ],
        },
        {
          domain: "Kodesh",
          skills: [
            { label: "Berakhot", level: "mastered", score: null, comment: null, published: false },
          ],
        },
      ],
      remark: "Une rentrée réussie, Maya participe avec enthousiasme.",
      absences: { days: 1, lates: 2 },
      hasDraft: true,
    },
  ],
  generatedAt: "2026-09-08T10:00:00Z",
  labels: {
    title: "Livret de compétences",
    born: "Née le 14 mars 2023",
    classLabel: "Classe",
    teacher: "Enseignant·e",
    legend: "NA · EC · A · M",
    levels: {
      not_yet: "Non acquis",
      in_progress: "En cours",
      acquired: "Acquis",
      mastered: "Maîtrisé",
    },
    remark: "Appréciation",
    absences: "Absences",
    absencesText: (a) => `${a.days} jour(s) · ${a.lates} retard(s)`,
    none: "Aucune",
    draft: "Brouillon",
    noData: "Aucune évaluation",
    generatedOn: "Généré le 8 septembre 2026 par Kesher",
    confidentiality: "Document confidentiel",
  },
};

describe("report card PDF", () => {
  it("renders a PDF document for a fictional student", async () => {
    const buffer = await renderReportCard(data);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.toString("latin1")).toContain("/Type /Page");
  });

  it("renders an empty report card without periods", async () => {
    const buffer = await renderReportCard({ ...data, periods: [] });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
