import { expect, type Page, test } from "@playwright/test";

/**
 * Several schools, a test school, families registered by the school (session 34).
 *
 *  - the « Espace de test » door opens the test school as the character chosen, and only
 *    with its password;
 *  - the direction registers a family; the parent signs in with the provisional password
 *    shown once, must choose their own before anything opens, and lands on their home;
 *  - the platform administrator opens a school and moves between schools.
 *
 * Needs a Supabase stack with the seed (`pnpm db:reset`): run with
 *   SUPABASE_E2E=1 NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm test:e2e
 */
const enabled = Boolean(process.env.SUPABASE_E2E);
const TEST_SCHOOL = "École test Kesher";
const ACCOUNTS = ["admin@demo.local", "superadmin@demo.local", "parent-1@demo.local"];

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signIn(page: Page, email: string, password = "demo-password") {
  await page.goto("/connexion");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/connexion")),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "Mon compte" }).click();
}

test.describe("several schools and families registered by the school", () => {
  test.skip(!enabled, "needs a Supabase stack (SUPABASE_E2E=1)");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    // The demo accounts have not accepted the legal texts on a fresh stack.
    const client = await admin();
    const { data: users } = await client.auth.admin.listUsers({ perPage: 1000 });
    const ids = (users?.users ?? [])
      .filter((u) => ACCOUNTS.includes(u.email ?? ""))
      .map((u) => u.id);
    const { data: documents } = await client.from("legal_documents").select("id");
    const rows = ids.flatMap((user_id) =>
      (documents ?? []).map((d) => ({ user_id, legal_document_id: d.id })),
    );
    if (rows.length > 0)
      await client.from("legal_acceptances").upsert(rows, { ignoreDuplicates: true });
  });

  test("the test door opens the test school as the character chosen, and only with its password", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: "Espace de test" }).click();
    await expect(page).toHaveURL(/\/essai$/);

    await page.getByLabel("Mot de passe de l'espace de test").fill("not-the-password");
    await page.getByRole("radio", { name: /^Parent/ }).check();
    await page.getByRole("button", { name: "Entrer dans l'école test" }).click();
    await expect(page.locator("#test-error")).toContainText("Mot de passe incorrect");
    await expect(page).toHaveURL(/\/essai$/);

    await page.getByLabel("Mot de passe de l'espace de test").fill("demo-password");
    await page.getByRole("radio", { name: /^Parent/ }).check();
    await Promise.all([
      page.waitForURL(/\/accueil/),
      page.getByRole("button", { name: "Entrer dans l'école test" }).click(),
    ]);
    // the band says where one is, on every page
    await expect(page.getByRole("complementary", { name: "École test" })).toContainText("fictifs");
    await openAccountMenu(page);
    await expect(page.getByRole("menu")).toContainText(TEST_SCHOOL);
  });

  test("the direction registers a family, and the parent chooses a password at the first sign-in", async ({
    page,
  }, testInfo) => {
    const client = await admin();
    const stamp = `${Date.now()}-${testInfo.project.name}`;
    const email = `famille-${stamp}@demo.local`;
    const lastName = `Essai${Date.now() % 100000}`;

    try {
      await signIn(page, "admin@demo.local");
      await page.goto("/admin/familles");
      await page.getByRole("link", { name: "Nouvelle famille" }).click();
      await expect(page).toHaveURL(/\/admin\/familles\/nouvelle$/);

      const parent = page.getByRole("group", { name: "Parent 1" });
      await parent.getByLabel("Prénom").fill("Sarah");
      await parent.getByLabel("Nom", { exact: true }).fill(lastName);
      await parent.getByLabel("Adresse e-mail").fill(email);
      const child = page.getByRole("group", { name: "Enfant 1" });
      await child.getByLabel("Prénom").fill("Noé");
      // the parents' name comes in by itself
      await child.getByLabel("Nom", { exact: true }).focus();
      await expect(child.getByLabel("Nom", { exact: true })).toHaveValue(lastName);
      await child.getByLabel("Classe").selectOption({ label: "PS Tournesols" });
      await page.getByRole("button", { name: "Inscrire la famille" }).click();

      await expect(page.getByText("Famille inscrite.")).toBeVisible();
      const password = (await page.locator("p.font-mono").first().textContent())?.trim();
      expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
      await expect(page.getByRole("link", { name: `Noé ${lastName}` })).toBeVisible();

      // the parent, on a fresh browser session
      await page.context().clearCookies();
      await signIn(page, email, password!);
      await expect(page).toHaveURL(/\/mot-de-passe$/);
      await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("mon-mot-de-passe");
      await page.getByLabel("Confirmez le nouveau mot de passe").fill("mon-mot-de-passe");
      await page.getByRole("button", { name: "Enregistrer et continuer" }).click();

      await expect(page).toHaveURL(/\/bienvenue/);
      await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue("Sarah");
      for (const box of await page.getByRole("checkbox").all()) await box.check();
      await page.getByRole("button", { name: "Accéder à l'application" }).click();
      await expect(page).toHaveURL(/\/accueil/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Sarah");
      await expect(page.getByRole("main")).toContainText("Noé");

      // the provisional password no longer opens anything; the chosen one does
      await page.context().clearCookies();
      await page.goto("/connexion");
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password!);
      await page.locator('button[type="submit"]').click();
      await expect(page.locator("#login-error")).toContainText("incorrect");
      await signIn(page, email, "mon-mot-de-passe");
      await expect(page).toHaveURL(/\/accueil/);
    } finally {
      const { data: user } = await client.rpc("find_user_id_by_email", { email });
      const { data: students } = await client
        .from("students")
        .select("id, family_id")
        .eq("last_name", lastName);
      for (const student of students ?? []) {
        await client.from("students").delete().eq("id", student.id);
        if (student.family_id) await client.from("families").delete().eq("id", student.family_id);
      }
      if (user) await client.auth.admin.deleteUser(user);
    }
  });

  test("the platform administrator opens a school and moves between schools", async ({
    page,
  }, testInfo) => {
    const client = await admin();
    const name = `École e2e ${testInfo.project.name} ${Date.now() % 100000}`;

    try {
      await signIn(page, "superadmin@demo.local");
      await page.goto("/admin/ecoles");
      await expect(page.getByRole("main")).toContainText(TEST_SCHOOL);
      await page.getByLabel("Nom de l'école").fill(name);
      await page.getByLabel("Ville").fill("Levallois-Perret");
      await page.getByRole("button", { name: "Ouvrir l'école" }).click();
      await expect(page.getByText(`${name} est ouverte.`)).toBeVisible();

      await Promise.all([
        page.waitForURL(/\/accueil/),
        page.getByRole("button", { name: `Aller dans ${name}` }).click(),
      ]);
      await openAccountMenu(page);
      await expect(page.getByRole("menu")).toContainText(name);
      // no band: a school that is opened is a real one
      await expect(page.getByRole("complementary", { name: "École test" })).toHaveCount(0);

      await page.getByRole("menuitemradio", { name: TEST_SCHOOL }).click();
      await expect(page.getByRole("complementary", { name: "École test" })).toBeVisible();
    } finally {
      await client.from("schools").delete().eq("name", name);
    }
  });
});
