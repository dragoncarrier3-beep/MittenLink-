import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifications";
import { UserFacingError } from "@/lib/server/action";

/**
 * Staff-side hook for moderated listing media (Enhanced logos).
 * Call inside asService AFTER checking the reviewer is staff
 * (assertRole("verifier", "admin", "super_admin")).
 *
 * Approving a logo publishes it: organizations.logo_path / logo_alt are set
 * and any previously approved logo is retired. The related open
 * verification task (reason 'provider_update', details mention the media id)
 * is completed. Returns the deferred email sender for deliverAfterCommit().
 */
export async function reviewOrganizationMedia(
  sql: SqlClient,
  input: { mediaId: string; reviewerId: string; decision: "approved" | "rejected"; message?: string | null },
) {
  const [media] = await sql.query<{ id: string; organization_id: string; kind: string; storage_path: string; alt_text: string; status: string; created_by: string | null }>(
    "select id, organization_id, kind, storage_path, alt_text, status, created_by from public.organization_media where id = $1 for update",
    [input.mediaId],
  );
  if (!media) throw new UserFacingError("This upload no longer exists.");
  if (media.status !== "pending_review") throw new UserFacingError("This upload has already been reviewed.");

  await sql.query("update public.organization_media set status = $2 where id = $1", [media.id, input.decision]);
  if (input.decision === "approved" && media.kind === "logo") {
    await sql.query(
      "update public.organization_media set status = 'rejected' where organization_id = $1 and kind = 'logo' and status = 'approved' and id <> $2",
      [media.organization_id, media.id],
    );
    await sql.query("update public.organizations set logo_path = $2, logo_alt = $3 where id = $1", [media.organization_id, media.storage_path, media.alt_text]);
  }
  await sql.query(
    `update public.verification_tasks set status = 'completed', completed_at = now(), resolution = $3
     where listing_id = $1 and reason = 'provider_update' and status in ('open', 'in_progress', 'escalated') and details like '%' || $2 || '%'`,
    [media.organization_id, media.id, input.decision === "approved" ? "Logo approved and published." : "Logo not approved."],
  );
  const [org] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [media.organization_id]);
  let sendEmail: () => Promise<boolean> = async () => true;
  if (media.created_by) {
    sendEmail = await notify(sql, {
      userId: media.created_by,
      kind: input.decision === "approved" ? "media_approved" : "media_rejected",
      title: input.decision === "approved" ? "Your new logo was approved." : "Your new logo was not approved.",
      body: input.message ?? (input.decision === "approved" ? `The logo now appears on the ${org?.title ?? "organization"} listing.` : "Please review the logo guidelines and upload a new file."),
      link: "/provider/organization#logo",
      email: true,
    });
  }
  await audit(sql, {
    actorId: input.reviewerId,
    action: input.decision === "approved" ? "provider_media.approved" : "provider_media.rejected",
    entityType: "organization_media",
    entityId: media.id,
    entityLabel: `${org?.title ?? ""} — logo`,
    previous: { status: media.status },
    next: { status: input.decision },
    metadata: { organization_id: media.organization_id, message: input.message ?? null },
  });
  return { sendEmail, organizationId: media.organization_id };
}
