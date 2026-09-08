import { describe, expect, it } from "vitest";

import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type Messages = Record<string, unknown>;

function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? flattenKeys(value as Messages, path)
      : [path];
  });
}

describe("i18n config", () => {
  it("defaults to French and recognises supported locales only", () => {
    expect(defaultLocale).toBe("fr");
    expect(locales).toEqual(["fr", "en"]);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("message catalogs", () => {
  it("expose exactly the same keys in fr.json and en.json", () => {
    const frKeys = flattenKeys(fr).sort();
    const enKeys = flattenKeys(en).sort();

    expect(enKeys).toEqual(frKeys);
  });

  it("contain no empty translation", () => {
    for (const catalog of [fr, en]) {
      const empty = flattenKeys(catalog).filter((path) => {
        const value = path.split(".").reduce<unknown>((acc, part) => {
          return acc !== null && typeof acc === "object" ? (acc as Messages)[part] : undefined;
        }, catalog);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
