"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { setVerificationStatus, type VerificationMethod } from "@/lib/domain/verification";
import { parseForm, runAction, UserFacingError, zOptionalText, type ActionState } from "@/lib/server/action";
import { listingHref } from "@/lib/links";

const ADMIN_PATH: Record<string, string> = {
  organization: "/admin/organizations",
  service: "/admin/services",
  program: "/admin/programs",
  resource: "/admin/resources",
  event: "/admin/events",
};

function revalidateListing(kind: string, id: string, slug: string) {
  const base = ADMIN_PATH[kind] ?? "/admin";
  revalidatePath(base);
  revalidatePath(`${base}/${id}`);
  revalidatePath(listingHref(kind, slug));
  revalidatePath("/admin");
}

const VerificationSchema = z.object({
  listingId: z.string().uuid(),
  status: z.enum(["unverified", "pending_review", "verified", "needs_update", "unable_to_verify", "archived"], { error: "Choose a verification status." }),
  method: z
    .enum(["provider_confirmation", "official_website", "government_source", "phone_confirmation", "email_confirmation", "manual_research", ""])
    .optional()
    .transform((v) => (v ? (v as VerificationMethod) : null)),
  publicSummary: zOptionalText(500),
  internalNotes: zOptionalText(4000),
});

/** Admin: set a listing's verification status directly (history + audit). */
export async function setListingVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(VerificationSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    if (d.status === "verified" && !d.method) {
      throw new UserFacingError("Choose the verification method you used.", { method: "Choose a verification method when marking a record verified." });
    }
    const listing = await asService(async (sql) => {
      const [l] = await sql.query<{ kind: string; slug: string }>("select kind, slug from public.listings where id = $1", [d.listingId]);
      if (!l) throw new UserFacingError("This record no longer exists.");
      await setVerificationStatus(sql, {
        listingId: d.listingId,
        status: d.status,
        actorId: user.id,
        method: d.method,
        publicSummary: d.publicSummary,
        internalNotes: d.internalNotes,
      });
      return l;
    }, user.id);
    revalidateListing(listing.kind, d.listingId, listing.slug);
    return { status: "success", message: "Verification status updated and recorded in the verification history." };
  });
}

const PublicationSchema = z.object({
  listingId: z.string().uuid(),
  publication: z.enum(["published", "draft", "archived"], { error: "Choose a publication status." }),
});

const PUBLICATION_MESSAGES: Record<string, string> = {
  published: "Record published. It is now visible in public search.",
  draft: "Record unpublished. It is saved as a draft and hidden from the public.",
  archived: "Record archived. It is hidden from the public and kept for history.",
};

/** Admin: publish / unpublish / archive a listing (audited). */
export async function setListingPublicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(PublicationSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { listingId, publication } = parsed.data;
    const listing = await asService(async (sql) => {
      const [l] = await sql.query<{ kind: string; slug: string; title: string; publication_status: string }>(
        "select kind, slug, title, publication_status from public.listings where id = $1 for update",
        [listingId],
      );
      if (!l) throw new UserFacingError("This record no longer exists.");
      if (l.publication_status === publication) throw new UserFacingError("The record already has this publication status.");
      await sql.query("update public.listings set publication_status = $2 where id = $1", [listingId, publication]);
      await audit(sql, {
        actorId: user.id,
        action: publication === "published" ? "listing.published" : publication === "archived" ? "listing.archived" : "listing.unpublished",
        entityType: "listing",
        entityId: listingId,
        entityLabel: l.title,
        previous: { publication_status: l.publication_status },
        next: { publication_status: publication },
        metadata: { kind: l.kind },
      });
      return l;
    }, user.id);
    revalidateListing(listing.kind, listingId, listing.slug);
    return { status: "success", message: PUBLICATION_MESSAGES[publication] };
  });
}
