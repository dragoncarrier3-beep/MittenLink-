"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { asPublic, asService } from "@/lib/db";
import { parseForm, runAction, zOptionalEmail, zText, UserFacingError, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifications";
import { track } from "@/lib/server/analytics";
import { CORRECTION_ISSUE_LABELS } from "@/lib/labels";

const ISSUE_TYPES = ["phone", "email", "website", "address", "hours", "services", "eligibility", "closed", "other"] as const;

const CorrectionSchema = z.object({
  listingId: z.string().uuid("This record could not be found."),
  issueType: z.enum(ISSUE_TYPES, { error: "Choose what is wrong." }),
  details: zText("Details", 4000),
  email: zOptionalEmail(),
});

export async function submitCorrectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const limited = await rateLimit("correction", 6, 10 * 60_000);
    if (!limited.ok) {
      return { status: "error", message: `You've sent several reports in a short time. Please wait ${limited.retryAfterSeconds} seconds and try again.` };
    }
    const parsed = parseForm(CorrectionSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { listingId, issueType, details, email } = parsed.data;

    const [listing] = await asPublic((sql) =>
      sql.query<{ id: string; title: string; kind: string }>("select id, title, kind from public.listings where id = $1 and publication_status = 'published'", [listingId]),
    );
    if (!listing) throw new UserFacingError("This record is no longer available, so we couldn't attach your report to it.");

    const user = await getCurrentUser();
    const correctionId = randomUUID();
    // Insert as the visitor (RLS "corrections submit" policy applies). No RETURNING:
    // anonymous visitors intentionally cannot read corrections back.
    await asCurrentUser((sql) =>
      sql.query(
        `insert into public.community_corrections (id, listing_id, issue_type, details, submitter_user_id, submitter_email, status)
         values ($1, $2, $3, $4, $5, $6, 'new')`,
        [correctionId, listing.id, issueType, details, user?.id ?? null, email],
      ),
    );

    // Queue the correction for the verification team (privileged workflow table).
    const priority = issueType === "closed" || issueType === "phone" ? "high" : "normal";
    try {
      await asService(async (sql) => {
        await sql.query(
          `insert into public.verification_tasks (listing_id, reason, priority, status, correction_id, details, due_at)
           values ($1, 'community_correction', $2, 'open', $3, $4, current_date + $5::int)`,
          [listing.id, priority, correctionId, `Community correction — ${CORRECTION_ISSUE_LABELS[issueType]}: ${details.slice(0, 500)}`, priority === "high" ? 3 : 10],
        );
        await audit(sql, {
          actorId: user?.id ?? null,
          actorLabel: user ? null : "Community member (anonymous)",
          action: "correction.submitted",
          entityType: "community_correction",
          entityId: correctionId,
          entityLabel: listing.title,
          next: { issue_type: issueType, listing_id: listing.id, priority },
        });
        if (user) {
          await notify(sql, {
            userId: user.id,
            kind: "correction_received",
            title: "Thanks for your correction.",
            body: `A verifier will review your report about ${listing.title}.`,
            link: "/account/reports",
          });
        }
      }, user?.id ?? null);
    } catch (err) {
      // The correction itself is saved and appears in the staff queue; log the follow-up failure.
      console.error("[report] correction saved but task creation failed", err);
    }

    await track("correction_submitted", { listingId: listing.id, properties: { issue_type: issueType } });
    return {
      status: "success",
      message: "Thank you — your report was received.",
      data: { title: listing.title, signedIn: !!user },
    };
  });
}
