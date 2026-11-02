/**
 * What the voice is given to read (ADR-0087, corrected 2026-11-02): the text of the exercise,
 * and nothing else.
 *
 * Gemini-TTS takes a reading direction written before the text (« Read this aloud for a young
 * child: … »), and the first sheets carried one, in English. In production the model read the
 * direction aloud before a French poem — the child heard English instructions, then the poem.
 * A direction is a request, not a guarantee, so none is sent: the language comes from
 * `languageCode` alone, and the clip holds only words of the exercise, in its own language.
 */
export function spokenText(text: string): string {
  return text.trim();
}
