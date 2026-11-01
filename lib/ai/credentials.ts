/** The JSON key as downloaded, or the same base64-encoded (one line, easier in Vercel). */
export function parseServiceAccountKey(
  value: string,
): { client_email: string; private_key: string } | null {
  const text = value.trimStart().startsWith("{")
    ? value
    : Buffer.from(value, "base64").toString("utf8");
  try {
    const key = JSON.parse(text) as { client_email?: unknown; private_key?: unknown };
    if (typeof key.client_email !== "string" || typeof key.private_key !== "string") return null;
    return { client_email: key.client_email, private_key: key.private_key };
  } catch {
    return null;
  }
}
