import "server-only";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth";

export const ACTIVE_ORG_COOKIE = "ml_active_org";

/**
 * The organization a provider is currently managing. Validated against the
 * user's active memberships on every request; falls back to the first one.
 */
export async function getActiveOrganization(user: CurrentUser) {
  if (user.organizations.length === 0) return null;
  const store = await cookies();
  const wanted = store.get(ACTIVE_ORG_COOKIE)?.value;
  return user.organizations.find((o) => o.id === wanted) ?? user.organizations[0];
}
