"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { parseForm, runAction, UserFacingError, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl } from "@/components/staff/result";

const Schema = z.object({
  correctionId: z.string().uuid(),
  intent: z.enum(["in_review", "dismiss", "create_task"]),
  returnTo: z.string().optional(),
});

/** Community correction moderation: mark in review, dismiss, or open a verification task. */
export async function correctionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const { correctionId, intent } = parsed.data;
    let taskId: string | null = null;

    await asService(async (sql) => {
      const [c] = await sql.query<{ id: string; listing_id: string; status: string; issue_type: string; details: string; title: string }>(
        `select cc.id, cc.listing_id, cc.status, cc.issue_type, cc.details, l.title from community_corrections cc join listings l on l.id = cc.listing_id
         where cc.id = $1 for update of cc`,
        [correctionId],
      );
      if (!c) throw new UserFacingError("This correction no longer exists.");
      if (["resolved", "dismissed"].includes(c.status)) throw new UserFacingError("This correction has already been closed.");

      if (intent === "in_review") {
        if (c.status === "in_review") throw new UserFacingError("This correction is already in review.");
        await sql.query("update community_corrections set status = 'in_review' where id = $1", [c.id]);
      } else if (intent === "dismiss") {
        await sql.query("update community_corrections set status = 'dismissed', resolved_by = $2, resolved_at = now() where id = $1", [c.id, user.id]);
        // A task opened only for this correction is no longer needed.
        await sql.query(
          `update verification_tasks set status = 'cancelled', completed_at = now(), resolution = 'Community correction dismissed by an administrator.'
           where correction_id = $1 and change_request_id is null and status in ('open', 'in_progress', 'escalated')`,
          [c.id],
        );
      } else {
        const [existing] = await sql.query<{ id: string }>(
          "select id from verification_tasks where correction_id = $1 and status in ('open', 'in_progress', 'escalated') limit 1",
          [c.id],
        );
        if (existing) throw new UserFacingError("A verification task is already open for this correction.");
        const [t] = await sql.query<{ id: string }>(
          `insert into verification_tasks (listing_id, reason, priority, status, correction_id, details, due_at)
           values ($1, 'community_correction', $2, 'open', $3, $4, current_date + 5) returning id`,
          [c.listing_id, ["closed", "phone", "address"].includes(c.issue_type) ? "high" : "normal", c.id, `Community correction: ${c.details.slice(0, 300)}`],
        );
        taskId = t.id;
        if (c.status === "new") await sql.query("update community_corrections set status = 'in_review' where id = $1", [c.id]);
      }
      await audit(sql, {
        actorId: user.id,
        action: intent === "in_review" ? "correction.in_review" : intent === "dismiss" ? "correction.dismissed" : "correction.task_created",
        entityType: "community_correction",
        entityId: c.id,
        entityLabel: c.title,
        previous: { status: c.status },
        next: { status: intent === "dismiss" ? "dismissed" : "in_review", ...(taskId ? { task_id: taskId } : {}) },
      });
    }, user.id);

    revalidateStaffViews("/admin/corrections");
    const back = parsed.data.returnTo?.startsWith("/admin/corrections") ? parsed.data.returnTo : "/admin/corrections";
    redirect(doneUrl(back, intent));
  });
}
