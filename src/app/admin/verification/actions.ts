"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifications";
import { parseForm, runAction, UserFacingError, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl, safeReturn } from "@/components/staff/result";

const AssignSchema = z.object({
  taskId: z.string().uuid(),
  assignee: z.string().trim(),
  returnTo: z.string().optional(),
});

/** Admin: assign a verification task to a verifier/admin (or unassign). */
export async function adminAssignTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(AssignSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { taskId, assignee } = parsed.data;
    const assigneeId = assignee === "" || assignee === "unassigned" ? null : assignee;
    if (assigneeId && !/^[0-9a-f-]{36}$/i.test(assigneeId)) throw new UserFacingError("Choose a team member.");

    await asService(async (sql) => {
      const [task] = await sql.query<{ status: string; assigned_to: string | null; title: string }>(
        `select vt.status, vt.assigned_to, l.title from verification_tasks vt join listings l on l.id = vt.listing_id where vt.id = $1 for update of vt`,
        [taskId],
      );
      if (!task) throw new UserFacingError("This verification task no longer exists.");
      if (["completed", "cancelled"].includes(task.status)) throw new UserFacingError("This task has already been resolved.");
      if (assigneeId) {
        const [staff] = await sql.query(
          `select 1 from profiles p join user_roles ur on ur.user_id = p.id where p.id = $1 and p.is_active and ur.role_key in ('verifier', 'admin', 'super_admin') limit 1`,
          [assigneeId],
        );
        if (!staff) throw new UserFacingError("That person is not an active verifier or administrator.");
      }
      if (task.assigned_to === assigneeId) return;
      // Assigning an escalated task hands it back to the team as open work.
      const status = task.status === "escalated" && assigneeId ? "open" : task.status === "in_progress" && !assigneeId ? "open" : task.status;
      await sql.query("update verification_tasks set assigned_to = $2, status = $3 where id = $1", [taskId, assigneeId, status]);
      if (assigneeId && assigneeId !== user.id) {
        await notify(sql, {
          userId: assigneeId,
          kind: "task_assigned",
          title: `Verification task assigned: ${task.title}`,
          body: "An administrator assigned this task to you.",
          link: `/verify/tasks/${taskId}`,
        });
      }
      await audit(sql, {
        actorId: user.id,
        action: assigneeId ? "verification.task_assigned" : "verification.task_unassigned",
        entityType: "verification_task",
        entityId: taskId,
        entityLabel: task.title,
        previous: { assigned_to: task.assigned_to, status: task.status },
        next: { assigned_to: assigneeId, status },
      });
    }, user.id);

    revalidateStaffViews(`/verify/tasks/${taskId}`);
    redirect(doneUrl(safeReturn(parsed.data.returnTo, "/admin/verification", ["/admin/verification"]), assigneeId ? "assigned" : "unassigned"));
  });
}

const RenewalSchema = z.object({ listingId: z.string().uuid() });

/** Admin: open a "Due for Review" task for a verified listing approaching its review date. */
export async function createRenewalTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(RenewalSchema, formData);
    if (!parsed.ok) return parsed.state;
    await asService(async (sql) => {
      const [listing] = await sql.query<{ title: string; next_review_at: Date | null }>("select title, next_review_at from listings where id = $1", [parsed.data.listingId]);
      if (!listing) throw new UserFacingError("This record no longer exists.");
      const [existing] = await sql.query("select 1 from verification_tasks where listing_id = $1 and status in ('open', 'in_progress', 'escalated') limit 1", [parsed.data.listingId]);
      if (existing) throw new UserFacingError("This record already has an open verification task.");
      const [task] = await sql.query<{ id: string }>(
        `insert into verification_tasks (listing_id, reason, priority, status, details, due_at)
         values ($1, 'due_for_review', 'normal', 'open', 'Scheduled verification renewal.', coalesce($2::date, current_date + 7)) returning id`,
        [parsed.data.listingId, listing.next_review_at],
      );
      await audit(sql, {
        actorId: user.id,
        action: "verification.task_created",
        entityType: "verification_task",
        entityId: task.id,
        entityLabel: listing.title,
        next: { reason: "due_for_review" },
      });
    }, user.id);
    revalidateStaffViews();
    redirect(doneUrl("/admin/verification", "renewal_created"));
  });
}
