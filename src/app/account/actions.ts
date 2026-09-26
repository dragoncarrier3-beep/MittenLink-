"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asCurrentUser, assertSignedIn } from "@/lib/auth";
import { parseForm, runAction, zOptionalText, zPhone, zText, type ActionState } from "@/lib/server/action";

const uuid = z.string().uuid();

/** Remove a saved resource (RLS: users can only delete their own rows). */
export async function removeSavedResourceAction(formData: FormData) {
  await assertSignedIn();
  const id = uuid.safeParse(formData.get("listingId"));
  if (id.success) {
    try {
      await asCurrentUser((sql) => sql.query("delete from public.saved_resources where user_id = auth.uid() and listing_id = $1", [id.data]));
    } catch (err) {
      console.error("[account] remove saved resource failed", err);
      redirect("/account/saved?error=1");
    }
  }
  revalidatePath("/account/saved");
  revalidatePath("/account");
  redirect("/account/saved?removed=1");
}

/** Delete a saved search (RLS: own rows only). */
export async function deleteSavedSearchAction(formData: FormData) {
  await assertSignedIn();
  const id = uuid.safeParse(formData.get("searchId"));
  if (id.success) {
    try {
      await asCurrentUser((sql) => sql.query("delete from public.saved_searches where user_id = auth.uid() and id = $1", [id.data]));
    } catch (err) {
      console.error("[account] delete saved search failed", err);
      redirect("/account/searches?error=1");
    }
  }
  revalidatePath("/account/searches");
  revalidatePath("/account");
  redirect("/account/searches?deleted=1");
}

const ProfileSchema = z.object({
  fullName: zText("Full name", 120),
  jobTitle: zOptionalText(120),
  phone: zPhone(),
});

/** Update the signed-in user's own profile (column-level grants + RLS). */
export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await assertSignedIn();
    const parsed = parseForm(ProfileSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { fullName, jobTitle, phone } = parsed.data;
    await asCurrentUser((sql) =>
      sql.query("update public.profiles set full_name = $1, job_title = $2, phone = $3 where id = auth.uid()", [fullName, jobTitle, phone]),
    );
    revalidatePath("/", "layout");
    return { status: "success", message: "Your profile was updated." };
  });
}
