import { timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env.server";
import { JOB_TASKS, type JobTask, runNotificationJob } from "@/server/jobs/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Notification worker endpoint, called by Supabase pg_cron + pg_net (supabase/jobs/cron.sql):
 * `dispatch` every five minutes, `digest` hourly in the evening, `reminders` every morning.
 * Authenticated with the `CRON_SECRET` bearer token only.
 */
const MIN_SECRET_LENGTH = 16;

function authorized(request: NextRequest): boolean {
  const { CRON_SECRET } = getServerEnv();
  if (!CRON_SECRET || CRON_SECRET.length < MIN_SECRET_LENGTH) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${CRON_SECRET}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function handle(request: NextRequest, task: string | null): Promise<NextResponse> {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "CRON_SECRET manquant ou trop court" }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resolved = (task ?? "dispatch") as JobTask;
  if (!JOB_TASKS.includes(resolved)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  try {
    const report = await runNotificationJob(resolved);
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[jobs/notifications]", error);
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams.get("task"));
}

export async function POST(request: NextRequest) {
  let task = request.nextUrl.searchParams.get("task");
  if (!task) {
    try {
      const body = (await request.json()) as { task?: string };
      task = body.task ?? null;
    } catch {
      task = null;
    }
  }
  return handle(request, task);
}
