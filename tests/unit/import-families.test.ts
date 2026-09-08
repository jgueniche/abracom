import { describe, expect, it } from "vitest";

import { detectDelimiter, normaliseHeader, parseCsv, toCsv } from "@/lib/import/csv";
import {
  importTemplateCsv,
  normalisePhone,
  normaliseRelation,
  parseBirthDate,
  parseFamiliesCsv,
} from "@/lib/import/families";

describe("csv parser", () => {
  it("detects the delimiter and strips the BOM", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a\tb")).toBe("\t");
    expect(parseCsv("﻿a;b\n1;2\n").headers).toEqual(["a", "b"]);
  });

  it("handles quotes, escaped quotes and newlines inside quotes", () => {
    const table = parseCsv('nom;note\r\n"Cohen, Léa";"dit ""bonjour""\net merci"\r\n');
    expect(table.rows).toEqual([{ nom: "Cohen, Léa", note: 'dit "bonjour"\net merci' }]);
  });

  it("normalises headers (accents, case, spaces)", () => {
    expect(normaliseHeader(" Élève Prénom ")).toBe("eleve_prenom");
    expect(normaliseHeader("Parent 1 - Email")).toBe("parent_1_email");
  });

  it("round-trips through toCsv", () => {
    const csv = toCsv(["a", "b"], [["x;y", 'q"uote']]);
    expect(parseCsv(csv).rows).toEqual([{ a: "x;y", b: 'q"uote' }]);
  });
});

describe("field normalisation", () => {
  it("parses French and ISO birth dates and rejects impossible ones", () => {
    expect(parseBirthDate("14/03/2021")).toBe("2021-03-14");
    expect(parseBirthDate("2021-03-14")).toBe("2021-03-14");
    expect(parseBirthDate("14.03.2021")).toBe("2021-03-14");
    expect(parseBirthDate("31/02/2021")).toBeNull();
    expect(parseBirthDate("hier")).toBeNull();
    expect(parseBirthDate("")).toBeNull();
  });

  it("normalises phone numbers to E.164", () => {
    expect(normalisePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalisePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalisePhone("0033612345678")).toBe("+33612345678");
    expect(normalisePhone("12")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });

  it("maps relation labels", () => {
    expect(normaliseRelation("Mère", "other")).toBe("mother");
    expect(normaliseRelation("papa", "other")).toBe("father");
    expect(normaliseRelation("", "father")).toBe("father");
    expect(normaliseRelation("???", "guardian")).toBe("guardian");
  });
});

describe("parseFamiliesCsv", () => {
  it("accepts the template and derives classes, e-mails and families", () => {
    const preview = parseFamiliesCsv(importTemplateCsv());
    expect(preview.issues).toEqual([]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.classNames).toEqual(["PS Tournesols", "CP Oliviers"]);
    expect(preview.emails).toEqual([
      "sarah.exemple@exemple.fr",
      "david.exemple@exemple.fr",
      "emily.sample@example.com",
    ]);
    expect(preview.rows[0]!.guardians[0]).toMatchObject({
      relation: "mother",
      phone: "+33612345678",
    });
    expect(preview.rows[0]!.familyName).toBe("Famille Exemple");
    expect(preview.rows[1]!.locale).toBe("en");
    expect(preview.rows[1]!.guardians).toHaveLength(1);
  });

  it("reports missing required columns once", () => {
    const preview = parseFamiliesCsv("prenom;nom\nA;B\n");
    expect(preview.rows).toEqual([]);
    expect(preview.issues[0]!.message).toContain("Colonnes manquantes");
  });

  it("attaches problems to their line and keeps the valid rows", () => {
    const csv = [
      "eleve_prenom;eleve_nom;eleve_date_naissance;classe;parent1_email;parent2_email",
      "Eden;Cohen;2022-04-12;PS Tournesols;sarah@exemple.fr;",
      ";Levy;2021-13-40;MS Bleuets;pas-un-email;",
      "Eden;Cohen;2022-04-12;PS Tournesols;sarah@exemple.fr;sarah@exemple.fr",
    ].join("\n");
    const preview = parseFamiliesCsv(csv);
    expect(preview.rows).toHaveLength(1);
    const lines = preview.issues.map((i) => i.line);
    expect(lines).toContain(3);
    expect(lines).toContain(4);
    expect(preview.issues.map((i) => i.column)).toEqual(
      expect.arrayContaining([
        "eleve_prenom",
        "eleve_date_naissance",
        "parent1_email",
        "parent2_email",
        "eleve_nom",
      ]),
    );
  });

  it("accepts French aliases and comma delimiters", () => {
    const csv =
      "Prénom élève,Nom élève,Classe,Mère email,Père email\nNoa,Dahan,GS Lavandes,a@b.fr,c@d.fr\n";
    const preview = parseFamiliesCsv(csv);
    expect(preview.issues).toEqual([]);
    expect(preview.rows[0]!.guardians.map((g) => g.relation)).toEqual(["mother", "father"]);
  });
});
