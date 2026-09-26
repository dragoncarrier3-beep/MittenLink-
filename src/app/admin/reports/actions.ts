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

const Schema = z.object({
  reportId: z.string().uuid(),
  intent: z.enum(["under_review", "approved", "rejected", "needs_clarification"], { error: "Choose a decision." }),
  moderationMessage: zOptionalText(2000),
});

const TITLES: Record<string, string> = {
  under_review: "Your family experience report is under review.",
  approved: "Your family experience report was approved.",
  rejected: "Your family experience report could not be published.",
  needs_clarification: "We have a question about your family experience report.",
};

/** Moderate a family experience report. Only approved reports with publish permission appear publicly. */
export async function moderateReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const { reportId, intent, moderationMessage } = parsed.data;
    if ((intent === "rejected" || intent === "needs_clarification") && !moderationMessage) {
      throw new UserFacingError("Add a message for the person who submitted the report.", { moderationMessage: "A message is required for this decision." });
    }

    const emails = await asService(async (sql) => {
      const [r] = await sql.query<{ id: string; status: string; submitted_by: string | null; publish_anonymously: boolean; org_title: string }>(
        `select r.id, r.status, r.submitted_by, r.publish_anonymously, l.title as org_title
         from family_experience_reports r join listings l on l.id = r.organization_id where r.id = $1 for update of r`,
        [reportId],
      );
      if (!r) throw new UserFacingError("This report no longer exists.");
      if (r.status === intent) throw new UserFacingError("The report already has this status.");
      const publish = intent === "approved" && r.publish_anonymously;
      await sql.query(
        `update family_experience_reports set status = $2, moderator_id = $3, moderated_at = now(),
           moderation_message = coalesce($4, moderation_message),
           published_at = case when $5 then coalesce(published_at, now()) else null end
         where id = $1`,
        [r.id, intent, user.id, moderationMessage, publish],
      );
      const senders: (() => Promise<boolean>)[] = [];
      if (r.submitted_by) {
        const body =
          moderationMessage ??
          (intent === "approved"
            ? publish
              ? `Thank you. Your report about ${r.org_title} is now published anonymously.`
              : `Thank you. Your report about ${r.org_title} was reviewed. Because you did not give permission to publish, it will not appear publicly.`
            : `Thank you for sharing your experience with ${r.org_title}. A moderator is reviewing your report.`);
        senders.push(
          await notify(sql, {
            userId: r.submitted_by,
            kind: `report_${intent}`,
            title: TITLES[intent],
            body,
            link: "/account/reports",
            email: intent !== "under_review",
          }),
        );
      }
      await audit(sql, {
        actorId: user.id,
        action: "family_report.moderated",
        entityType: "family_experience_report",
        entityId: r.id,
        entityLabel: r.org_title,
        previous: { status: r.status },
        next: { status: intent, published: publish },
      });
      return senders;
    }, user.id);

    const warning = await deliverAfterCommit(emails);
    revalidateStaffViews("/admin/reports", `/admin/reports/${reportId}`);
    redirect(doneUrl(`/admin/reports/${reportId}`, intent, warning));
  });
}
