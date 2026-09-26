import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asService, withActor, type SqlClient } from "@/lib/db";
import { getSessionUserId } from "./provider";

export type RoleKey = "community_member" | "provider" | "verifier" | "admin" | "super_admin";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  isDemo: boolean;
  roles: RoleKey[];
  /** Organizations this user actively manages (provider membership). */
  organizations: { id: string; title: string; slug: string }[];
}

/** Loads the signed-in user once per request (React cache). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  try {
    return await asService(async (sql) => {
      const [profile] = await sql.query<{ id: string; email: string; full_name: string; job_title: string | null; is_demo: boolean; is_active: boolean }>(
        "select id, email, full_name, job_title, is_demo, is_active from public.profiles where id = $1",
        [userId],
      );
      if (!profile || !profile.is_active) return null;
      const roles = await sql.query<{ role_key: RoleKey }>("select role_key from public.user_roles where user_id = $1", [userId]);
      const organizations = await sql.query<{ id: string; title: string; slug: string }>(
        `select l.id, l.title, l.slug from public.provider_members m
         join public.listings l on l.id = m.organization_id
         where m.user_id = $1 and m.status = 'active' order by l.title`,
        [userId],
      );
      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        jobTitle: profile.job_title,
        isDemo: profile.is_demo,
        roles: roles.map((r) => r.role_key),
        organizations,
      };
    });
  } catch (err) {
    console.error("[auth] failed to load current user", err);
    return null;
  }
});

export function hasRole(user: CurrentUser | null, ...roles: RoleKey[]) {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
}
export const isSuperAdmin = (u: CurrentUser | null) => hasRole(u, "super_admin");
export const isAdmin = (u: CurrentUser | null) => hasRole(u, "admin", "super_admin");
export const isStaff = (u: CurrentUser | null) => hasRole(u, "verifier", "admin", "super_admin");
export const isProvider = (u: CurrentUser | null) => !!u && (u.organizations.length > 0 || hasRole(u, "provider"));

/** For pages: redirect to sign-in when signed out. */
export async function requireUser(nextPath = "/account"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** For pages: require one of the roles; otherwise show the not-authorized page. */
export async function requireRole(roles: RoleKey[], nextPath = "/"): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!hasRole(user, ...roles)) redirect("/not-authorized");
  return user;
}

export async function requireStaff(nextPath = "/verify") {
  return requireRole(["verifier", "admin", "super_admin"], nextPath);
}
export async function requireAdmin(nextPath = "/admin") {
  return requireRole(["admin", "super_admin"], nextPath);
}

/** For pages: require that the user manages the given organization (or is an admin). */
export async function requireOrganizationAccess(orgId: string, nextPath = "/provider"): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (isAdmin(user) || user.organizations.some((o) => o.id === orgId)) return user;
  redirect("/not-authorized");
}

/** Error thrown by server actions when authorization fails. */
export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions: returns the user or throws AuthorizationError. */
export async function assertRole(...roles: RoleKey[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  if (roles.length && !hasRole(user, ...roles)) throw new AuthorizationError();
  return user;
}

export async function assertSignedIn(): Promise<CurrentUser> {
  return assertRole();
}

export async function assertOrganizationAccess(orgId: string): Promise<CurrentUser> {
  const user = await assertSignedIn();
  if (isAdmin(user) || user.organizations.some((o) => o.id === orgId)) return user;
  throw new AuthorizationError();
}

/** Run queries as the current user (or anonymously) with RLS enforced. */
export async function asCurrentUser<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
  const user = await getCurrentUser();
  return withActor({ userId: user?.id ?? null }, fn);
}
