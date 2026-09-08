/**
 * Minimal RFC 4180 parser: quoted fields, escaped quotes, newlines inside quotes,
 * `;` / `,` / tab auto-detection, UTF-8 BOM. Header names are normalised
 * (lower-case, accents stripped, spaces → underscores).
 */
export type CsvTable = { headers: string[]; rows: Record<string, string>[]; delimiter: string };

export function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function normaliseHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^﻿/, "");
  const firstLineEnd = text.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd === -1 ? text : text.slice(0, firstLineEnd));

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  const [headerRow = [], ...dataRows] = nonEmpty;
  const headers = headerRow.map(normaliseHeader);
  const rows = dataRows.map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { headers, rows, delimiter };
}

/** A cell that a spreadsheet would evaluate as a formula gets a leading apostrophe. */
export function neutraliseCell(value: string): string {
  return /^[=@\t\r]|^[+-](?!\d)/.test(value) ? `'${value}` : value;
}

/** Serialises rows back to CSV (used for the template download and error reports). */
export function toCsv(headers: string[], rows: string[][], delimiter = ";"): string {
  const escape = (raw: string) => {
    const value = neutraliseCell(raw);
    return /[";,\t\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(delimiter)).join("\r\n") + "\r\n";
}
