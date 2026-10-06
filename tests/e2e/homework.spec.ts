import { expect, type Page, test } from "@playwright/test";

/**
 * The homework space, end to end (session 33): a teacher sets a homework with a photographed
 * page, a parent finds it on the day it is due, ticks it « fait » and opens the page full screen;
 * a parent shares a photo in the class group and it shows in the conversation.
 *
 * Needs a Supabase stack with the seed (`pnpm db:reset`): run with
 *   SUPABASE_E2E=1 NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm test:e2e
 */
const enabled = Boolean(process.env.SUPABASE_E2E);
const CLASS_PS = "00000000-0000-4000-8000-000000000514";
const GROUP_PS = "00000000-0000-4000-8000-000000003090";
const ACCOUNTS = ["teacher-ps@demo.local", "parent-1@demo.local"];

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** A photo straight from a phone: several megabytes, more than a Server Action accepts. */
async function phonePhoto(): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const [width, height] = [3000, 2000];
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  return sharp(noise, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** A page of a revision book, as a phone would send it: a real JPEG of a few hundred KB. */
async function pagePhoto(): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const svg = `<svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f5f1e8"/>
    <text x="100" y="200" font-size="80" fill="#222">Fiche de révision</text>
    <text x="100" y="400" font-size="48" fill="#333">1. Lire la page 12</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

/** A homework the test published, its files included — run even when the test fails. */
async function removeHomework(title: string) {
  const client = await admin();
  const { data: posts } = await client.from("class_posts").select("id").eq("title", title);
  for (const post of posts ?? []) {
    const { data: media } = await client
      .from("class_post_media")
      .select("storage_path, thumb_path")
      .eq("post_id", post.id);
    const files = (media ?? []).flatMap((m) => [m.storage_path, m.thumb_path ?? []].flat());
    if (files.length > 0) await client.storage.from("class-media").remove(files);
    await client.from("class_posts").delete().eq("id", post.id);
  }
}

/** A message the test sent, its files included. */
async function removeMessage(body: string) {
  const client = await admin();
  const { data: sent } = await client.from("messages").select("id, attachments").eq("body", body);
  for (const message of sent ?? []) {
    const attachments = (message.attachments ?? []) as Array<{ path: string; thumb?: string }>;
    const files = attachments.flatMap((a) => [a.path, a.thumb ?? []].flat());
    if (files.length > 0) await client.storage.from("messages").remove(files);
    await client.from("messages").delete().eq("id", message.id);
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

test.describe("the homework space", () => {
  test.skip(!enabled, "needs a Supabase stack (SUPABASE_E2E=1)");
  // Two sign-ins, an upload and a dozen screens: longer than the default 30 s on a dev server.
  test.describe.configure({ mode: "serial", timeout: 120_000 });

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

  test("a teacher sets a homework with a page, a parent ticks it and opens the page", async ({
    browser,
  }, testInfo) => {
    const title = `Réviser la fiche des sons — ${testInfo.project.name} ${Date.now()}`;
    const photo = await pagePhoto();
    // A run stopped halfway used to leave its homework in the seed, ticked, on a parent's week.
    try {
      // ── the teacher ───────────────────────────────────────────────────────
      const teacher = await browser.newPage();
      await signIn(teacher, "teacher-ps@demo.local");
      // The next school day is chosen by default: « Pour quand ? » needs no answer for tomorrow.
      await teacher.goto(`/devoirs/nouveau?classe=${CLASS_PS}`);
      await teacher.getByLabel("À faire").fill(title);
      await teacher
        .locator('input[type="file"][multiple]')
        .setInputFiles({ name: "page-12.jpg", mimeType: "image/jpeg", buffer: photo });
      await expect(teacher.getByText("Page 1 prête")).toBeAttached({ timeout: 30_000 });
      await Promise.all([
        teacher.waitForURL((url) => url.pathname === "/devoirs", { timeout: 30_000 }),
        teacher.getByRole("button", { name: "Publier le devoir" }).click(),
      ]);
      const published = teacher.locator("article", { hasText: title });
      await expect(published).toBeVisible();
      await expect(
        published.getByRole("button", { name: /Agrandir la page 1 sur 1/ }),
      ).toBeVisible();
      await expect(published.getByText(/Fait : 0 \//)).toBeVisible();
      await teacher.close();

      // ── a parent of the class ─────────────────────────────────────────────
      const parent = await browser.newPage();
      await signIn(parent, "parent-1@demo.local");
      await parent.goto("/devoirs");
      const entry = parent.locator("article", { hasText: title });
      await expect(entry).toBeVisible();

      const tick = entry.getByRole("checkbox");
      await expect(tick).toHaveAttribute("aria-checked", "false");
      await tick.click();
      // drawn at once, before the server has answered…
      await expect(tick).toHaveAttribute("aria-checked", "true");
      // …and still there once the page has been rendered again from the database
      await parent.reload();
      await expect(
        parent.locator("article", { hasText: title }).getByRole("checkbox"),
      ).toHaveAttribute("aria-checked", "true");

      await parent
        .locator("article", { hasText: title })
        .getByRole("button", { name: /Agrandir la page 1 sur 1/ })
        .click();
      const viewer = parent.getByRole("dialog");
      await expect(viewer).toBeVisible();
      await expect(viewer.getByRole("button", { name: "Imprimer" })).toBeVisible();
      await expect(viewer.locator("img[data-viewer-image]")).toHaveJSProperty("complete", true);
      await parent.keyboard.press("Escape");
      await expect(viewer).toBeHidden();

      // the homework's own page, printable
      await parent
        .locator("article", { hasText: title })
        .getByRole("link", { name: title })
        .click();
      await expect(parent.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(parent.getByRole("button", { name: "Imprimer" })).toBeVisible();
      await parent.close();
    } finally {
      await removeHomework(title);
    }
  });

  test("a parent shares a photo in the class group, and it shows in the thread", async ({
    page,
  }, testInfo) => {
    const text = `La page de ce soir — ${testInfo.project.name} ${Date.now()}`;
    try {
      await signIn(page, "parent-1@demo.local");
      await page.goto(`/messages/${GROUP_PS}`);
      // A photo of several megabytes used to crash the whole screen (1 MB Server Action cap).
      const big = await phonePhoto();
      expect(big.length).toBeGreaterThan(1024 * 1024);
      await page
        .locator('form input[type="file"][multiple]')
        .setInputFiles({ name: "devoir.jpg", mimeType: "image/jpeg", buffer: big });
      await expect(page.getByText("Photo 1 prête")).toBeAttached({ timeout: 30_000 });
      await page.locator('textarea[name="body"]').fill(text);
      await page.getByRole("button", { name: "Envoyer" }).click();
      const message = page.locator("article", { hasText: text });
      await expect(message).toBeVisible({ timeout: 15_000 });
      await expect(
        message.getByRole("button", { name: /Agrandir la photo 1 sur 1/ }),
      ).toBeVisible();
      await expect(page.getByText("Une erreur est survenue")).toHaveCount(0);

      const client = await admin();
      const { data: sent } = await client
        .from("messages")
        .select("id, attachments")
        .eq("body", text)
        .single();
      const attachments = (sent?.attachments ?? []) as Array<{ path: string; thumb?: string }>;
      expect(attachments).toHaveLength(1);
      expect(attachments[0]?.thumb).toBeTruthy();
    } finally {
      await removeMessage(text);
    }
  });
});
