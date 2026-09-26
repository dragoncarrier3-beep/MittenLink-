import type { ChangeRequestRecord } from "@/lib/data/provider";

const OPEN = ["pending_review", "more_info_required"];

/** The open change request to revise for a record (if any). */
export function openRequestFor(requests: ChangeRequestRecord[], type: ChangeRequestRecord["target_type"], targetId: string | null, reviseId?: string | null) {
  if (reviseId) {
    const r = requests.find((x) => x.id === reviseId && x.target_type === type && OPEN.includes(x.status) && (x.target_id ?? null) === (targetId ?? null));
    if (r) return r;
  }
  if (!targetId) return null;
  return requests.find((x) => x.target_type === type && x.target_id === targetId && OPEN.includes(x.status)) ?? null;
}

/** Current published values overlaid with the proposed values of a pending update. */
export function withProposal<T extends object>(current: T, request: ChangeRequestRecord | null): T {
  if (!request) return current;
  const out = { ...current } as Record<string, unknown>;
  for (const [k, v] of Object.entries(request.proposed ?? {})) {
    if (k in out) out[k] = v;
  }
  return out as T;
}

export const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
