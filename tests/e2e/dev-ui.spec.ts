import { expect, test } from "@playwright/test";

const isProduction = Boolean(process.env.CI);

test.describe("style guide (/dev/ui)", () => {
  test(
    isProduction ? "is hidden in production" : "renders the token swatches",
    async ({ page }) => {
      const response = await page.goto("/dev/ui");

      if (isProduction) {
        expect(response?.status()).toBe(404);
        return;
      }

      await expect(page.getByRole("heading", { level: 1 })).toContainText("Guide de style");
      await expect(page.getByText("--primary / --primary-foreground")).toBeVisible();
    },
  );

  test("serves the PWA manifest and icons", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const json = await manifest.json();
    expect(json.name).toBe("Kesher");
    expect(json.icons).toHaveLength(4);

    const icon = await request.get("/icons/icon-192.png");
    expect(icon.ok()).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  });
});
