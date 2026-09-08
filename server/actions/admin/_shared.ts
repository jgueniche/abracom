import "server-only";

import { getTranslations } from "next-intl/server";

import { ForbiddenError } from "@/lib/permissions";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

export const idle: ActionState = { status: "idle" };

/** Turns thrown errors into a French message; `redirect()` errors pass through. */
export async function toActionError(error: unknown): Promise<ActionState> {
  if (isNextRedirect(error)) throw error;
  const t = await getTranslations("errors");
  if (error instanceof ForbiddenError)
    return { status: "error", message: t("forbidden.description") };
  console.error(
    "[action]",
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
  return { status: "error", message: t("unexpected.description") };
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function optional(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return value === "" ? null : value;
}
