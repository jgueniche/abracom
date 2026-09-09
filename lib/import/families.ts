import { z } from "zod";

import { parseCsv } from "./csv";

/**
 * Family import (brief §7.1): one row per student, up to two parents.
 * Column names are normalised (see normaliseHeader); French aliases are accepted.
 */
export const IMPORT_COLUMNS = [
  "eleve_prenom",
  "eleve_nom",
  "eleve_date_naissance",
  "classe",
  "famille",
  "parent1_prenom",
  "parent1_nom",
  "parent1_email",
  "parent1_telephone",
  "parent1_lien",
  "parent2_prenom",
  "parent2_nom",
  "parent2_email",
  "parent2_telephone",
  "parent2_lien",
  "langue",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const ALIASES: Record<string, ImportColumn> = {
  prenom_eleve: "eleve_prenom",
  nom_eleve: "eleve_nom",
  date_de_naissance: "eleve_date_naissance",
  date_naissance: "eleve_date_naissance",
  naissance: "eleve_date_naissance",
  class: "classe",
  family: "famille",
  parent_1_prenom: "parent1_prenom",
  parent_1_nom: "parent1_nom",
  parent_1_email: "parent1_email",
  parent_1_telephone: "parent1_telephone",
  parent_1_lien: "parent1_lien",
  parent_2_prenom: "parent2_prenom",
  parent_2_nom: "parent2_nom",
  parent_2_email: "parent2_email",
  parent_2_telephone: "parent2_telephone",
  parent_2_lien: "parent2_lien",
  mere_prenom: "parent1_prenom",
  mere_nom: "parent1_nom",
  mere_email: "parent1_email",
  mere_telephone: "parent1_telephone",
  pere_prenom: "parent2_prenom",
  pere_nom: "parent2_nom",
  pere_email: "parent2_email",
  pere_telephone: "parent2_telephone",
  language: "langue",
  locale: "langue",
};

export const RELATIONS = ["mother", "father", "guardian", "other"] as const;
export type Relation = (typeof RELATIONS)[number];

const RELATION_ALIASES: Record<string, Relation> = {
  mere: "mother",
  mother: "mother",
  maman: "mother",
  pere: "father",
  father: "father",
  papa: "father",
  responsable: "guardian",
  guardian: "guardian",
  tuteur: "guardian",
  tutrice: "guardian",
  autre: "other",
  other: "other",
};

export function normaliseRelation(value: string, fallback: Relation): Relation {
  const key = value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (key === "") return fallback;
  return RELATION_ALIASES[key] ?? fallback;
}

/** Accepts 2021-03-14, 14/03/2021, 14-03-2021, 14.03.2021 → ISO date, or null when invalid. */
export function parseBirthDate(value: string): string | null {
  const v = value.trim();
  if (v === "") return null;
  let year: number, month: number, day: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function normalisePhone(value: string): string | null {
  const v = value.replace(/[\s.()-]/g, "");
  if (v === "") return null;
  if (/^0\d{9}$/.test(v)) return `+33${v.slice(1)}`;
  if (/^\+\d{8,15}$/.test(v)) return v;
  if (/^00\d{8,15}$/.test(v)) return `+${v.slice(2)}`;
  return null;
}

const guardianSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.email().max(254),
  phone: z.string().nullable(),
  relation: z.enum(RELATIONS),
});

export type ImportGuardian = z.infer<typeof guardianSchema>;

export type ImportRow = {
  line: number;
  student: { firstName: string; lastName: string; birthDate: string | null };
  className: string;
  familyName: string;
  locale: "fr" | "en";
  guardians: ImportGuardian[];
};

export type ImportIssue = { line: number; column?: string; message: string };

export type ImportPreview = {
  rows: ImportRow[];
  issues: ImportIssue[];
  /** Distinct class names referenced by the file. */
  classNames: string[];
  /** Distinct guardian e-mails (one account each). */
  emails: string[];
};

function remapHeaders(row: Record<string, string>): Partial<Record<ImportColumn, string>> {
  const out: Partial<Record<ImportColumn, string>> = {};
  for (const [key, value] of Object.entries(row)) {
    const column = (IMPORT_COLUMNS as readonly string[]).includes(key)
      ? (key as ImportColumn)
      : ALIASES[key];
    if (column) out[column] = value;
  }
  return out;
}

/**
 * Parses and validates a families CSV. Never throws: every problem becomes an issue
 * attached to its line so the direction can fix the file and retry.
 */
export function parseFamiliesCsv(input: string): ImportPreview {
  const table = parseCsv(input);
  const issues: ImportIssue[] = [];
  const rows: ImportRow[] = [];
  const seenStudents = new Set<string>();

  const required: ImportColumn[] = ["eleve_prenom", "eleve_nom", "classe", "parent1_email"];
  const known = new Set(table.headers.map((h) => (ALIASES[h] ?? h) as string));
  const missingColumns = required.filter((c) => !known.has(c));
  if (missingColumns.length > 0) {
    issues.push({ line: 1, message: `Colonnes manquantes : ${missingColumns.join(", ")}` });
    return { rows, issues, classNames: [], emails: [] };
  }

  table.rows.forEach((raw, index) => {
    const line = index + 2; // 1-based, after the header
    const r = remapHeaders(raw);
    const rowIssues: ImportIssue[] = [];

    const firstName = (r.eleve_prenom ?? "").trim();
    const lastName = (r.eleve_nom ?? "").trim();
    const className = (r.classe ?? "").trim();
    if (!firstName)
      rowIssues.push({ line, column: "eleve_prenom", message: "Prénom de l'élève manquant" });
    if (!lastName)
      rowIssues.push({ line, column: "eleve_nom", message: "Nom de l'élève manquant" });
    if (!className) rowIssues.push({ line, column: "classe", message: "Classe manquante" });

    const birthRaw = (r.eleve_date_naissance ?? "").trim();
    const birthDate = parseBirthDate(birthRaw);
    if (birthRaw && !birthDate) {
      rowIssues.push({
        line,
        column: "eleve_date_naissance",
        message: `Date de naissance invalide : ${birthRaw}`,
      });
    }

    const localeRaw = (r.langue ?? "fr").trim().toLowerCase();
    const locale = localeRaw === "en" ? "en" : "fr";
    if (localeRaw && !["fr", "en"].includes(localeRaw)) {
      rowIssues.push({
        line,
        column: "langue",
        message: `Langue inconnue : ${localeRaw} (fr ou en)`,
      });
    }

    const guardians: ImportGuardian[] = [];
    for (const [prefix, fallbackRelation] of [
      ["parent1", "mother"],
      ["parent2", "father"],
    ] as const) {
      const email = (r[`${prefix}_email`] ?? "").trim().toLowerCase();
      const gFirst = (r[`${prefix}_prenom`] ?? "").trim();
      const gLast = (r[`${prefix}_nom`] ?? "").trim() || lastName;
      const phoneRaw = (r[`${prefix}_telephone`] ?? "").trim();
      if (!email && !gFirst && !phoneRaw) {
        if (prefix === "parent1")
          rowIssues.push({ line, column: "parent1_email", message: "E-mail du parent 1 manquant" });
        continue;
      }
      const phone = normalisePhone(phoneRaw);
      if (phoneRaw && !phone) {
        rowIssues.push({
          line,
          column: `${prefix}_telephone`,
          message: `Téléphone invalide : ${phoneRaw}`,
        });
      }
      const parsed = guardianSchema.safeParse({
        firstName: gFirst || "Parent",
        lastName: gLast,
        email,
        phone,
        relation: normaliseRelation(r[`${prefix}_lien`] ?? "", fallbackRelation),
      });
      if (!parsed.success) {
        rowIssues.push({
          line,
          column: `${prefix}_email`,
          message: `E-mail invalide pour ${prefix} : ${email || "(vide)"}`,
        });
        continue;
      }
      guardians.push(parsed.data);
    }
    if (guardians.length === 2 && guardians[0]!.email === guardians[1]!.email) {
      rowIssues.push({
        line,
        column: "parent2_email",
        message: "Les deux parents ont la même adresse e-mail",
      });
    }

    const studentKey = `${firstName}|${lastName}|${birthDate ?? ""}`.toLowerCase();
    if (seenStudents.has(studentKey)) {
      rowIssues.push({
        line,
        column: "eleve_nom",
        message: `Élève en double : ${firstName} ${lastName}`,
      });
    }
    seenStudents.add(studentKey);

    issues.push(...rowIssues);
    if (rowIssues.length === 0) {
      rows.push({
        line,
        student: { firstName, lastName, birthDate },
        className,
        familyName: (r.famille ?? "").trim() || `Famille ${guardians[0]?.lastName ?? lastName}`,
        locale,
        guardians,
      });
    }
  });

  return {
    rows,
    issues,
    classNames: [...new Set(rows.map((r) => r.className))],
    emails: [...new Set(rows.flatMap((r) => r.guardians.map((g) => g.email)))],
  };
}

/** Sample file offered for download (fictional data). */
export function importTemplateCsv(): string {
  const headers = [...IMPORT_COLUMNS];
  const rows = [
    [
      "Eden",
      "Exemple",
      "2022-04-12",
      "PS Tournesols",
      "",
      "Sarah",
      "Exemple",
      "sarah.exemple@exemple.fr",
      "06 12 34 56 78",
      "mère",
      "David",
      "Exemple",
      "david.exemple@exemple.fr",
      "",
      "père",
      "fr",
    ],
    [
      "Liam",
      "Sample",
      "2020-09-03",
      "CP Oliviers",
      "",
      "Emily",
      "Sample",
      "emily.sample@example.com",
      "+33 6 98 76 54 32",
      "mother",
      "",
      "",
      "",
      "",
      "",
      "en",
    ],
  ];
  const escape = (v: string) => (/[";,\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [headers, ...rows].map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}
