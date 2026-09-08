import { expect, test } from "@playwright/test";

test.describe("entry points", () => {
  test("the root redirects to the login page in French", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page).toHaveTitle(/Connexion · Kesher/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Connexion");
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  });

  test("switches to English through the locale menu and keeps it after reload", async ({
    page,
  }) => {
    await page.goto("/connexion");

    await page.getByRole("button", { name: "Langue" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("toggles dark mode", async ({ page }) => {
    await page.goto("/connexion");

    await page.getByRole("button", { name: "Thème" }).click();
    await page.getByRole("menuitem", { name: "Sombre" }).click();

    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("rejects an invalid e-mail without leaving the page", async ({ page }) => {
    await page.goto("/connexion");

    await page.getByLabel("Adresse e-mail").fill("pas-un-email");
    await page.getByRole("button", { name: "Recevoir mon lien" }).click();

    // the browser's native validation blocks the submit; the page stays put
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByLabel("Adresse e-mail")).toBeFocused();
  });

  test("offers password sign-in and reports an unreachable backend", async ({ page }) => {
    await page.goto("/connexion");

    await page.getByRole("button", { name: "Se connecter avec un mot de passe" }).click();
    await page.getByLabel("Adresse e-mail").fill("admin@demo.local");
    await page.getByLabel("Mot de passe").fill("not-the-password");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();

    // no Supabase behind the test server: unconfigured locally, unreachable in CI
    await expect(page.locator("#login-error")).toContainText(/disponible/);
    await expect(page).toHaveURL(/\/connexion$/);

    await page.getByRole("button", { name: "Recevoir un lien par e-mail" }).click();
    await expect(page.getByRole("button", { name: "Recevoir mon lien" })).toBeVisible();
  });

  test("sends baseline security headers", async ({ request }) => {
    const response = await request.get("/connexion");

    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  });
});
