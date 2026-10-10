/**
 * The password the school gives with a new account (ADR-0075).
 *
 * It is read on a screen and typed on a phone, often by someone else, so it
 * avoids every character one misreads for another (l and 1, o and 0, i) and has
 * no capital to hunt for: twelve characters from thirty-one, about 59 bits, in
 * three groups of four. The person replaces it at their first sign-in.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** Bytes at or above this would favour the first letters of the alphabet: drawn again. */
const LIMIT = 256 - (256 % ALPHABET.length);

export function temporaryPassword(
  randomBytes: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  const chars: string[] = [];
  while (chars.length < 12) {
    for (const byte of randomBytes(16)) {
      if (byte >= LIMIT) continue;
      chars.push(ALPHABET[byte % ALPHABET.length]!);
      if (chars.length === 12) break;
    }
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}

/** What a person may choose instead: long enough to matter, short enough for bcrypt (72 bytes). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
