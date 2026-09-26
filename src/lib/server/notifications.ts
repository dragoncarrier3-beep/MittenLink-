import "server-only";
import type { SqlClient } from "@/lib/db";
import { getEmailAdapter } from "@/lib/integrations/email";

export interface NotificationInput {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Also attempt an email (best effort, after the database write). */
  email?: boolean;
}

/**
 * Creates an in-app notification inside the caller's transaction.
 * Returns a function that sends the optional email AFTER commit; call it once
 * the transaction has succeeded. Email failure never loses saved data.
 */
export async function notify(sql: SqlClient, input: NotificationInput): Promise<() => Promise<boolean>> {
  await sql.query(
    "insert into public.notifications (user_id, kind, title, body, link_url) values ($1, $2, $3, $4, $5)",
    [input.userId, input.kind, input.title, input.body ?? null, input.link ?? null],
  );
  if (!input.email) return async () => true;
  const [profile] = await sql.query<{ email: string; full_name: string }>(
    "select email, full_name from public.profiles where id = $1",
    [input.userId],
  );
  return async () => {
    if (!profile) return false;
    try {
      await getEmailAdapter().send({
        to: profile.email,
        subject: input.title,
        text: `Hello ${profile.full_name},\n\n${input.body ?? input.title}\n\n${input.link ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${input.link}` : ""}\n\n— MittenLink`,
      });
      return true;
    } catch (err) {
      console.error("[notify] email delivery failed", err);
      return false;
    }
  };
}

/** Notify every active user holding one of the given roles (in-app only). */
export async function notifyRole(sql: SqlClient, roles: string[], input: Omit<NotificationInput, "userId" | "email">) {
  const users = await sql.query<{ user_id: string }>(
    `select distinct ur.user_id from public.user_roles ur join public.profiles p on p.id = ur.user_id
     where ur.role_key = any($1) and p.is_active`,
    [roles],
  );
  for (const u of users) await notify(sql, { ...input, userId: u.user_id });
}

/**
 * Sends deferred emails after the database transaction has committed.
 * Returns a user-facing warning when any delivery failed (data is already saved).
 */
export async function deliverAfterCommit(senders: (() => Promise<boolean>)[]): Promise<string | undefined> {
  const results = await Promise.all(senders.map((s) => s().catch(() => false)));
  return results.every(Boolean) ? undefined : "The update was saved, but the notification email could not be sent.";
}
