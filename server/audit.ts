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

/** Every admin / moderation action ends with an audit entry (brief §9). Failures are logged, never fatal. */
export async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    school_id: entry.schoolId,
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
  });
  if (error) console.error("[audit] insert failed:", error.message);
}
