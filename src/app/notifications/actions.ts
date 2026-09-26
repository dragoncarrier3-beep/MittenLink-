"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asCurrentUser, assertSignedIn } from "@/lib/auth";
import { safeRelativePath } from "@/components/community/server";

const uuid = z.string().uuid();

async function markRead(id: string) {
  // RLS: users can only update their own notifications, and only read_at.
  return asCurrentUser((sql) =>
    sql.query<{ link_url: string | null }>(
      "update public.notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = auth.uid() returning link_url",
      [id],
    ),
  );
}

/** Mark one notification as read and stay on the page. */
export async function markNotificationReadAction(formData: FormData) {
  await assertSignedIn();
  const id = uuid.safeParse(formData.get("id"));
  if (id.success) {
    try {
      await markRead(id.data);
    } catch (err) {
      console.error("[notifications] mark read failed", err);
      redirect("/notifications?error=1");
    }
  }
  revalidatePath("/", "layout");
  redirect("/notifications");
}

/** Mark as read, then follow the notification's own (stored, same-site) link. */
export async function openNotificationAction(formData: FormData) {
  await assertSignedIn();
  const id = uuid.safeParse(formData.get("id"));
  let target = "/notifications";
  if (id.success) {
    try {
      const [row] = await markRead(id.data);
      target = safeRelativePath(row?.link_url) ?? "/notifications";
    } catch (err) {
      console.error("[notifications] open failed", err);
      target = "/notifications?error=1";
    }
  }
  revalidatePath("/", "layout");
  redirect(target);
}

export async function markAllNotificationsReadAction() {
  await assertSignedIn();
  try {
    await asCurrentUser((sql) => sql.query("update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null"));
  } catch (err) {
    console.error("[notifications] mark all read failed", err);
    redirect("/notifications?error=1");
  }
  revalidatePath("/", "layout");
  redirect("/notifications?allread=1");
}
