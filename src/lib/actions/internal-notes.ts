"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { parseForm, runAction, zText, type ActionState } from "@/lib/server/action";

const NoteSchema = z.object({
  entityType: z.enum(["listing", "claim", "candidate", "gap_flag", "outreach", "change_request", "task", "family_report", "duplicate", "source"]),
  entityId: z.string().uuid(),
  body: zText("Note", 4000),
  revalidate: z.string().startsWith("/").optional(),
});

/** Adds a staff-only internal note to any workflow entity. */
export async function addInternalNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("verifier", "admin", "super_admin");
    const parsed = parseForm(NoteSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { entityType, entityId, body, revalidate } = parsed.data;
    await asService(async (sql) => {
      await sql.query("insert into public.internal_notes (entity_type, entity_id, body, author_id) values ($1, $2, $3, $4)", [entityType, entityId, body, user.id]);
      await audit(sql, { actorId: user.id, action: "internal_note.added", entityType, entityId, metadata: { length: body.length } });
    }, user.id);
    if (revalidate) revalidatePath(revalidate);
    return { status: "success", message: "Internal note added." };
  });
}
