/**
 * Reading the service account key that Vercel holds in `GOOGLE_SERVICE_ACCOUNT_KEY` (ADR-0087).
 *
 * Accepted: the JSON file as downloaded from Google Cloud, or the same encoded in base64 (one
 * line, easier to paste) — with or without quotes around it, in standard or URL-safe base64.
 * A pasted file can also arrive with real line breaks inside the private key, where the file
 * itself writes `\n`: those are put back.
 */

type ServiceAccountKey = { client_email: string; private_key: string };

export function parseServiceAccountKey(value: string): ServiceAccountKey | null {
  const json = keyText(value);
  if (json === null) return null;
  const key = parseJson(json);
  if (!key || typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    return null;
  }
  return { client_email: key.client_email, private_key: key.private_key };
}

/**
 * What the value looks like, for the logs, without a single character of the secret: its
 * length, how it starts, and — when it is JSON — which fields it has. Enough to tell an API key
 * (`AIza…`), a key ID or a truncated paste from the file that was asked for.
 */
export function describeKeyValue(value: string): string {
  const trimmed = unquote(value.trim());
  const json = keyText(value);
  const parsed = json === null ? null : parseJson(json);
  if (parsed) {
    const fields = Object.keys(parsed).sort().join(",");
    const type = typeof parsed.type === "string" ? parsed.type : "?";
    return `JSON (type=${type}; fields=${fields})`;
  }
  const shape = trimmed.startsWith("AIza")
    ? "looks like an API key (AIza…), not a service account JSON key"
    : trimmed.includes("PRIVATE KEY-----")
      ? "looks like the private key alone (PEM), not the whole JSON key file"
      : /^[0-9a-f]{40}$/i.test(trimmed)
        ? "looks like a key ID, not the key file"
        : trimmed.startsWith("{")
          ? "starts like JSON but does not parse (truncated paste?)"
          : json !== null
            ? "base64 of a JSON that does not parse (truncated copy?)"
            : "neither JSON nor base64 of JSON";
  return `${shape}; length=${trimmed.length} (a whole key file is ~2,300 characters, ~3,100 in base64)`;
}

function keyText(value: string): string | null {
  const trimmed = unquote(value.trim());
  if (trimmed.startsWith("{")) return trimmed;
  const decoded = Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    .toString("utf8")
    .trim();
  return decoded.startsWith("{") ? decoded : null;
}

function parseJson(text: string): Record<string, unknown> | null {
  for (const candidate of [text, escapeLineBreaksInStrings(text)]) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next form
    }
  }
  return null;
}

function unquote(value: string): string {
  const match = /^(["'])([\s\S]*)\1$/.exec(value);
  return match ? match[2]!.trim() : value;
}

/** Real line breaks inside JSON strings (the private key, pasted unescaped) become `\n`. */
function escapeLineBreaksInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString && (char === "\n" || char === "\r")) {
      if (char === "\n") out += "\\n";
      continue;
    }
    if (char === '"' && !escaped) inString = !inString;
    escaped = char === "\\" && !escaped;
    out += char;
  }
  return out;
}
