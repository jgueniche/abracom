import { expect, test } from "@playwright/test";

/**
 * Smoke test against a deployed environment (staging / production), driven by environment
 * variables so that nothing sensitive lives in the repository:
 *   SMOKE_BASE_URL=https://abracom.vercel.app SMOKE_PASSWORD=… pnpm test:smoke
 * Signs in with the demo accounts (docs/DEMO.md) through the password form and checks that the
 * main screens of each role render without a server error.
 */
const baseURL = process.env.SMOKE_BASE_URL;
const password = process.env.SMOKE_PASSWORD;

test.skip(!baseURL || !password, "SMOKE_BASE_URL and SMOKE_PASSWORD are required");

const ACCOUNTS = [
  {
    email: "parent-1@demo.local",
    pages: ["/accueil", "/famille", "/annonces", "/agenda", "/messages"],
  },
  { email: "teacher-ps@demo.local", pages: ["/accueil", "/classes", "/agenda", "/messages"] },
  {
    email: "admin@demo.local",
    pages: ["/accueil", "/admin", "/admin/familles", "/admin/annonces"],
  },
];

for (const account of ACCOUNTS) {
  test(`signs in as ${account.email} and opens the main screens`, async ({ page }) => {
    await page.goto(`${baseURL}/connexion`);
    await page.getByRole("button", { name: "Se connecter avec un mot de passe" }).click();
    await page.getByLabel("Adresse e-mail").fill(account.email);
    await page.getByLabel("Mot de passe").fill(password!);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page).not.toHaveURL(/\/connexion/, { timeout: 30_000 });

    // first sign-in: the onboarding asks for the legal texts
    if (page.url().includes("/bienvenue")) {
      for (const box of await page.getByRole("checkbox").all()) {
        if (!(await box.isChecked())) await box.check();
      }
      await page.getByRole("button", { name: "Valider" }).click();
      await expect(page).not.toHaveURL(/\/bienvenue/, { timeout: 30_000 });
    }

    for (const path of account.pages) {
      const response = await page.goto(`${baseURL}${path}`);
      expect(response?.status(), path).toBeLessThan(500);
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    }
  });
}
