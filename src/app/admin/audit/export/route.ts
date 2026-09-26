import type { NextRequest } from "next/server";
import { getCurrentUser, isAdmin, isSuperAdmin } from "@/lib/auth";
import { csvResponse, exportAudit, toCsv } from "@/lib/data/admin-records";

/** CSV export of the audit log (admin only; same filters as the audit page). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return new Response("Not authorized", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const p = req.nextUrl.searchParams;
  const val = (k: string) => p.get(k)?.trim() || undefined;
  try {
    const rows = await exportAudit({ action: val("action"), entity: val("entity"), actor: val("actor"), from: val("from"), to: val("to") }, isSuperAdmin(user));
    const body = toCsv(
      rows.map((r) => ({
        id: r.id, created_at: r.created_at, actor: r.actor_label, action: r.action, entity_type: r.entity_type, entity_id: r.entity_id,
        entity_label: r.entity_label, previous_state: r.previous_state, new_state: r.new_state, metadata: r.metadata,
      })),
      ["id", "created_at", "actor", "action", "entity_type", "entity_id", "entity_label", "previous_state", "new_state", "metadata"],
    );
    return csvResponse(`mittenlink-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, body);
  } catch (err) {
    console.error("[audit export]", err);
    return new Response("The export could not be created right now. Please try again.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
