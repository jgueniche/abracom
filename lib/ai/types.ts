import type { Lang } from "@/lib/practice/schema";

/** A piece of what the model reads: text, or a file (a photographed page, a PDF). */
export type PromptPart = { text: string } | { file: { mimeType: string; data: Buffer } };

export type SheetRequest = {
  system: string;
  parts: PromptPart[];
  /** The response format, a subset of JSON Schema. */
  schema: Record<string, unknown>;
};

/**
 * Whoever prepares a practice sheet (ADR-0087). Three calls, each independent: the exercises
 * are required, the picture and the voices are a bonus — a sheet without its illustration is
 * still a sheet, so those two answer null rather than throw.
 */
export interface PracticeProvider {
  readonly name: "vertex" | "fake";
  /** The model that wrote the exercises, stored with the sheet. */
  readonly textModel: string;
  /** The exercises, as JSON the caller still has to check (`parseSheet`). */
  writeSheet(request: SheetRequest): Promise<unknown>;
  /** One illustration for the top of the sheet; PNG/JPEG/WebP bytes, or null. */
  illustrate(prompt: string): Promise<Buffer | null>;
  /** A WAV recording of `text` read aloud in `lang`, or null. */
  speak(text: string, lang: Lang, style: "text" | "word"): Promise<Buffer | null>;
}

export class ProviderError extends Error {
  constructor(
    readonly code: "provider_error" | "timeout" | "blocked" | "empty",
    message: string,
  ) {
    super(message);
  }
}
