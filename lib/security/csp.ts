/**
 * Strict, nonce-based Content Security Policy (brief §9). Built per request by the middleware:
 * Next.js reads the nonce from the request header and stamps its own inline scripts with it.
 */
export type CspInput = {
  nonce: string;
  supabaseUrl?: string | null;
  sentryDsn?: string | null;
  dev?: boolean;
};

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, supabaseUrl, sentryDsn, dev = false }: CspInput): string {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const sentry = originOf(sentryDsn);
  const list = (...parts: Array<string | null | undefined | false>) =>
    parts.filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    list("script-src 'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev && "'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    list("img-src 'self' blob: data:", supabase),
    "font-src 'self' data:",
    list("connect-src 'self'", supabase, supabaseWs, sentry, dev && "ws: wss:"),
    list("media-src 'self' blob:", supabase),
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** 128 bits of randomness, base64 (Web Crypto: works in the edge runtime). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
