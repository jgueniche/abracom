import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Invitation → first login → onboarding → home. Requires a running Supabase stack
 * (local CLI or staging) and its inbox: run with
 *   SUPABASE_E2E=1 NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MAILPIT_URL=http://127.0.0.1:54324 pnpm test:e2e
 */
const enabled = Boolean(process.env.SUPABASE_E2E);
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const DEMO_SCHOOL_ID = "00000000-0000-4000-8000-000000000001";

test.describe("invitation → first login", () => {
  test.skip(!enabled, "needs a Supabase stack (SUPABASE_E2E=1)");

  test("an invited parent follows the e-mail link, accepts the legal texts and reaches the home page", async ({
    page,
    request,
    baseURL,
  }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const email = `e2e-${Date.now()}@demo.local`;

    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { first_name: "", last_name: "", locale: "fr" },
      redirectTo: `${baseURL}/auth/callback?next=/accueil`,
    });
    expect(error).toBeNull();
    const userId = invited.user!.id;

    try {
      const { error: membershipError } = await admin.from("memberships").insert({
        user_id: userId,
        school_id: DEMO_SCHOOL_ID,
        role: "parent",
        status: "invited",
        invited_at: new Date().toISOString(),
      });
      expect(membershipError).toBeNull();

      const link = await waitForInvitationLink(request, email);
      await page.goto(link);

      await expect(page).toHaveURL(/\/bienvenue/);
      // "Nom" is a substring of "Prénom": both labels match without `exact`
      await page.getByLabel("Prénom", { exact: true }).fill("Test");
      await page.getByLabel("Nom", { exact: true }).fill("Invitation");
      for (const box of await page.getByRole("checkbox").all()) await box.check();
      await page.getByRole("button", { name: "Accéder à l'application" }).click();

      await expect(page).toHaveURL(/\/accueil/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Test");

      const { data: membership } = await admin
        .from("memberships")
        .select("status")
        .eq("user_id", userId)
        .single();
      expect(membership?.status).toBe("active");
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  });
});

/** Polls the local Mailpit inbox for the invitation e-mail and extracts its action link. */
async function waitForInvitationLink(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await request.get(`${MAILPIT_URL}/api/v1/search`, {
      params: { query: `to:${email}` },
    });
    const { messages } = (await search.json()) as { messages: Array<{ ID: string }> };
    if (messages?.length) {
      const message = await request.get(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`);
      const body = (await message.json()) as { HTML?: string; Text?: string };
      const match =
        /href="([^"]+)"/.exec(body.HTML ?? "") ?? /(https?:\/\/\S+)/.exec(body.Text ?? "");
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No invitation e-mail received for ${email}`);
}
