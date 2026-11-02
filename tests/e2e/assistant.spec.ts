import { expect, type Page, test } from "@playwright/test";

/**
 * The assistant end to end (ADR-0088), with the fake provider: the bubble opens, a question
 * comes back answered from the reader's own data, and a link of the answer leads there. Then the
 * boundary, which is the point: another family never sees this class's homework, and the links
 * handed to a read-only guardian never include the messaging.
 *
 * Needs a Supabase stack with the seed and the fake provider, which the dev server inherits:
 *   SUPABASE_E2E=1 PRACTICE_AI_PROVIDER=fake NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm test:e2e
 */
const enabled = Boolean(process.env.SUPABASE_E2E) && process.env.PRACTICE_AI_PROVIDER === "fake";
// « Fiche d'additions n° 3 », CP Oliviers, in the seed; Noam (parent-1) is in the class.
const HOMEWORK = "00000000-0000-4000-8000-000000001703";
const PARENT = "parent-1@demo.local";
// A family of CE1 Cèdres only, and its read-only guardian.
const OTHER_PARENT = "parent-005-01@demo.local";
const GUARDIAN = "guardian-005@demo.local";
const ACCOUNTS = [PARENT, OTHER_PARENT, GUARDIAN];

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
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

async function ask(page: Page, question: string) {
  await page.getByRole("button", { name: "Poser une question à l'assistant" }).click();
  const panel = page.getByRole("dialog", { name: "Assistant" });
  await panel.getByLabel("Votre question").fill(question);
  await panel.getByRole("button", { name: "Envoyer" }).click();
  // The answer streams in; the conversation says when it is complete.
  await expect(panel.locator("ol")).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });
  return panel;
}

/** The links the server hands over with an answer: the first line of the stream. */
async function linksFor(page: Page, question: string) {
  const response = await page.request.post("/api/assistant", {
    data: { messages: [{ role: "user", text: question }] },
  });
  expect(response.status()).toBe(200);
  const first = (await response.text()).split("\n")[0]!;
  const event = JSON.parse(first) as { t: string; links: { href: string }[] };
  expect(event.t).toBe("links");
  return event.links.map((link) => link.href);
}

test.describe("assistant", () => {
  test.skip(!enabled, "needs a Supabase stack and PRACTICE_AI_PROVIDER=fake");
  test.describe.configure({ timeout: 120_000 });

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
    // The daily allowance must not run out across repeated runs.
    await client.from("assistant_usage").delete().in("user_id", ids);
  });

  test("a parent asks for the week's homework and follows a link of the answer", async ({
    page,
  }) => {
    await signIn(page, PARENT);
    await page.goto("/accueil");
    const panel = await ask(page, "Quels devoirs pour cette semaine ?");
    const link = panel.getByRole("link", { name: "Fiche d'additions n° 3" });
    await expect(link).toHaveAttribute("href", `/devoirs/${HOMEWORK}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/devoirs/${HOMEWORK}$`), { timeout: 60_000 });
    await expect(panel).toBeHidden();
  });

  test("another family never sees this class's homework", async ({ page }) => {
    await signIn(page, OTHER_PARENT);
    await page.goto("/accueil");
    const panel = await ask(page, "Quels devoirs pour cette semaine ?");
    await expect(panel.locator("ol")).not.toContainText("Fiche d'additions");
    expect(await linksFor(page, "Quels devoirs pour cette semaine ?")).not.toContain(
      `/devoirs/${HOMEWORK}`,
    );
  });

  test("a read-only guardian is never handed the messaging", async ({ page }) => {
    await signIn(page, GUARDIAN);
    await page.goto("/accueil");
    const links = await linksFor(page, "Comment envoyer un message à la maîtresse ?");
    expect(links).toContain("/aide");
    expect(links.some((href) => href.startsWith("/messages"))).toBe(false);
  });

  test("refuses a request from another origin, and a signed-out one", async ({
    page,
    playwright,
  }) => {
    await signIn(page, PARENT);
    const crossOrigin = await page.request.post("/api/assistant", {
      headers: { origin: "https://example.com" },
      data: { messages: [{ role: "user", text: "Bonjour" }] },
    });
    expect(crossOrigin.status()).toBe(403);

    // Signed out, the middleware sends the request to the sign-in page before the route runs.
    const anonymous = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
    const signedOut = await anonymous.post("/api/assistant", {
      data: { messages: [{ role: "user", text: "Bonjour" }] },
      maxRedirects: 0,
    });
    expect(signedOut.status()).toBe(307);
    expect(signedOut.headers()["location"]).toMatch(/\/connexion/);
    await anonymous.dispose();
  });
});
