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

  test("sends baseline security headers", async ({ request }) => {
    const response = await request.get("/connexion");

    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});
