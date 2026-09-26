"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole, hasRole } from "@/lib/auth";
import { asService, type SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifications";
import { parseForm, runAction, UserFacingError, type ActionState } from "@/lib/server/action";
import { ROLE_LABELS } from "@/lib/labels";

const ROLE_KEYS = ["community_member", "provider", "verifier", "admin", "super_admin"] as const;
type Role = (typeof ROLE_KEYS)[number];

async function otherActiveSuperAdmins(sql: SqlClient, excludeUserId: string) {
  const [row] = await sql.query<{ n: number }>(
    `select count(*)::int as n from public.user_roles ur join public.profiles p on p.id = ur.user_id
     where ur.role_key = 'super_admin' and p.is_active and ur.user_id <> $1`,
    [excludeUserId],
  );
  return row?.n ?? 0;
}

const RolesSchema = z.object({
  userId: z.string().uuid(),
  "roles[]": z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.enum(ROLE_KEYS, { error: "Choose valid roles only." }))),
});

/** Super admins only: grant / revoke roles for another user. */
export async function updateRolesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await assertRole("super_admin");
    const parsed = parseForm(RolesSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { userId } = parsed.data;
    const nextRoles = [...new Set(parsed.data["roles[]"])] as Role[];
    if (userId === actor.id) throw new UserFacingError("You can't change your own roles. Ask another Super Administrator.");

    const result = await asService(async (sql) => {
      const [target] = await sql.query<{ full_name: string; email: string }>("select full_name, email from public.profiles where id = $1 for update", [userId]);
      if (!target) throw new UserFacingError("This user no longer exists.");
      const current = (await sql.query<{ role_key: Role }>("select role_key from public.user_roles where user_id = $1", [userId])).map((r) => r.role_key);
      const added = nextRoles.filter((r) => !current.includes(r));
      const removed = current.filter((r) => !nextRoles.includes(r));
      if (added.length === 0 && removed.length === 0) throw new UserFacingError("No changes to save — the roles are the same as before.");
      if (removed.includes("super_admin") && (await otherActiveSuperAdmins(sql, userId)) === 0) {
        throw new UserFacingError("You can't remove the last active Super Administrator. Grant the role to someone else first.");
      }
      for (const r of removed) await sql.query("delete from public.user_roles where user_id = $1 and role_key = $2", [userId, r]);
      for (const r of added) {
        await sql.query("insert into public.user_roles (user_id, role_key, granted_by) values ($1, $2, $3) on conflict do nothing", [userId, r, actor.id]);
      }
      const order = (rs: Role[]) => ROLE_KEYS.filter((k) => rs.includes(k));
      await audit(sql, {
        actorId: actor.id,
        action: "role.changed",
        entityType: "user_role",
        entityId: userId,
        entityLabel: `${target.full_name} (${target.email})`,
        previous: { roles: order(current) },
        next: { roles: order(nextRoles) },
        metadata: { added, removed },
      });
      await notify(sql, {
        userId,
        kind: "roles_changed",
        title: "Your MittenLink access was updated.",
        body: nextRoles.length
          ? `Your roles are now: ${order(nextRoles).map((r) => ROLE_LABELS[r]).join(", ")}.`
          : "You no longer have any assigned roles. Contact MittenLink if you think this is a mistake.",
        link: "/account",
      });
      return { name: target.full_name, added, removed };
    }, actor.id);

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    const parts = [
      result.added.length ? `granted ${result.added.map((r) => ROLE_LABELS[r]).join(", ")}` : null,
      result.removed.length ? `removed ${result.removed.map((r) => ROLE_LABELS[r]).join(", ")}` : null,
    ].filter(Boolean);
    return { status: "success", message: `Roles updated for ${result.name}: ${parts.join("; ")}.` };
  });
}

const ActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

/** Deactivate / reactivate an account. Only super admins can change admin accounts. */
export async function setUserActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await assertRole("admin", "super_admin");
    const parsed = parseForm(ActiveSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { userId } = parsed.data;
    const active = parsed.data.active === "true";
    if (userId === actor.id) throw new UserFacingError("You can't deactivate or reactivate your own account.");

    const name = await asService(async (sql) => {
      const [target] = await sql.query<{ full_name: string; email: string; is_active: boolean }>(
        "select full_name, email, is_active from public.profiles where id = $1 for update",
        [userId],
      );
      if (!target) throw new UserFacingError("This user no longer exists.");
      if (target.is_active === active) throw new UserFacingError(active ? "This account is already active." : "This account is already deactivated.");
      const roles = (await sql.query<{ role_key: string }>("select role_key from public.user_roles where user_id = $1", [userId])).map((r) => r.role_key);
      const targetIsAdmin = roles.includes("admin") || roles.includes("super_admin");
      if (targetIsAdmin && !hasRole(actor, "super_admin")) {
        throw new UserFacingError("Only Super Administrators can deactivate or reactivate administrator accounts.");
      }
      if (!active && roles.includes("super_admin") && (await otherActiveSuperAdmins(sql, userId)) === 0) {
        throw new UserFacingError("You can't deactivate the last active Super Administrator.");
      }
      await sql.query("update public.profiles set is_active = $2 where id = $1", [userId, active]);
      await audit(sql, {
        actorId: actor.id,
        action: active ? "user.reactivated" : "user.deactivated",
        entityType: "user",
        entityId: userId,
        entityLabel: `${target.full_name} (${target.email})`,
        previous: { is_active: target.is_active },
        next: { is_active: active },
        metadata: { roles },
      });
      return target.full_name;
    }, actor.id);

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return {
      status: "success",
      message: active ? `${name}'s account was reactivated. They can sign in again.` : `${name}'s account was deactivated. They are signed out and can no longer sign in.`,
    };
  });
}
