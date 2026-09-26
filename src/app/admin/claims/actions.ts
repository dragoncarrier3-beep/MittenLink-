"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { reviewClaim } from "@/lib/domain/claims";
import { deliverAfterCommit } from "@/lib/server/notifications";
import { parseForm, runAction, zOptionalText, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl } from "@/components/staff/result";

const Schema = z.object({
  claimId: z.string().uuid(),
  intent: z.enum(["under_review", "more_info_required", "approved", "rejected"], { error: "Choose a decision." }),
  messageToClaimant: zOptionalText(2000),
  internalNote: zOptionalText(4000),
});

/** Admin decision on a provider claim. Approval grants provider management access. */
export async function reviewClaimAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const result = await asService(
      (sql) =>
        reviewClaim(sql, {
          claimId: d.claimId,
          decision: d.intent,
          adminId: user.id,
          messageToClaimant: d.messageToClaimant,
          internalNote: d.internalNote,
        }),
      user.id,
    );
    const warning = await deliverAfterCommit(result.emails);
    revalidateStaffViews(`/admin/claims/${d.claimId}`, "/admin/claims");
    redirect(doneUrl(`/admin/claims/${d.claimId}`, d.intent, warning));
  });
}
