"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { asService } from "@/lib/db";
import { AuthorizationError, assertOrganizationAccess, assertSignedIn } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/provider/active-org";
import { audit } from "@/lib/server/audit";
import { notifyRole } from "@/lib/server/notifications";
import { runAction, UserFacingError } from "@/lib/server/action";
import type { ActionState } from "@/lib/server/action-types";
import { IMAGE_EXTENSIONS, detectImageType, getStorageAdapter } from "@/lib/integrations/storage";

const MAX_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function activeOrg() {
  const user = await assertSignedIn();
  const org = await getActiveOrganization(user);
  if (!org) throw new AuthorizationError("Choose an organization you manage first.");
  await assertOrganizationAccess(org.id);
  return { user, org };
}

/**
 * Enhanced listing logo upload. The file is validated by its magic bytes
 * (PNG, JPEG or WebP only), limited to 2 MB, requires alt text, and is stored
 * as organization_media with status 'pending_review'. A verification task is
 * opened; the logo appears publicly only after staff approve it.
 */
export async function uploadLogo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, async () => {
    const { user, org } = await activeOrg();
    const alt = typeof fd.get("alt_text") === "string" ? String(fd.get("alt_text")).trim() : "";
    const file = fd.get("logo");
    const errors: Record<string, string> = {};
    if (!alt) errors.alt_text = "Describe the logo for people using screen readers, for example “Great Lakes Independent Living Network logo”.";
    else if (alt.length > 200) errors.alt_text = "Alternative text must be 200 characters or fewer.";
    if (!(file instanceof File) || file.size === 0) errors.logo = "Choose a PNG, JPEG or WebP image to upload.";
    else if (file.size > MAX_BYTES) errors.logo = "The image is larger than 2 MB. Please choose a smaller file.";
    if (Object.keys(errors).length) throw new UserFacingError("Please correct the highlighted fields and try again.", errors);

    const bytes = new Uint8Array(await (file as File).arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) throw new UserFacingError("Please correct the highlighted fields and try again.", { logo: "This file isn't a PNG, JPEG or WebP image. Please choose a different file." });

    const [state] = await asService((sql) =>
      sql.query<{ listing_tier: string; pending: number }>(
        `select o.listing_tier,
                (select count(*)::int from public.organization_media m where m.organization_id = o.id and m.kind = 'logo' and m.status = 'pending_review') as pending
         from public.organizations o where o.id = $1`,
        [org.id],
      ),
    );
    if (state?.listing_tier !== "enhanced") throw new UserFacingError("Logo uploads are part of MittenLink Enhanced. Visit Listing Plan to learn more.");
    if (state.pending > 0) throw new UserFacingError("A logo is already waiting for review. Withdraw it first if you'd like to upload a different file.");

    const key = `logos/${org.id.toLowerCase()}/${randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
    const storage = getStorageAdapter();
    await storage.put(key, bytes, type);

    try {
      await asService(async (sql) => {
        const [media] = await sql.query<{ id: string }>(
          `insert into public.organization_media (organization_id, kind, storage_path, alt_text, status, created_by)
           values ($1, 'logo', $2, $3, 'pending_review', $4) returning id`,
          [org.id, key, alt, user.id],
        );
        await sql.query(
          `insert into public.verification_tasks (listing_id, reason, priority, status, details, due_at)
           values ($1, 'provider_update', 'normal', 'open', $2, (now() + interval '5 days')::date)`,
          [org.id, `New logo uploaded (media ${media.id}). Alt text: “${alt.slice(0, 150)}”. Approve or reject it in listing media review.`],
        );
        await notifyRole(sql, ["verifier"], {
          kind: "task_assigned",
          title: `New logo ready for review: ${org.title}`,
          body: "An Enhanced listing uploaded a new logo.",
          link: "/verify",
        });
        await audit(sql, {
          actorId: user.id,
          action: "provider_media.uploaded",
          entityType: "organization_media",
          entityId: media.id,
          entityLabel: `${org.title} — logo`,
          next: { status: "pending_review", storage_path: key, alt_text: alt, content_type: type, bytes: bytes.byteLength },
        });
      }, user.id);
    } catch (err) {
      await storage.delete(key).catch(() => undefined);
      throw err;
    }

    revalidatePath("/provider/organization");
    return { status: "success", message: "Your logo was uploaded and is waiting for review. It will appear on your listing after a MittenLink verifier approves it." };
  });
}

/** Withdraws a pending logo (removes the file and cancels the review task). */
export async function withdrawLogo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(null, async () => {
    const { user, org } = await activeOrg();
    const id = String(fd.get("mediaId") ?? "");
    if (!UUID.test(id)) throw new UserFacingError("This upload could not be found. Please reload the page.");
    const removed = await asService(async (sql) => {
      const [media] = await sql.query<{ id: string; storage_path: string }>(
        "delete from public.organization_media where id = $1 and organization_id = $2 and status = 'pending_review' returning id, storage_path",
        [id, org.id],
      );
      if (!media) return null;
      await sql.query(
        `update public.verification_tasks set status = 'cancelled', resolution = 'Logo withdrawn by provider.', completed_at = now()
         where listing_id = $1 and reason = 'provider_update' and status in ('open', 'in_progress', 'escalated') and details like '%' || $2 || '%'`,
        [org.id, id],
      );
      await audit(sql, { actorId: user.id, action: "provider_media.withdrawn", entityType: "organization_media", entityId: id, entityLabel: `${org.title} — logo`, previous: { status: "pending_review" } });
      return media;
    }, user.id);
    if (!removed) throw new UserFacingError("This logo has already been reviewed and can't be withdrawn.");
    await getStorageAdapter().delete(removed.storage_path).catch((err) => console.warn("[uploads] could not delete withdrawn logo", err));
    revalidatePath("/provider/organization");
    return { status: "success", message: "The pending logo was withdrawn." };
  });
}
