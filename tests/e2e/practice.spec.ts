import { expect, type Page, test } from "@playwright/test";

/**
 * « S'entraîner » end to end (ADR-0087): a parent opens a homework, asks for a sheet, waits
 * while it is prepared, answers on screen and unfolds the answer key; the teacher of the class
 * withdraws the sheet and the parent is told so; the teacher puts it back.
 *
 * Needs a Supabase stack with the seed and the fake provider, which the dev server inherits:
 *   SUPABASE_E2E=1 PRACTICE_AI_PROVIDER=fake NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm test:e2e
 */
const enabled = Boolean(process.env.SUPABASE_E2E) && process.env.PRACTICE_AI_PROVIDER === "fake";
// « Fiche d'additions n° 3 », CP Oliviers, in the seed; Noam (parent-1) is in the class.
const HOMEWORK = "00000000-0000-4000-8000-000000001703";
const ACCOUNTS = ["parent-1@demo.local", "teacher-05@demo.local"];

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Each browser project works on its own level, so the two can run side by side. */
function levelOf(project: string) {
  return project.startsWith("mobile")
    ? { slug: "plus-loin", db: "harder", label: "Pour aller plus loin" }
    : { slug: "facile", db: "easier", label: "Plus facile" };
}

async function removeSheet(level: string) {
  const client = await admin();
  const { data } = await client
    .from("practice_sheets")
    .select("id, school_id, class_id")
    .eq("post_id", HOMEWORK)
    .eq("level", level);
  for (const sheet of data ?? []) {
    const folder = `${sheet.school_id}/${sheet.class_id}/${sheet.id}`;
    const { data: files } = await client.storage.from("practice").list(folder);
    if (files?.length)
      await client.storage.from("practice").remove(files.map((file) => `${folder}/${file.name}`));
    await client.from("practice_sheets").delete().eq("id", sheet.id);
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo-password");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/connexion")),
    page.locator('button[type="submit"]').click(),
  ]);
}

test.describe("practice sheets", () => {
  test.skip(!enabled, "needs a Supabase stack and PRACTICE_AI_PROVIDER=fake");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
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
    await client.from("classes").update({ practice_enabled: true }).eq("name", "CP Oliviers");
  });

  test("a parent asks for a sheet, answers on screen and opens the answer key", async ({
    page,
  }, testInfo) => {
    const level = levelOf(testInfo.project.name);
    await removeSheet(level.db);
    {
      await signIn(page, "parent-1@demo.local");
      await page.goto(`/devoirs/${HOMEWORK}`);
      const block = page.locator("#entrainement");
      await expect(block.getByRole("heading", { name: "S'entraîner" })).toBeVisible();
      await block.getByRole("link", { name: level.label }).click();
      // The first visit compiles the route on a dev server: more than the default 5 s.
      await expect(page).toHaveURL(new RegExp(`/entrainement/${level.slug}$`), { timeout: 30_000 });

      // Opening the page is the request; the sheet arrives on its own.
      await expect(
        page.getByRole("heading", { level: 1, name: "Le verger de Mamie Rose" }),
      ).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("Noam", { exact: true })).toBeVisible();

      // The answers are computed by the application, and checked on screen.
      const right = page.getByRole("textbox", { name: "3 + 4 =" });
      await right.fill("7");
      await right.press("Enter");
      await expect(right).not.toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Bravo !").first()).toBeAttached();
      const wrong = page.getByRole("textbox", { name: "6 + 2 =" });
      await wrong.fill("9");
      await wrong.press("Enter");
      await expect(wrong).toHaveAttribute("aria-invalid", "true");

      await page.getByRole("button", { name: "Afficher le corrigé" }).click();
      await expect(page.getByText("3 + 4 = 7")).toBeVisible();
      await expect(page.getByText(/Exercices écrits par une IA/)).toBeVisible();
      // The sheet stays for the next test, which withdraws it.
    }
  });

  test("the teacher withdraws the sheet, the parent is told, the teacher puts it back", async ({
    browser,
  }, testInfo) => {
    const level = levelOf(testInfo.project.name);
    const path = `/devoirs/${HOMEWORK}/entrainement/${level.slug}`;
    const teacher = await browser.newPage();
    const parent = await browser.newPage();
    try {
      await signIn(teacher, "teacher-05@demo.local");
      await teacher.goto(path);
      await expect(teacher.getByRole("heading", { name: "Pour l'équipe" })).toBeVisible({
        timeout: 60_000,
      });
      await teacher.getByRole("button", { name: "Retirer cette feuille" }).click();
      // A Server Action and a refresh: a few seconds on a dev server compiling on demand.
      await expect(teacher.getByText("Retirée : les familles ne la voient plus.")).toBeVisible({
        timeout: 20_000,
      });

      await signIn(parent, "parent-1@demo.local");
      await parent.goto(path);
      await expect(parent.getByText("L'enseignante a retiré cette feuille.")).toBeVisible({
        timeout: 30_000,
      });

      await teacher.getByRole("button", { name: "Remettre la feuille" }).click();
      await expect(teacher.getByRole("button", { name: "Retirer cette feuille" })).toBeVisible({
        timeout: 20_000,
      });
      await parent.reload();
      await expect(
        parent.getByRole("heading", { level: 1, name: "Le verger de Mamie Rose" }),
      ).toBeVisible();
    } finally {
      await teacher.close();
      await parent.close();
      await removeSheet(level.db);
    }
  });
});
