import "server-only";

import { appName } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Preferences page advertised through `List-Unsubscribe`. */
  unsubscribeUrl?: string;
};

export type EmailSender = (message: EmailMessage) => Promise<void>;

/** Failure of the provider; `status` lets the worker tell a rate limit (429) from a hard error. */
export class EmailSendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

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
      headers: message.unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    }),
  });
  if (!response.ok) {
    throw new EmailSendError(
      response.status,
      `Resend ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
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
        `<li style="margin:0 0 14px;padding-left:14px;border-left:2px solid #becadc"><a href="${escapeHtml(item.href)}" style="color:#0038b8;font-weight:600;text-decoration:none">${escapeHtml(item.title)}</a>${
          item.body
            ? `<div style="color:#55657c;font-size:14px;margin-top:2px">${escapeHtml(item.body)}</div>`
            : ""
        }</li>`,
    )
    .join("");
  const cta = input.cta
    ? `<p style="margin:26px 0 0"><a href="${escapeHtml(input.cta.href)}" style="background:#0038b8;color:#ffffff;font-weight:600;padding:0 20px;min-height:44px;line-height:44px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(input.cta.label)}</a></p>`
    : "";
  /*
   * The application changed charter in session 16 — the teal of the first two
   * sessions gave way to the blues of the flag (ADR-0032) — and nothing here
   * followed, because nobody opens the e-mails. The greeting is set in a serif,
   * as the school's voice is in the application; Georgia is the one serif every
   * mail client has, and no web font is worth a download in an inbox.
   */
  const html = `<!doctype html><html lang="fr"><body style="font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#0f1e33;background:#f3f8fe;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="font-size:12px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:#0038b8;margin:0 0 14px">${escapeHtml(appName)}</p>
<p style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;letter-spacing:-0.01em;margin:0 0 10px">${escapeHtml(input.greeting)}</p>
<p style="margin:0 0 18px">${escapeHtml(input.intro)}</p>
<ul style="list-style:none;padding:0;margin:0">${items}</ul>
${cta}
<hr style="border:0;border-top:1px solid #becadc;margin:26px 0 16px" />
<p style="color:#55657c;font-size:13px;line-height:1.5;margin:0">${escapeHtml(input.footer)}</p>
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
