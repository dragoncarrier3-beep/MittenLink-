"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { deliverAfterCommit, notify } from "@/lib/server/notifications";
import { parseForm, runAction, UserFacingError, zOptionalText, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl } from "@/components/staff/result";

const RejectSchema = z.object({
  listingId: z.string().uuid(),
  message: zOptionalText(2000),
});

/** Reject a new provider submission: archive it, cancel its tasks, notify the submitter. */
export async function rejectSubmissionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(RejectSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { listingId, message } = parsed.data;

    const emails = await asService(async (sql) => {
      const [listing] = await sql.query<{ title: string; publication_status: string; verification_status: string; created_by: string | null }>(
        "select title, publication_status, verification_status, created_by from listings where id = $1 for update",
        [listingId],
      );
      if (!listing) throw new UserFacingError("This submission no longer exists.");
      if (listing.publication_status !== "pending") throw new UserFacingError("Only pending submissions can be rejected here.");

      await sql.query("update listings set publication_status = 'archived', verification_status = 'archived' where id = $1", [listingId]);
      // Records created alongside the organization (e.g. its services) are archived too.
      await sql.query(
        `update listings l set publication_status = 'archived', verification_status = 'archived'
         where l.publication_status = 'pending' and l.id <> $1 and app.listing_organization(l.id) = $1`,
        [listingId],
      );
      await sql.query(
        `update verification_tasks set status = 'cancelled', completed_at = now(), resolution = 'Submission rejected by an administrator.'
         where status in ('open', 'in_progress', 'escalated') and (listing_id = $1 or app.listing_organization(listing_id) = $1)`,
        [listingId],
      );
      await sql.query(
        `insert into verification_history (listing_id, previous_status, new_status, action, verifier_id, internal_notes)
         values ($1, $2, 'archived', 'status_change', $3, $4)`,
        [listingId, listing.verification_status, user.id, `Submission rejected.${message ? ` Message to submitter: ${message}` : ""}`],
      );
      const senders: (() => Promise<boolean>)[] = [];
      if (listing.created_by) {
        senders.push(
          await notify(sql, {
            userId: listing.created_by,
            kind: "submission_rejected",
            title: `Your submission “${listing.title}” was not added to MittenLink.`,
            body: message ?? "After review, this submission was not added to the directory. You are welcome to contact MittenLink with questions.",
            link: "/account",
            email: true,
          }),
        );
      }
      await audit(sql, {
        actorId: user.id,
        action: "submission.rejected",
        entityType: "listing",
        entityId: listingId,
        entityLabel: listing.title,
        previous: { publication_status: listing.publication_status, verification_status: listing.verification_status },
        next: { publication_status: "archived", verification_status: "archived" },
        metadata: { message: message ?? null },
      });
      return senders;
    }, user.id);

    const warning = await deliverAfterCommit(emails);
    revalidateStaffViews("/admin/submissions");
    redirect(doneUrl("/admin/submissions", "rejected", warning));
  });
}

const CommunitySchema = z.object({
  submissionId: z.string().uuid(),
  intent: z.enum(["reviewed", "dismissed", "added_to_source_watch"]),
  returnTo: z.string().optional(),
});

/** Update a community submission (resource suggestion / unmet need). */
export async function communitySubmissionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(CommunitySchema, formData);
    if (!parsed.ok) return parsed.state;
    const { submissionId, intent } = parsed.data;

    await asService(async (sql) => {
      const [s] = await sql.query<{ id: string; kind: string; name: string | null; url: string | null; description: string; city: string | null; county_id: number | null; category_id: number | null; status: string }>(
        "select id, kind, name, url, description, city, county_id, category_id, status from community_submissions where id = $1 for update",
        [submissionId],
      );
      if (!s) throw new UserFacingError("This submission no longer exists.");
      if (s.status === intent) throw new UserFacingError("This submission already has that status.");
      if (s.status === "added_to_source_watch") throw new UserFacingError("This submission was already added to Source Watch.");
      let candidateId: string | null = null;
      if (intent === "added_to_source_watch") {
        const name = (s.name?.trim() || s.description.trim().split(/[.\n]/)[0] || "Community suggestion").slice(0, 160);
        const [c] = await sql.query<{ id: string }>(
          `insert into source_watch_candidates (name, url, suggested_category_id, possible_city, possible_county_id, excerpt, suggestion_engine, status)
           values ($1, $2, $3, $4, $5, $6, null, 'new') returning id`,
          [name, s.url, s.category_id, s.city, s.county_id, s.description.slice(0, 1000)],
        );
        candidateId = c.id;
      }
      await sql.query("update community_submissions set status = $2 where id = $1", [submissionId, intent]);
      await audit(sql, {
        actorId: user.id,
        action: intent === "added_to_source_watch" ? "community_submission.added_to_source_watch" : `community_submission.${intent}`,
        entityType: "community_submission",
        entityId: submissionId,
        entityLabel: s.name ?? s.description.slice(0, 80),
        previous: { status: s.status },
        next: { status: intent, ...(candidateId ? { source_watch_candidate_id: candidateId } : {}) },
      });
    }, user.id);

    revalidateStaffViews("/admin/submissions");
    const back = parsed.data.returnTo?.startsWith("/admin/submissions") ? parsed.data.returnTo : "/admin/submissions";
    redirect(doneUrl(back, `community_${intent}`));
  });
}
