import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getAssistantModel } from "@/lib/ai/assistant";
import { assistantMode } from "@/lib/ai/config";
import { type AssistantLink, rulePlan } from "@/lib/assistant/plan";
import {
  ANSWER_SYSTEM,
  answerPrompt,
  PLANNER_SYSTEM,
  plannerPrompt,
  type ReaderBrief,
} from "@/lib/assistant/prompt";
import { destinations, readerContext, runPlan } from "@/lib/assistant/tools";
import { getCurrentUser } from "@/lib/auth/session";
import { SCHOOL_TIME_ZONE } from "@/lib/homework";
import { createClient } from "@/lib/supabase/server";

/**
 * The assistant (ADR-0088): one question in, one answer streamed out, as lines of JSON —
 * `{"t":"links"}` with the links the answer may use, then `{"t":"text"}` as it is written,
 * then `{"t":"done"}` or `{"t":"error"}`.
 *
 * Read-only, and under the reader's own rights from end to end: the tools run with the reader's
 * session (`lib/assistant/tools.ts`). Nothing of the conversation is stored — the database keeps
 * how many questions were asked today, and the browser keeps the conversation for its tab.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(12),
});

const encoder = new TextEncoder();
const line = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ t: "error", message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const t = await getTranslations("assistant");
  // Same-origin only: the session cookie must not answer a page from elsewhere.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return fail(403, t("errors.refused"));
  }
  const user = await getCurrentUser();
  if (!user) return fail(401, t("errors.signedOut"));
  const model = getAssistantModel();
  const modules = (user.school?.modules ?? {}) as Record<string, unknown>;
  if (!assistantMode() || !model || modules.assistant === false) {
    return fail(404, t("errors.unavailable"));
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const turns = parsed.success ? parsed.data.messages.slice(-8) : [];
  if (turns.length === 0 || turns.at(-1)!.role !== "user") {
    return fail(400, t("errors.notUnderstood"));
  }

  const supabase = await createClient();
  const { data: allowed, error: quotaError } = await supabase.rpc("assistant_take_question");
  if (quotaError) {
    console.warn("[assistant] quota:", quotaError.message);
    return fail(503, t("errors.unavailable"));
  }
  if (!allowed) {
    return fail(429, t("errors.quota"));
  }

  const started = Date.now();
  const ctx = await readerContext(user);
  const contextMs = Date.now() - started;
  const brief: ReaderBrief = {
    today: ctx.today,
    weekday: new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      timeZone: SCHOOL_TIME_ZONE,
    }).format(new Date()),
    schoolName: ctx.schoolName,
    roles: ctx.roles,
    children: ctx.children.map(({ firstName, className }) => ({ firstName, className })),
    teaching: ctx.teaching.map((cls) => cls.name),
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const question = turns.at(-1)!.text;
        const planned = await model.plan(PLANNER_SYSTEM, plannerPrompt(brief, turns));
        const plan = planned ?? rulePlan(question, { today: ctx.today, children: brief.children });
        const planMs = Date.now() - started - contextMs;
        const results = await runPlan(plan, ctx);
        const toolsMs = Date.now() - started - contextMs - planMs;

        const seen = new Set<string>();
        const links: AssistantLink[] = [...results.flatMap((r) => r.links), ...destinations(ctx)]
          .filter((link) => !seen.has(link.href) && seen.add(link.href))
          .slice(0, 60);
        controller.enqueue(line({ t: "links", links }));

        const hrefs = new Set(links.map((link) => link.href));
        let firstMs = 0;
        for await (const text of model.answer(
          ANSWER_SYSTEM,
          answerPrompt(
            brief,
            turns,
            results.map(({ tool, data }) => ({ tool, data })),
            links,
          ),
        )) {
          if (!firstMs) firstMs = Date.now() - started;
          controller.enqueue(line({ t: "text", v: text }));
        }
        controller.enqueue(line({ t: "done" }));
        // Durations only, never the question (ADR-0088): where an answer spends its time.
        console.info(
          `[assistant] plan=${planned ? "model" : "rules"} tools=${plan.calls.map((c) => c.tool).join(",") || "-"} links=${hrefs.size} context_ms=${contextMs} plan_ms=${planMs} tools_ms=${toolsMs} first_ms=${firstMs} ms=${Date.now() - started}`,
        );
      } catch (error) {
        console.error("[assistant] answer:", (error as Error).message);
        controller.enqueue(line({ t: "error", message: t("error") }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
