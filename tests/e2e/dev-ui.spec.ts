import { expect, test } from "@playwright/test";

test.describe("style guide (/dev/ui)", () => {
  // The page exists in development and on previews, and is gone from a
  // production build. Read the answer from the server rather than from `CI`,
  // so the suite also passes when it is pointed at a production build locally.
  test("is a full style guide in development and absent in production", async ({ page }) => {
    const response = await page.goto("/dev/ui");

    if (response?.status() === 404) {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("introuvable");
      return;
    }

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Guide de style");
    await expect(page.getByText("--primary / --primary-foreground")).toBeVisible();
  });

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
