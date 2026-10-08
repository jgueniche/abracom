/**
 * Where a family asks for its accounts (session 34). The school creates every
 * account itself — there is no sign-up — so the sign-in page names an address
 * and says what to write to it.
 */
export const REGISTRATION_EMAIL = "jeremy.gueniche@gmail.com";

/**
 * A `mailto:` link that opens a message already laid out (RFC 6068): what the
 * school needs to register a family is written in it, so nobody has to guess.
 * Line breaks are CRLF, the form mail clients expect in a `body`.
 */
export function registrationMailto(subject: string, body: string): string {
  const query = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`,
  ].join("&");
  return `mailto:${REGISTRATION_EMAIL}?${query}`;
}
