"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/server/analytics";
import { parseForm, runAction, zText, type ActionState } from "@/lib/server/action";
import { parseSearchParams, toQueryString } from "@/lib/search/params";

export type ToggleSavedResult = { ok: true; saved: boolean; message: string } | { ok: false; message: string; signInRequired?: boolean };

/**
 * Save or un-save a listing for the signed-in member. Runs as the member
 * (RLS: saved_resources rows are only visible/writable by their owner).
 */
export async function toggleSavedResource(listingId: string): Promise<ToggleSavedResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, signInRequired: true, message: "Please sign in to save resources." };
  if (!z.string().uuid().safeParse(listingId).success) return { ok: false, message: "We couldn't find that resource." };
  try {
    const result = await asCurrentUser(async (sql) => {
      const [listing] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [listingId]);
      if (!listing) return null;
      const removed = await sql.query("delete from public.saved_resources where user_id = $1 and listing_id = $2 returning listing_id", [user.id, listingId]);
      if (removed.length) return { saved: false, title: listing.title };
      await sql.query("insert into public.saved_resources (user_id, listing_id) values ($1, $2) on conflict do nothing", [user.id, listingId]);
      return { saved: true, title: listing.title };
    });
    if (!result) return { ok: false, message: "We couldn't find that resource." };
    if (result.saved) await track("resource_saved", { listingId });
    revalidatePath("/account", "layout");
    return {
      ok: true,
      saved: result.saved,
      message: result.saved ? `Saved ${result.title} to your account.` : `Removed ${result.title} from your saved resources.`,
    };
  } catch (err) {
    console.error("[saved] toggle failed", err);
    return { ok: false, message: "We couldn't update your saved resources right now. Please try again." };
  }
}

const SaveSearchSchema = z.object({
  name: zText("Search name", 120),
  query: z.string().max(2000).default(""),
});

/** Save the current search (its URL parameters) to the member's account. */
export async function saveSearchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await getCurrentUser();
    if (!user) return { status: "error", message: "Please sign in to save searches." };
    const parsed = parseForm(SaveSearchSchema, formData);
    if (!parsed.ok) return parsed.state;
    // Re-serialize through the whitelist parser so only known parameters are stored.
    const params = parseSearchParams(new URLSearchParams(parsed.data.query));
    const qs = toQueryString(params, { page: 1 });
    const { page: _page, view: _view, ...stored } = params;
    void _page;
    void _view;
    await asCurrentUser((sql) =>
      sql.query("insert into public.saved_searches (user_id, name, params) values ($1, $2, $3::jsonb)", [
        user.id,
        parsed.data.name,
        JSON.stringify({ ...stored, query_string: qs }),
      ]),
    );
    revalidatePath("/account", "layout");
    return { status: "success", message: `Saved "${parsed.data.name}". You can find it in your account.` };
  });
}
