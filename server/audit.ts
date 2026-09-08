import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEntry = {
  schoolId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, Json>;
};

/**
 * Every admin / moderation action ends with an audit entry (brief §9). Rows are written by the
 * `log_audit` function, which stamps the actor itself and refuses callers outside the school team.
 * Failures are logged, never fatal.
 */
export async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.rpc("log_audit", {
    school: entry.schoolId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? undefined,
    diff: entry.diff ?? undefined,
  });
  if (error) console.error("[audit] insert failed:", error.code, error.message);
}
