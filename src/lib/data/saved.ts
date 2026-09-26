import "server-only";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";

/** Which of the given listings the signed-in member has saved (empty when signed out). */
export async function getSavedState(ids: string[]): Promise<{ signedIn: boolean; savedIds: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false, savedIds: [] };
  if (!ids.length) return { signedIn: true, savedIds: [] };
  try {
    const rows = await asCurrentUser((sql) =>
      sql.query<{ listing_id: string }>("select listing_id from public.saved_resources where listing_id = any ($1::uuid[])", [ids]),
    );
    return { signedIn: true, savedIds: rows.map((r) => r.listing_id) };
  } catch (err) {
    console.warn("[saved] could not load saved state", err instanceof Error ? err.message : err);
    return { signedIn: true, savedIds: [] };
  }
}
