import { describe, expect, it } from "vitest";

import { APP_HOME_PATH, isPublicPath, safeNextPath } from "@/lib/auth/routes";

describe("isPublicPath", () => {
  it("keeps token-authenticated API routes and the service worker public", () => {
    expect(isPublicPath("/api/calendar/abc")).toBe(true);
    expect(isPublicPath("/api/jobs/notifications")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/hors-ligne")).toBe(true);
    expect(isPublicPath("/api/storage/messages")).toBe(false);
    expect(isPublicPath("/api/livret/123")).toBe(false);
  });

  it("keeps login, auth callbacks, style guide and PWA files public", () => {
    for (const path of [
      "/",
      "/connexion",
      "/auth/callback",
      "/auth/confirm",
      "/dev/ui",
      "/manifest.webmanifest",
      "/robots.txt",
    ]) {
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("protects the application", () => {
    for (const path of ["/accueil", "/famille", "/profil", "/classes/abc", "/bienvenue"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("accepts same-origin relative paths only", () => {
    expect(safeNextPath("/famille")).toBe("/famille");
    expect(safeNextPath("/classes/x?tab=1")).toBe("/classes/x?tab=1");
  });

  it("falls back for open-redirect attempts and auth routes", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil",
      "/auth/callback",
      "/connexion",
      42,
      null,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBe(APP_HOME_PATH);
    }
    for (const bad of ["/%09/evil", "/\t/evil.com", "/famille\n", "/a b"]) {
      expect(safeNextPath(bad), JSON.stringify(bad)).toBe(APP_HOME_PATH);
    }
  });
});
