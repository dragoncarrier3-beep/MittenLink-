import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify, notifyRole } from "@/lib/server/notifications";
import { UserFacingError } from "@/lib/server/action";
import { applyChangeRequest, reviewChangeRequest } from "./change-requests";

/*
 * Verification workflow. A verifier (or admin) resolves a verification task
 * with one of four outcomes. Every outcome writes verification_history (with
 * sources checked) and an audit entry. Verification never depends on billing.
 */

export type VerificationAction = "verify" | "request_update" | "unable_to_verify" | "escalate" | "reject_change";
export type VerificationMethod =
  | "provider_confirmation"
  | "official_website"
  | "government_source"
  | "phone_confirmation"
  | "email_confirmation"
  | "manual_research";

export interface SourceChecked {
  sourceType: VerificationMethod | "other";
  url?: string | null;
  description?: string | null;
}

export interface ResolveTaskInput {
  taskId: string;
  action: VerificationAction;
  actorId: string;
  method?: VerificationMethod | null;
  sources?: SourceChecked[];
  publicSummary?: string | null;
  internalNotes?: string | null;
  /** Message to the provider (request update / reject change). */
  messageToProvider?: string | null;
}

const PUBLIC_SUMMARY: Record<VerificationMethod, string> = {
  provider_confirmation: "Information confirmed by an authorized representative of the organization.",
  official_website: "Information reviewed against the organization's official website.",
  government_source: "Information checked against a public government source.",
  phone_confirmation: "Contact information and hours confirmed with the organization by phone.",
  email_confirmation: "Information confirmed with the organization by email.",
  manual_research: "Information reviewed by MittenLink staff using public sources.",
};

async function reviewIntervalDays(sql: SqlClient) {
  const [row] = await sql.query<{ value: unknown }>("select value from public.platform_settings where key = 'verification_interval_days'");
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

async function recordHistory(
  sql: SqlClient,
  h: { listingId: string; taskId: string | null; previous: string | null; next: string; action: string; method?: string | null; verifierId: string; publicSummary?: string | null; internalNotes?: string | null; sources?: SourceChecked[] },
) {
  const [row] = await sql.query<{ id: string }>(
    `insert into public.verification_history (listing_id, task_id, previous_status, new_status, action, method, verifier_id, public_summary, internal_notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [h.listingId, h.taskId, h.previous, h.next, h.action, h.method ?? null, h.verifierId, h.publicSummary ?? null, h.internalNotes ?? null],
  );
  for (const s of h.sources ?? []) {
    if (!s.url && !s.description) continue;
    await sql.query(
      "insert into public.verification_sources (history_id, source_type, url, description) values ($1, $2, $3, $4)",
      [row.id, s.sourceType, s.url ?? null, s.description ?? null],
    );
  }
  return row.id;
}

async function organizationManagers(sql: SqlClient, listingId: string) {
  return sql.query<{ user_id: string }>(
    `select m.user_id from public.provider_members m where m.status = 'active' and m.organization_id = app.listing_organization($1)`,
    [listingId],
  );
}

/**
 * Resolves a verification task. Runs inside a service transaction after the
 * caller has checked the actor is a verifier/admin. Returns deferred email
 * senders to call after commit.
 */
export async function resolveVerificationTask(sql: SqlClient, input: ResolveTaskInput) {
  const [task] = await sql.query<{
    id: string; listing_id: string; status: string; reason: string; change_request_id: string | null; correction_id: string | null;
  }>("select id, listing_id, status, reason, change_request_id, correction_id from public.verification_tasks where id = $1 for update", [input.taskId]);
  if (!task) throw new UserFacingError("This verification task no longer exists.");
  if (["completed", "cancelled"].includes(task.status)) throw new UserFacingError("This task has already been resolved.");

  const [listing] = await sql.query<{ id: string; title: string; verification_status: string; publication_status: string }>(
    "select id, title, verification_status, publication_status from public.listings where id = $1 for update",
    [task.listing_id],
  );
  if (!listing) throw new UserFacingError("The record for this task no longer exists.");
  const emails: (() => Promise<boolean>)[] = [];
  const method = input.method ?? null;

  if ((input.action === "verify" || input.action === "unable_to_verify") && !method) {
    throw new UserFacingError("Choose the verification method you used.", { method: "Choose a verification method." });
  }
  if ((input.action === "request_update" || input.action === "reject_change") && !input.messageToProvider?.trim()) {
    throw new UserFacingError("Add a message explaining what is needed.", { messageToProvider: "A message is required." });
  }

  let newStatus = listing.verification_status;
  let historyAction = "status_change";
  let publicSummary = input.publicSummary?.trim() || null;
  let resolution = "";

  switch (input.action) {
    case "verify": {
      if (task.change_request_id) {
        const applied = await applyChangeRequest(sql, task.change_request_id, input.actorId, input.messageToProvider ?? null);
        emails.push(applied.sendEmail);
        historyAction = "change_approved";
        publicSummary ??= "An update from the organization was reviewed and published.";
      } else {
        historyAction = "verified";
      }
      newStatus = "verified";
      publicSummary ??= PUBLIC_SUMMARY[method!];
      const days = await reviewIntervalDays(sql);
      await sql.query(
        `update public.listings set verification_status = 'verified', last_verified_at = now(), next_review_at = (now() + make_interval(days => $2))::date,
           publication_status = case when publication_status = 'pending' then 'published' else publication_status end
         where id = $1`,
        [listing.id, days],
      );
      // Verifying an organization also refreshes its services that were pending.
      await sql.query(
        `update public.listings l set verification_status = 'verified', last_verified_at = now(), next_review_at = (now() + make_interval(days => $2))::date
         from public.services s where s.id = l.id and s.organization_id = $1 and l.verification_status in ('pending_review', 'unverified')`,
        [listing.id, days],
      );
      resolution = task.change_request_id ? "Change approved and published." : "Verified.";
      break;
    }
    case "request_update": {
      newStatus = "needs_update";
      historyAction = "update_requested";
      publicSummary ??= "Some information may be out of date. MittenLink has asked the organization to confirm current details.";
      await sql.query("update public.listings set verification_status = 'needs_update' where id = $1", [listing.id]);
      if (task.change_request_id) {
        const r = await reviewChangeRequest(sql, task.change_request_id, input.actorId, "more_info_required", input.messageToProvider!);
        emails.push(r.sendEmail);
      } else {
        for (const m of await organizationManagers(sql, listing.id)) {
          emails.push(
            await notify(sql, {
              userId: m.user_id,
              kind: "change_more_info",
              title: `${listing.title} needs an update.`,
              body: input.messageToProvider!,
              link: "/provider/verification",
              email: true,
            }),
          );
        }
      }
      resolution = "Update requested from the organization.";
      break;
    }
    case "reject_change": {
      if (!task.change_request_id) throw new UserFacingError("This task does not include a provider change to reject.");
      const r = await reviewChangeRequest(sql, task.change_request_id, input.actorId, "rejected", input.messageToProvider!);
      emails.push(r.sendEmail);
      historyAction = "change_rejected";
      publicSummary = null;
      resolution = "Provider change rejected.";
      break;
    }
    case "unable_to_verify": {
      newStatus = "unable_to_verify";
      historyAction = "unable_to_verify";
      publicSummary ??= "MittenLink could not confirm this information. Please contact the organization before relying on it.";
      await sql.query("update public.listings set verification_status = 'unable_to_verify' where id = $1", [listing.id]);
      resolution = "Marked unable to verify.";
      break;
    }
    case "escalate": {
      historyAction = "escalated";
      publicSummary = null;
      await sql.query("update public.verification_tasks set status = 'escalated', assigned_to = null, details = coalesce(details, '') || $2 where id = $1", [
        task.id,
        input.internalNotes ? `\n\nEscalation note: ${input.internalNotes}` : "",
      ]);
      await notifyRole(sql, ["admin", "super_admin"], {
        kind: "escalation",
        title: `Verification task escalated: ${listing.title}`,
        body: input.internalNotes ?? "A verifier escalated this record for administrator review.",
        link: `/verify/tasks/${task.id}`,
      });
      break;
    }
  }

  await recordHistory(sql, {
    listingId: listing.id,
    taskId: task.id,
    previous: listing.verification_status,
    next: newStatus,
    action: historyAction,
    method,
    verifierId: input.actorId,
    publicSummary,
    internalNotes: input.internalNotes ?? null,
    sources: input.sources,
  });

  if (input.action !== "escalate") {
    await sql.query("update public.verification_tasks set status = 'completed', completed_at = now(), resolution = $2 where id = $1", [task.id, resolution]);
    if (task.correction_id) {
      await sql.query("update public.community_corrections set status = 'resolved', resolved_by = $2, resolved_at = now() where id = $1", [task.correction_id, input.actorId]);
    }
  }

  // Contact provenance: a successful verification refreshes last-verified dates.
  if (input.action === "verify") {
    await sql.query(
      `update public.organization_contacts set last_verified_at = now(), verified_by = $2, status = 'active',
         confidence = case when $3 in ('phone_confirmation', 'provider_confirmation', 'email_confirmation') then 'high' else confidence end
       where organization_id = app.listing_organization($1)`,
      [listing.id, input.actorId, method],
    );
  }

  await audit(sql, {
    actorId: input.actorId,
    action: input.action === "escalate" ? "verification.escalated" : "verification.changed",
    entityType: "listing",
    entityId: listing.id,
    entityLabel: listing.title,
    previous: { verification_status: listing.verification_status },
    next: { verification_status: newStatus, action: input.action, method },
    metadata: { task_id: task.id, reason: task.reason },
  });

  return { listingId: listing.id, newStatus, emails };
}

/** Admin: directly set a listing's verification status (with history + audit). */
export async function setVerificationStatus(
  sql: SqlClient,
  input: { listingId: string; status: string; actorId: string; method?: VerificationMethod | null; publicSummary?: string | null; internalNotes?: string | null },
) {
  const allowed = ["unverified", "pending_review", "verified", "needs_update", "unable_to_verify", "archived"];
  if (!allowed.includes(input.status)) throw new UserFacingError("Choose a valid verification status.");
  const [listing] = await sql.query<{ title: string; verification_status: string }>("select title, verification_status from public.listings where id = $1 for update", [input.listingId]);
  if (!listing) throw new UserFacingError("Record not found.");
  const days = await reviewIntervalDays(sql);
  await sql.query(
    `update public.listings set verification_status = $2,
       last_verified_at = case when $2 = 'verified' then now() else last_verified_at end,
       next_review_at = case when $2 = 'verified' then (now() + make_interval(days => $3))::date else next_review_at end,
       publication_status = case when $2 = 'archived' then 'archived' else publication_status end
     where id = $1`,
    [input.listingId, input.status, days],
  );
  await recordHistory(sql, {
    listingId: input.listingId,
    taskId: null,
    previous: listing.verification_status,
    next: input.status,
    action: input.status === "verified" ? "verified" : "status_change",
    method: input.method ?? null,
    verifierId: input.actorId,
    publicSummary: input.publicSummary ?? (input.method ? PUBLIC_SUMMARY[input.method] : null),
    internalNotes: input.internalNotes ?? null,
  });
  await audit(sql, {
    actorId: input.actorId,
    action: "verification.changed",
    entityType: "listing",
    entityId: input.listingId,
    entityLabel: listing.title,
    previous: { verification_status: listing.verification_status },
    next: { verification_status: input.status },
  });
}
