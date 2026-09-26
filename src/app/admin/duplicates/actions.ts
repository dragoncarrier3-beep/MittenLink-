"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { runDuplicateScan } from "@/lib/domain/dedupe";
import { mergeOrganizations } from "@/lib/domain/merge";
import { audit } from "@/lib/server/audit";
import { parseForm, runAction, UserFacingError, zCheckbox, type ActionState } from "@/lib/server/action";
import { revalidateStaffViews } from "@/lib/data/staff";
import { doneUrl } from "@/components/staff/result";

/** Run the duplicate detector over published and pending organizations. */
export async function scanDuplicatesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const result = await asService((sql) => runDuplicateScan(sql, user.id), user.id);
    revalidateStaffViews("/admin/duplicates");
    redirect(doneUrl("/admin/duplicates", "scan", null, { n: String(result.created) }));
  });
}

const MergeSchema = z.object({
  suggestionId: z.string().uuid(),
  survivor: z.string({ error: "Choose which record to keep." }).uuid("Choose which record to keep."),
  acknowledge: zCheckbox(),
});

/** Merge the two records of a suggestion after explicit confirmation. */
export async function mergeDuplicateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(MergeSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { suggestionId, survivor, acknowledge } = parsed.data;
    if (!acknowledge) {
      throw new UserFacingError("Please confirm you understand what merging does.", { acknowledge: "Check this box to confirm the merge." });
    }
    await asService(async (sql) => {
      const [s] = await sql.query<{ listing_a: string; listing_b: string; status: string }>(
        "select listing_a, listing_b, status from duplicate_suggestions where id = $1 for update",
        [suggestionId],
      );
      if (!s) throw new UserFacingError("This suggestion no longer exists.");
      if (s.status !== "open") throw new UserFacingError("This suggestion has already been resolved.");
      if (survivor !== s.listing_a && survivor !== s.listing_b) throw new UserFacingError("Choose one of the two records to keep.", { survivor: "Choose one of the two records." });
      const mergedId = survivor === s.listing_a ? s.listing_b : s.listing_a;
      await mergeOrganizations(sql, { survivorId: survivor, mergedId, actorId: user.id, suggestionId });
    }, user.id);
    revalidateStaffViews("/admin/duplicates", `/admin/duplicates/${suggestionId}`);
    redirect(doneUrl(`/admin/duplicates/${suggestionId}`, "merged"));
  });
}

const ResolveSchema = z.object({
  suggestionId: z.string().uuid(),
  intent: z.enum(["kept_separate", "ignored"]),
});

/** Keep both records, or ignore the suggestion. */
export async function resolveSuggestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(ResolveSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { suggestionId, intent } = parsed.data;
    await asService(async (sql) => {
      const [s] = await sql.query<{ status: string; a_title: string; b_title: string }>(
        `select d.status, la.title as a_title, lb.title as b_title from duplicate_suggestions d
         join listings la on la.id = d.listing_a join listings lb on lb.id = d.listing_b where d.id = $1 for update of d`,
        [suggestionId],
      );
      if (!s) throw new UserFacingError("This suggestion no longer exists.");
      if (s.status !== "open") throw new UserFacingError("This suggestion has already been resolved.");
      await sql.query("update duplicate_suggestions set status = $2, resolved_by = $3, resolved_at = now() where id = $1", [suggestionId, intent, user.id]);
      await audit(sql, {
        actorId: user.id,
        action: intent === "kept_separate" ? "duplicate.kept_separate" : "duplicate.ignored",
        entityType: "duplicate_suggestion",
        entityId: suggestionId,
        entityLabel: `${s.a_title} / ${s.b_title}`,
        previous: { status: "open" },
        next: { status: intent },
      });
    }, user.id);
    revalidateStaffViews("/admin/duplicates");
    redirect(doneUrl("/admin/duplicates", intent));
  });
}
