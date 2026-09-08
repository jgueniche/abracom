/** Dynamic form schema stored in `forms.schema` (client-safe: no server imports). */
export type FormFieldType = "text" | "textarea" | "choice" | "multi" | "yesno" | "number" | "date";

export const FORM_FIELD_TYPES: FormFieldType[] = [
  "text",
  "textarea",
  "choice",
  "multi",
  "yesno",
  "number",
  "date",
];

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  options?: string[];
};

export function parseFormSchema(value: unknown): FormField[] {
  if (!value || typeof value !== "object") return [];
  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter(
      (f): f is FormField =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as FormField).id === "string" &&
        typeof (f as FormField).label === "string" &&
        FORM_FIELD_TYPES.includes((f as FormField).type),
    )
    .map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
}
