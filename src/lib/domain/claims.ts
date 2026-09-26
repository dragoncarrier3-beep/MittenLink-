import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify, notifyRole } from "@/lib/server/notifications";
import { UserFacingError } from "@/lib/server/action";

/*
 * Provider claim workflow:
 *   draft → submitted → under_review → (more_info_required ↔ submitted) → approved | rejected
 * Approval grants provider management access (provider_members + provider role).
 */

export type ClaimDecision = "under_review" | "more_info_required" | "approved" | "rejected";

export interface ClaimInput {
  organizationId: string;
  userId: string;
  relationship: "owner" | "executive" | "staff" | "board_member" | "authorized_representative";
  claimantName: string;
  claimantTitle: string;
  workEmail: string;
  workPhone?: string | null;
  verificationDetails: string;
  evidenceUrl?: string | null;
  submit: boolean; // false = save draft
}

/** Create or update the user's claim for an organization. Service transaction. */
export async function saveClaim(sql: SqlClient, input: ClaimInput) {
  const [org] = await sql.query<{ title: string; publication_status: string }>(
    "select l.title, l.publication_status from public.listings l join public.organizations o on o.id = l.id where l.id = $1",
    [input.organizationId],
  );
  if (!org || org.publication_status === "archived") throw new UserFacingError("This organization is not available to claim.");

  const [member] = await sql.query("select 1 from public.provider_members where organization_id = $1 and user_id = $2 and status = 'active'", [input.organizationId, input.userId]);
  if (member) throw new UserFacingError("You already manage this organization.");

  const existing = await sql.query<{ id: string; status: string }>(
    "select id, status from public.provider_claims where organization_id = $1 and claimant_user_id = $2 and status in ('draft', 'submitted', 'under_review', 'more_info_required') order by created_at desc limit 1",
    [input.organizationId, input.userId],
  );
  const current = existing[0];
  if (current && ["submitted", "under_review"].includes(current.status)) {
    throw new UserFacingError("You already have a claim in review for this organization. We'll notify you when it's reviewed.");
  }
  const status = input.submit ? "submitted" : "draft";
  const values = [
    input.relationship,
    input.claimantName,
    input.claimantTitle,
    input.workEmail,
    input.workPhone ?? null,
    input.verificationDetails,
    input.evidenceUrl ?? null,
    status,
  ];
  let claimId: string;
  if (current) {
    await sql.query(
      `update public.provider_claims set relationship = $1, claimant_name = $2, claimant_title = $3, work_email = $4, work_phone = $5,
         verification_details = $6, evidence_url = $7, status = $8, submitted_at = case when $8 = 'submitted' then now() else submitted_at end
       where id = $9`,
      [...values, current.id],
    );
    claimId = current.id;
  } else {
    const [row] = await sql.query<{ id: string }>(
      `insert into public.provider_claims (relationship, claimant_name, claimant_title, work_email, work_phone, verification_details, evidence_url, status,
         organization_id, claimant_user_id, submitted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, case when $8 = 'submitted' then now() end) returning id`,
      [...values, input.organizationId, input.userId],
    );
    claimId = row.id;
  }

  if (input.submit) {
    await notifyRole(sql, ["admin", "super_admin"], {
      kind: "claim_submitted",
      title: `New provider claim: ${org.title}`,
      body: `${input.claimantName} (${input.claimantTitle}) submitted a claim.`,
      link: `/admin/claims/${claimId}`,
    });
    await notify(sql, {
      userId: input.userId,
      kind: "claim_submitted",
      title: "Your provider claim was submitted.",
      body: `We'll review your claim for ${org.title} and notify you of the decision.`,
      link: "/account/claims",
    });
    await audit(sql, {
      actorId: input.userId,
      action: "claim.submitted",
      entityType: "provider_claim",
      entityId: claimId,
      entityLabel: org.title,
      previous: current ? { status: current.status } : null,
      next: { status: "submitted" },
    });
  }
  return { claimId, status };
}

/** Admin review decision. Service transaction; caller must be an admin. */
export async function reviewClaim(
  sql: SqlClient,
  input: { claimId: string; decision: ClaimDecision; adminId: string; messageToClaimant?: string | null; internalNote?: string | null },
) {
  const [claim] = await sql.query<{
    id: string; organization_id: string; claimant_user_id: string; status: string; claimant_name: string; relationship: string; work_email: string;
  }>("select * from public.provider_claims where id = $1 for update", [input.claimId]);
  if (!claim) throw new UserFacingError("This claim no longer exists.");
  if (["approved", "rejected", "draft"].includes(claim.status)) throw new UserFacingError("This claim can no longer be changed.");
  if ((input.decision === "more_info_required" || input.decision === "rejected") && !input.messageToClaimant?.trim()) {
    throw new UserFacingError("Add a message for the claimant explaining the decision.", { messageToClaimant: "A message is required." });
  }
  const [org] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [claim.organization_id]);

  await sql.query(
    "update public.provider_claims set status = $2, message_to_claimant = coalesce($3, message_to_claimant), reviewed_by = $4, reviewed_at = now() where id = $1",
    [claim.id, input.decision, input.messageToClaimant?.trim() || null, input.adminId],
  );
  if (input.internalNote?.trim()) {
    await sql.query("insert into public.internal_notes (entity_type, entity_id, body, author_id) values ('claim', $1, $2, $3)", [claim.id, input.internalNote.trim(), input.adminId]);
  }

  const emails: (() => Promise<boolean>)[] = [];
  if (input.decision === "approved") {
    await sql.query(
      `insert into public.provider_members (organization_id, user_id, member_role, status, granted_via_claim_id, granted_by)
       values ($1, $2, $3, 'active', $4, $5)
       on conflict (organization_id, user_id) do update set status = 'active', granted_via_claim_id = excluded.granted_via_claim_id, granted_by = excluded.granted_by`,
      [claim.organization_id, claim.claimant_user_id, claim.relationship === "owner" || claim.relationship === "executive" ? "owner" : "manager", claim.id, input.adminId],
    );
    await sql.query("insert into public.user_roles (user_id, role_key, granted_by) values ($1, 'provider', $2) on conflict do nothing", [claim.claimant_user_id, input.adminId]);
    await sql.query("update public.organizations set claimed_at = coalesce(claimed_at, now()) where id = $1", [claim.organization_id]);
    await sql.query("update public.outreach_contacts set status = 'claimed', updated_at = now() where organization_id = $1 and status in ('claim_invited', 'responded', 'outreach_sent', 'follow_up_needed', 'not_contacted')", [claim.organization_id]);
    emails.push(
      await notify(sql, {
        userId: claim.claimant_user_id,
        kind: "claim_approved",
        title: "Your provider claim has been approved.",
        body: `You can now manage ${org?.title ?? "your organization"} from your Provider Dashboard. Changes to public information are reviewed before publishing.`,
        link: "/provider",
        email: true,
      }),
    );
  } else {
    const titles: Record<string, string> = {
      under_review: "Your provider claim is under review.",
      more_info_required: "More information is needed for your provider claim.",
      rejected: "Your provider claim was not approved.",
    };
    emails.push(
      await notify(sql, {
        userId: claim.claimant_user_id,
        kind: `claim_${input.decision}`,
        title: titles[input.decision],
        body: input.messageToClaimant ?? `An administrator is reviewing your claim for ${org?.title}.`,
        link: "/account/claims",
        email: input.decision !== "under_review",
      }),
    );
  }

  const actionName: Record<ClaimDecision, string> = {
    under_review: "claim.status_changed",
    more_info_required: "claim.more_info_requested",
    approved: "claim.approved",
    rejected: "claim.rejected",
  };
  await audit(sql, {
    actorId: input.adminId,
    action: actionName[input.decision],
    entityType: "provider_claim",
    entityId: claim.id,
    entityLabel: org?.title ?? null,
    previous: { status: claim.status },
    next: { status: input.decision, ...(input.decision === "approved" ? { granted_access_to: claim.claimant_user_id } : {}) },
  });
  return { emails };
}
