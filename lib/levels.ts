/** Level labels are stored in both languages; pick the one of the current locale. */
export function levelLabel(
  level: { label_fr: string; label_en: string } | null | undefined,
  locale: string,
): string {
  if (!level) return "";
  return locale === "en" ? level.label_en : level.label_fr;
}
