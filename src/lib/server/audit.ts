import "server-only";
import type { SqlClient } from "@/lib/db";

export interface AuditEntry {
  actorId: string | null;
  actorLabel?: string | null;
  action: string; // e.g. "claim.approved", "verification.changed"
  entityType: string; // e.g. "provider_claim", "listing", "organization"
  entityId?: string | null;
  entityLabel?: string | null;
  previous?: unknown;
  next?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Appends an audit log entry inside the caller's transaction so the audit
 * record commits (or rolls back) together with the change it describes.
 */
export async function audit(sql: SqlClient, entry: AuditEntry) {
  let actorLabel = entry.actorLabel ?? null;
  if (!actorLabel && entry.actorId) {
    const rows = await sql.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [entry.actorId]);
    actorLabel = rows[0]?.full_name ?? null;
  }
  await sql.query(
    `insert into public.audit_logs (actor_id, actor_label, action, entity_type, entity_id, entity_label, previous_state, new_state, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.actorId,
      actorLabel ?? "System",
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.entityLabel ?? null,
      entry.previous === undefined ? null : JSON.stringify(entry.previous),
      entry.next === undefined ? null : JSON.stringify(entry.next),
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}
