import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("renders in French by default with the app name", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Kesher/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bienvenue sur Kesher");
  });

  test("switches to English through the locale menu", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Langue" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome to Kesher");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Persisted through the NEXT_LOCALE cookie.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("toggles dark mode", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Thème" }).click();
    await page.getByRole("menuitem", { name: "Sombre" }).click();

    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("sends baseline security headers", async ({ request }) => {
    const response = await request.get("/");

    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});
