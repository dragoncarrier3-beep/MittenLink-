"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole, isAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { resolveVerificationTask, type SourceChecked, type VerificationAction } from "@/lib/domain/verification";
import { audit } from "@/lib/server/audit";
import { deliverAfterCommit } from "@/lib/server/notifications";
import { parseForm, runAction, UserFacingError, zOptionalText, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl, safeReturn } from "@/components/staff/result";

const METHODS = ["provider_confirmation", "official_website", "government_source", "phone_confirmation", "email_confirmation", "manual_research"] as const;
const SOURCE_TYPES = [...METHODS, "other"] as const;
const MAX_SOURCE_ROWS = 3;

const ResolveSchema = z.object({
  taskId: z.string().uuid(),
  intent: z.enum(["verify", "request_update", "unable_to_verify", "escalate", "reject_change"], { error: "Choose an action." }),
  method: z.preprocess((v) => (v === "" ? undefined : v), z.enum(METHODS, { error: "Choose a verification method." }).optional()),
  publicSummary: zOptionalText(500),
  internalNotes: zOptionalText(4000),
  messageToProvider: zOptionalText(2000),
  returnTo: z.string().optional(),
});

const DONE_CODE: Record<VerificationAction, string> = {
  verify: "verified",
  request_update: "update_requested",
  unable_to_verify: "unable",
  escalate: "escalated",
  reject_change: "rejected",
};

function readSources(formData: FormData): { sources: SourceChecked[]; errors: Record<string, string> } {
  const sources: SourceChecked[] = [];
  const errors: Record<string, string> = {};
  for (let i = 0; i < MAX_SOURCE_ROWS; i++) {
    const type = String(formData.get(`sourceType_${i}`) ?? "").trim();
    const url = String(formData.get(`sourceUrl_${i}`) ?? "").trim();
    const description = String(formData.get(`sourceDescription_${i}`) ?? "").trim().slice(0, 500);
    if (!url && !description) continue;
    if (url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) {
      errors[`sourceUrl_${i}`] = "Enter a full web address starting with https://";
      continue;
    }
    if (url.length > 500) {
      errors[`sourceUrl_${i}`] = "Web address must be 500 characters or fewer.";
      continue;
    }
    const sourceType = (SOURCE_TYPES as readonly string[]).includes(type) ? (type as SourceChecked["sourceType"]) : "other";
    sources.push({ sourceType, url: url || null, description: description || null });
  }
  return { sources, errors };
}

/** Resolve a verification task: verify / request update / unable / escalate / reject change. */
export async function resolveTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("verifier", "admin", "super_admin");
    const parsed = parseForm(ResolveSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const { sources, errors } = readSources(formData);
    if (d.intent === "escalate" && !d.internalNotes) {
      errors.internalNotes = "Explain why you are escalating this task.";
    }
    if (Object.keys(errors).length) {
      throw new UserFacingError("Please correct the highlighted fields and try again.", errors);
    }

    const result = await asService(async (sql) => {
      const [task] = await sql.query<{ status: string }>("select status from public.verification_tasks where id = $1", [d.taskId]);
      if (!task) throw new UserFacingError("This verification task no longer exists.");
      if (task.status === "escalated" && !isAdmin(user)) {
        throw new UserFacingError("This task was escalated to administrators. An administrator will resolve it.");
      }
      if (task.status === "escalated" && d.intent === "escalate") {
        throw new UserFacingError("This task is already escalated to administrators.");
      }
      return resolveVerificationTask(sql, {
        taskId: d.taskId,
        action: d.intent,
        actorId: user.id,
        method: d.method ?? null,
        sources,
        publicSummary: d.publicSummary,
        internalNotes: d.internalNotes,
        messageToProvider: d.messageToProvider,
      });
    }, user.id);

    const warning = await deliverAfterCommit(result.emails);
    revalidateStaffViews(`/verify/tasks/${d.taskId}`);
    const back = safeReturn(d.returnTo, "/verify");
    redirect(doneUrl(back, DONE_CODE[d.intent], warning));
  });
}

const AssignSchema = z.object({
  taskId: z.string().uuid(),
  intent: z.enum(["assign", "unassign", "start"]),
  returnTo: z.string().optional(),
});

/** "Assign to me", "Unassign", and "Start review" for verification tasks. */
export async function taskAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("verifier", "admin", "super_admin");
    const parsed = parseForm(AssignSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { taskId, intent } = parsed.data;

    await asService(async (sql) => {
      const [task] = await sql.query<{ id: string; status: string; assigned_to: string | null; title: string }>(
        `select vt.id, vt.status, vt.assigned_to, l.title from public.verification_tasks vt join public.listings l on l.id = vt.listing_id
         where vt.id = $1 for update of vt`,
        [taskId],
      );
      if (!task) throw new UserFacingError("This verification task no longer exists.");
      if (["completed", "cancelled"].includes(task.status)) throw new UserFacingError("This task has already been resolved.");
      if (task.status === "escalated" && !isAdmin(user)) throw new UserFacingError("Escalated tasks are handled by administrators.");
      if (intent === "assign" && task.assigned_to && task.assigned_to !== user.id && !isAdmin(user)) {
        throw new UserFacingError("Another team member is already working on this task.");
      }
      if (intent === "unassign" && task.assigned_to !== user.id && !isAdmin(user)) {
        throw new UserFacingError("You can only unassign tasks assigned to you.");
      }
      if (intent === "start" && task.assigned_to && task.assigned_to !== user.id && !isAdmin(user)) {
        throw new UserFacingError("Another team member is already working on this task.");
      }

      const next =
        intent === "assign"
          ? { assigned_to: user.id, status: task.status === "escalated" ? "in_progress" : task.status }
          : intent === "unassign"
            ? { assigned_to: null, status: "open" }
            : { assigned_to: task.assigned_to ?? user.id, status: "in_progress" };
      await sql.query("update public.verification_tasks set assigned_to = $2, status = $3 where id = $1", [taskId, next.assigned_to, next.status]);
      await audit(sql, {
        actorId: user.id,
        action: intent === "start" ? "verification.task_started" : intent === "assign" ? "verification.task_assigned" : "verification.task_unassigned",
        entityType: "verification_task",
        entityId: taskId,
        entityLabel: task.title,
        previous: { assigned_to: task.assigned_to, status: task.status },
        next,
      });
    }, user.id);

    revalidateStaffViews(`/verify/tasks/${taskId}`);
    const back = safeReturn(parsed.data.returnTo, `/verify/tasks/${taskId}`);
    redirect(doneUrl(back, intent === "assign" ? "assigned" : intent === "unassign" ? "unassigned" : "started"));
  });
}
