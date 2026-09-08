import "server-only";

import { appName } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export type EmailSender = (message: EmailMessage) => Promise<void>;

/** Resend (EU region is a workspace setting) through its REST API — no SDK needed. */
export async function sendWithResend(message: EmailMessage): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM)
    throw new Error("Resend non configuré (RESEND_API_KEY / EMAIL_FROM).");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok)
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

export function isEmailConfigured(): boolean {
  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailItem = { title: string; body: string | null; href: string };

/** Plain, accessible transactional layout (inline styles, no images, no trackers). */
export function renderEmail(input: {
  greeting: string;
  intro: string;
  items: EmailItem[];
  cta: { label: string; href: string } | null;
  footer: string;
}): { html: string; text: string } {
  const items = input.items
    .map(
      (item) =>
        `<li style="margin:0 0 12px"><a href="${escapeHtml(item.href)}" style="color:#01525e;font-weight:600">${escapeHtml(item.title)}</a>${
          item.body ? `<div style="color:#555;margin-top:2px">${escapeHtml(item.body)}</div>` : ""
        }</li>`,
    )
    .join("");
  const cta = input.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.cta.href)}" style="background:#01525e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(input.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1b;background:#f7f5f0;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
<p style="font-size:20px;font-weight:700;margin:0 0 16px;color:#01525e">${escapeHtml(appName)}</p>
<p style="margin:0 0 8px">${escapeHtml(input.greeting)}</p>
<p style="margin:0 0 16px">${escapeHtml(input.intro)}</p>
<ul style="padding-left:20px;margin:0">${items}</ul>
${cta}
<p style="color:#777;font-size:13px;margin:24px 0 0">${escapeHtml(input.footer)}</p>
</div></body></html>`;
  const text = [
    input.greeting,
    "",
    input.intro,
    "",
    ...input.items.map(
      (item) => `- ${item.title}${item.body ? ` — ${item.body}` : ""}\n  ${item.href}`,
    ),
    "",
    input.cta ? `${input.cta.label}: ${input.cta.href}` : "",
    "",
    input.footer,
  ].join("\n");
  return { html, text };
}
