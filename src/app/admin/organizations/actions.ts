"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { deliverAfterCommit, notify } from "@/lib/server/notifications";
import { parseForm, runAction, UserFacingError, zCheckbox, zOptionalEmail, zOptionalText, zOptionalUrl, zPhone, zText, type ActionState } from "@/lib/server/action";
import { listingHref } from "@/lib/links";

const ORG_TYPES = ["nonprofit", "government", "private_practice", "healthcare", "school", "community_group", "advocacy", "faith_based", "other"] as const;

function revalidateOrg(id: string, slug?: string) {
  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${id}`);
  if (slug) revalidatePath(listingHref("organization", slug));
}

// ---------------------------------------------------------------------------
// Direct admin edit of core organization fields
// ---------------------------------------------------------------------------
const OrgEditSchema = z.object({
  id: z.string().uuid(),
  title: zText("Organization name", 200),
  summary: zText("Summary", 400),
  description: zOptionalText(8000),
  orgType: z.enum(ORG_TYPES, { error: "Choose an organization type." }),
  website: zOptionalUrl(),
  publicPhone: zPhone(),
  publicEmail: zOptionalEmail(),
  accessibilityInfo: zOptionalText(4000),
});

export async function updateOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(OrgEditSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const slug = await asService(async (sql) => {
      const [prev] = await sql.query<{
        slug: string; title: string; summary: string; description: string; org_type: string; website: string | null; public_phone: string | null; public_email: string | null; accessibility_info: string | null;
      }>(
        `select l.slug, l.title, l.summary, l.description, o.org_type, o.website, o.public_phone, o.public_email, o.accessibility_info
         from public.listings l join public.organizations o on o.id = l.id where l.id = $1 for update of l`,
        [d.id],
      );
      if (!prev) throw new UserFacingError("This organization no longer exists.");
      const next = {
        title: d.title, summary: d.summary, description: d.description ?? "", org_type: d.orgType, website: d.website, public_phone: d.publicPhone,
        public_email: d.publicEmail, accessibility_info: d.accessibilityInfo,
      };
      const { slug: prevSlug, ...previous } = prev;
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => (previous[k] ?? null) !== (next[k] ?? null));
      if (changed.length === 0) throw new UserFacingError("No changes to save — the values are the same as before.");
      await sql.query("update public.listings set title = $2, summary = $3, description = $4 where id = $1", [d.id, next.title, next.summary, next.description]);
      await sql.query(
        "update public.organizations set org_type = $2, website = $3, public_phone = $4, public_email = $5, accessibility_info = $6 where id = $1",
        [d.id, next.org_type, next.website, next.public_phone, next.public_email, next.accessibility_info],
      );
      await audit(sql, {
        actorId: user.id,
        action: "provider.edited",
        entityType: "organization",
        entityId: d.id,
        entityLabel: d.title,
        previous: Object.fromEntries(changed.map((k) => [k, previous[k]])),
        next: Object.fromEntries(changed.map((k) => [k, next[k]])),
        metadata: { source: "admin_direct_edit", fields: changed },
      });
      return prevSlug;
    }, user.id);
    revalidateOrg(d.id, slug);
    return { status: "success", message: "Organization details saved and recorded in the audit log." };
  });
}

// ---------------------------------------------------------------------------
// Contact provenance
// ---------------------------------------------------------------------------
const ContactSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  kind: z.enum(["phone", "email", "website", "address", "fax"], { error: "Choose the type of contact." }),
  label: zOptionalText(100),
  value: zText("Value", 500),
  sourceType: z.enum(
    ["official_website", "government_source", "provider_confirmation", "phone_confirmation", "email_confirmation", "manual_research", "source_watch", "community_submission"],
    { error: "Choose where this information came from." },
  ),
  sourceUrl: zOptionalUrl(),
  confidence: z.enum(["high", "medium", "low"], { error: "Choose a confidence level." }),
  status: z.enum(["active", "unverified", "outdated"], { error: "Choose a status." }),
  isPublic: zCheckbox(),
  markVerified: zCheckbox(),
});

export async function saveContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(ContactSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [org] = await sql.query<{ title: string }>("select title from public.listings where id = $1 and kind = 'organization'", [d.organizationId]);
      if (!org) throw new UserFacingError("This organization no longer exists.");
      const fields = { kind: d.kind, label: d.label, value: d.value, source_type: d.sourceType, source_url: d.sourceUrl, confidence: d.confidence, status: d.status, is_public: d.isPublic };
      if (d.contactId) {
        const [prev] = await sql.query<Record<string, unknown>>(
          "select kind, label, value, source_type, source_url, confidence, status, is_public from public.organization_contacts where id = $1 and organization_id = $2 for update",
          [d.contactId, d.organizationId],
        );
        if (!prev) throw new UserFacingError("This contact record no longer exists.");
        await sql.query(
          `update public.organization_contacts set kind = $3, label = $4, value = $5, source_type = $6, source_url = $7, confidence = $8, status = $9, is_public = $10,
             last_verified_at = case when $11 then now() else last_verified_at end,
             verified_by = case when $11 then $12::uuid else verified_by end
           where id = $1 and organization_id = $2`,
          [d.contactId, d.organizationId, d.kind, d.label, d.value, d.sourceType, d.sourceUrl, d.confidence, d.status, d.isPublic, d.markVerified, user.id],
        );
        await audit(sql, {
          actorId: user.id, action: "contact_provenance.updated", entityType: "organization", entityId: d.organizationId, entityLabel: org.title,
          previous: prev, next: { ...fields, marked_verified: d.markVerified }, metadata: { contact_id: d.contactId },
        });
      } else {
        const [row] = await sql.query<{ id: string }>(
          `insert into public.organization_contacts (organization_id, kind, label, value, source_type, source_url, confidence, status, is_public, last_verified_at, verified_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $10 then now() else null end, case when $10 then $11::uuid else null end) returning id`,
          [d.organizationId, d.kind, d.label, d.value, d.sourceType, d.sourceUrl, d.confidence, d.status, d.isPublic, d.markVerified, user.id],
        );
        await audit(sql, {
          actorId: user.id, action: "contact_provenance.added", entityType: "organization", entityId: d.organizationId, entityLabel: org.title,
          next: { ...fields, marked_verified: d.markVerified }, metadata: { contact_id: row.id },
        });
      }
    }, user.id);
    revalidateOrg(d.organizationId);
    return { status: "success", message: d.contactId ? "Contact provenance updated." : "Contact provenance record added." };
  });
}

// ---------------------------------------------------------------------------
// Manager access
// ---------------------------------------------------------------------------
const MemberSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  decision: z.enum(["revoke", "restore"]),
});

export async function setMemberAccessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(MemberSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { organizationId, userId, decision } = parsed.data;
    const nextStatus = decision === "revoke" ? "revoked" : "active";
    const senders = await asService(async (sql) => {
      const [m] = await sql.query<{ status: string; full_name: string; org_title: string }>(
        `select m.status, p.full_name, l.title as org_title from public.provider_members m
         join public.profiles p on p.id = m.user_id join public.listings l on l.id = m.organization_id
         where m.organization_id = $1 and m.user_id = $2 for update of m`,
        [organizationId, userId],
      );
      if (!m) throw new UserFacingError("This manager record no longer exists.");
      if (m.status === nextStatus) throw new UserFacingError(decision === "revoke" ? "Access was already revoked." : "Access is already active.");
      await sql.query("update public.provider_members set status = $3 where organization_id = $1 and user_id = $2", [organizationId, userId, nextStatus]);
      await audit(sql, {
        actorId: user.id,
        action: decision === "revoke" ? "provider_member.revoked" : "provider_member.restored",
        entityType: "organization",
        entityId: organizationId,
        entityLabel: m.org_title,
        previous: { user: m.full_name, status: m.status },
        next: { user: m.full_name, status: nextStatus },
        metadata: { user_id: userId },
      });
      return [
        await notify(sql, {
          userId,
          kind: decision === "revoke" ? "access_revoked" : "access_restored",
          title: decision === "revoke" ? `Your access to manage ${m.org_title} was removed.` : `Your access to manage ${m.org_title} was restored.`,
          body:
            decision === "revoke"
              ? "A MittenLink administrator removed your management access. If you think this is a mistake, please contact MittenLink."
              : "A MittenLink administrator restored your management access.",
          link: "/provider",
          email: true,
        }),
      ];
    }, user.id);
    const warning = await deliverAfterCommit(senders);
    revalidateOrg(organizationId);
    return { status: "success", message: decision === "revoke" ? "Manager access revoked. The user was notified." : "Manager access restored. The user was notified.", warning };
  });
}

// ---------------------------------------------------------------------------
// Logo moderation
// ---------------------------------------------------------------------------
const MediaSchema = z.object({
  mediaId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function moderateMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(MediaSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { mediaId, decision } = parsed.data;
    const result = await asService(async (sql) => {
      const [m] = await sql.query<{ organization_id: string; kind: string; storage_path: string; alt_text: string; status: string; created_by: string | null; title: string; slug: string; logo_path: string | null }>(
        `select m.organization_id, m.kind, m.storage_path, m.alt_text, m.status, m.created_by, l.title, l.slug, o.logo_path
         from public.organization_media m join public.listings l on l.id = m.organization_id join public.organizations o on o.id = m.organization_id
         where m.id = $1 for update of m`,
        [mediaId],
      );
      if (!m) throw new UserFacingError("This upload no longer exists.");
      if (m.status !== "pending_review") throw new UserFacingError("This upload has already been reviewed.");
      await sql.query("update public.organization_media set status = $2 where id = $1", [mediaId, decision === "approve" ? "approved" : "rejected"]);
      if (decision === "approve" && m.kind === "logo") {
        await sql.query("update public.organizations set logo_path = $2, logo_alt = $3 where id = $1", [m.organization_id, m.storage_path, m.alt_text]);
      }
      await audit(sql, {
        actorId: user.id,
        action: decision === "approve" ? "media.approved" : "media.rejected",
        entityType: "organization",
        entityId: m.organization_id,
        entityLabel: m.title,
        previous: { media_status: "pending_review", logo_path: m.logo_path },
        next: { media_status: decision === "approve" ? "approved" : "rejected", logo_path: decision === "approve" && m.kind === "logo" ? m.storage_path : m.logo_path },
        metadata: { media_id: mediaId, kind: m.kind },
      });
      const senders = [];
      if (m.created_by) {
        senders.push(
          await notify(sql, {
            userId: m.created_by,
            kind: decision === "approve" ? "media_approved" : "media_rejected",
            title: decision === "approve" ? `Your ${m.kind} for ${m.title} was approved.` : `Your ${m.kind} for ${m.title} was not approved.`,
            body:
              decision === "approve"
                ? "It now appears on your Enhanced Listing."
                : "Please upload a clear image of your organization's own logo with accurate alternative text.",
            link: "/provider",
          }),
        );
      }
      return { orgId: m.organization_id, slug: m.slug, senders };
    }, user.id);
    await deliverAfterCommit(result.senders);
    revalidateOrg(result.orgId, result.slug);
    redirect(`/admin/organizations/${result.orgId}?saved=${decision === "approve" ? "logo-approved" : "logo-rejected"}`);
  });
}
