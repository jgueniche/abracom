import { describe, expect, it } from "vitest";

import { buildCsp, createNonce } from "@/lib/security/csp";

describe("content security policy", () => {
  it("is nonce-based and strict in production", () => {
    const csp = buildCsp({
      nonce: "abc123",
      supabaseUrl: "https://xyz.supabase.co",
      sentryDsn: "https://key@o1.ingest.de.sentry.io/2",
    });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain(
      "connect-src 'self' https://xyz.supabase.co wss://xyz.supabase.co https://o1.ingest.de.sentry.io",
    );
    expect(csp).toContain("img-src 'self' blob: data: https://xyz.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("relaxes only what the dev server needs", () => {
    const csp = buildCsp({ nonce: "n", dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("undefined");
  });

  it("generates distinct base64 nonces", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a).not.toBe(b);
  });
});
