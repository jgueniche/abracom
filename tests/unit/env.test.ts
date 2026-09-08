import { describe, expect, it } from "vitest";

import { getSupabasePublicConfig, MissingSupabaseConfigError, parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  it("applies defaults when variables are absent or empty", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_APP_NAME: "", NEXT_PUBLIC_SITE_URL: undefined });

    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Kesher");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("lets the app name be overridden (renaming via NEXT_PUBLIC_APP_NAME)", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_APP_NAME: "  Abravanel Connect " });

    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Abravanel Connect");
  });

  it("rejects a malformed site URL", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "not-a-url" })).toThrow();
  });
});

describe("getSupabasePublicConfig", () => {
  it("throws a French, actionable error when Supabase is not configured", () => {
    const env = parsePublicEnv({});

    expect(() => getSupabasePublicConfig(env)).toThrow(MissingSupabaseConfigError);
    expect(() => getSupabasePublicConfig(env)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns url and anon key when both are set", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });

    expect(getSupabasePublicConfig(env)).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon",
    });
  });
});
