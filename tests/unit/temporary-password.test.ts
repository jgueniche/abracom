import { describe, expect, it } from "vitest";

import { temporaryPassword } from "@/lib/auth/temporary-password";

describe("temporaryPassword", () => {
  it("is three groups of four characters nobody misreads", () => {
    for (let i = 0; i < 200; i++) {
      const password = temporaryPassword();
      expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
      expect(password).not.toMatch(/[ilo01]/);
    }
  });

  it("is drawn afresh every time", () => {
    const drawn = new Set(Array.from({ length: 500 }, () => temporaryPassword()));
    expect(drawn.size).toBe(500);
  });

  it("draws again rather than favour the first letters", () => {
    // 248 and above would map onto « abcdefgh » a ninth time: they are skipped.
    const bytes = [255, 248, 0, 30, 31, 247];
    let call = 0;
    const password = temporaryPassword((length) => {
      call++;
      return Uint8Array.from({ length }, (_, i) => bytes[(i + call) % bytes.length]!);
    });
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(password.replace(/-/g, "")).toHaveLength(12);
  });
});
