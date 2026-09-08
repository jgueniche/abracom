import { expect, test } from "@playwright/test";

test.describe("agenda", () => {
  test("requires a session", async ({ page }) => {
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("rejects malformed calendar feed tokens before touching the database", async ({
    request,
  }) => {
    const response = await request.get("/api/calendar/not-a-token");
    expect(response.status()).toBe(404);
  });
});
