"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { UserFacingError, parseForm, runAction, zOptionalEmail, zOptionalText, zPhone, zText, type ActionState } from "@/lib/server/action";
import { getEmailAdapter } from "@/lib/integrations/email";

const ADMIN = ["admin", "super_admin"] as const;
const STATUSES = ["not_contacted", "outreach_sent", "follow_up_needed", "responded", "claim_invited", "claimed", "declined", "unable_to_reach"] as const;

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Choose an option from the list.");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date.");

function revalidateOutreach(id?: string) {
  revalidatePath("/admin/outreach");
  if (id) revalidatePath(`/admin/outreach/${id}`);
  revalidatePath("/admin", "layout");
}

const ContactSchema = z.object({
  contact_name: zText("Contact name", 160),
  contact_role: zOptionalText(160),
  email: zOptionalEmail(),
  phone: zPhone(),
  status: z.enum(STATUSES, { error: "Choose an outreach status." }),
  next_follow_up_at: optionalDate,
  assigned_to: optionalUuid,
  notes: zOptionalText(4000),
});

const CreateSchema = ContactSchema.extend({ organization_id: z.string({ error: "Choose an organization." }).uuid("Choose an organization.") });

export async function createOutreachAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(CreateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const id = await asService(async (sql) => {
      const [org] = await sql.query<{ title: string }>("select l.title from public.organizations o join public.listings l on l.id = o.id where o.id = $1", [d.organization_id]);
      if (!org) throw new UserFacingError("That organization could not be found.", { organization_id: "Choose an organization from the list." });
      const [row] = await sql.query<{ id: string }>(
        `insert into public.outreach_contacts (organization_id, contact_name, contact_role, email, phone, status, next_follow_up_at, assigned_to, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [d.organization_id, d.contact_name, d.contact_role, d.email, d.phone, d.status, d.next_follow_up_at, d.assigned_to, d.notes],
      );
      await audit(sql, { actorId: user.id, action: "outreach.contact_added", entityType: "outreach_contact", entityId: row.id, entityLabel: `${d.contact_name} — ${org.title}`, next: { status: d.status, assigned_to: d.assigned_to } });
      return row.id;
    }, user.id);
    revalidateOutreach(id);
    redirect(`/admin/outreach/${id}?saved=created`);
  });
}

const UpdateSchema = ContactSchema.extend({ id: z.string().uuid() });

export async function updateOutreachAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(UpdateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [prev] = await sql.query<Record<string, unknown>>(
        "select contact_name, contact_role, email, phone, status, to_char(next_follow_up_at, 'YYYY-MM-DD') as next_follow_up_at, assigned_to, notes from public.outreach_contacts where id = $1",
        [d.id],
      );
      if (!prev) throw new UserFacingError("This outreach record no longer exists.");
      await sql.query(
        `update public.outreach_contacts set contact_name = $2, contact_role = $3, email = $4, phone = $5, status = $6, next_follow_up_at = $7, assigned_to = $8, notes = $9 where id = $1`,
        [d.id, d.contact_name, d.contact_role, d.email, d.phone, d.status, d.next_follow_up_at, d.assigned_to, d.notes],
      );
      const next: Record<string, unknown> = { contact_name: d.contact_name, contact_role: d.contact_role, email: d.email, phone: d.phone, status: d.status, next_follow_up_at: d.next_follow_up_at, assigned_to: d.assigned_to, notes: d.notes };
      const changed = Object.keys(next).filter((k) => (prev[k] ?? null) !== (next[k] ?? null));
      await audit(sql, {
        actorId: user.id, action: "outreach.contact_updated", entityType: "outreach_contact", entityId: d.id, entityLabel: d.contact_name,
        previous: Object.fromEntries(changed.map((k) => [k, prev[k] ?? null])), next: Object.fromEntries(changed.map((k) => [k, next[k]])),
      });
    }, user.id);
    revalidateOutreach(d.id);
    return { status: "success", message: "Outreach record saved." };
  });
}

const InteractionSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(["email", "phone", "meeting", "mail", "other"], { error: "Choose how you made contact." }),
  summary: zText("Summary", 2000),
  status_after: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (STATUSES as readonly string[]).includes(v), "Choose a status."),
  next_follow_up_at: optionalDate,
});

export async function logInteractionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(InteractionSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [prev] = await sql.query<{ contact_name: string; status: string }>("select contact_name, status from public.outreach_contacts where id = $1", [d.id]);
      if (!prev) throw new UserFacingError("This outreach record no longer exists.");
      await sql.query(
        "insert into public.outreach_interactions (outreach_contact_id, channel, summary, status_after, created_by) values ($1, $2, $3, $4, $5)",
        [d.id, d.channel, d.summary, d.status_after ?? prev.status, user.id],
      );
      await sql.query(
        `update public.outreach_contacts set last_contacted_at = now(), status = coalesce($2, status),
           next_follow_up_at = case when $3::date is not null then $3::date else next_follow_up_at end where id = $1`,
        [d.id, d.status_after, d.next_follow_up_at],
      );
      await audit(sql, {
        actorId: user.id, action: "outreach.interaction_logged", entityType: "outreach_contact", entityId: d.id, entityLabel: prev.contact_name,
        previous: { status: prev.status }, next: { status: d.status_after ?? prev.status, next_follow_up_at: d.next_follow_up_at }, metadata: { channel: d.channel },
      });
    }, user.id);
    revalidateOutreach(d.id);
    return { status: "success", message: "Interaction logged." };
  });
}

const InviteSchema = z.object({
  id: z.string().uuid(),
  message: zOptionalText(2000),
  next_follow_up_at: optionalDate,
});

export async function sendClaimInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(InviteSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const info = await asService(async (sql) => {
      const [c] = await sql.query<{ contact_name: string; email: string | null; status: string; org_title: string; org_slug: string }>(
        `select oc.contact_name, oc.email, oc.status, l.title as org_title, l.slug as org_slug
         from public.outreach_contacts oc join public.listings l on l.id = oc.organization_id where oc.id = $1`,
        [d.id],
      );
      if (!c) throw new UserFacingError("This outreach record no longer exists.");
      if (!c.email) throw new UserFacingError("Add an email address for this contact before sending a claim invitation.");
      if (c.status === "claimed") throw new UserFacingError("This organization has already claimed its listing.");
      const summary = `Claim invitation sent to ${c.email}.${d.message ? ` Note: ${d.message}` : ""}`;
      await sql.query(
        "insert into public.outreach_interactions (outreach_contact_id, channel, summary, status_after, created_by) values ($1, 'email', $2, 'claim_invited', $3)",
        [d.id, summary, user.id],
      );
      await sql.query(
        `update public.outreach_contacts set status = 'claim_invited', last_contacted_at = now(),
           next_follow_up_at = coalesce($2::date, current_date + 7) where id = $1`,
        [d.id, d.next_follow_up_at],
      );
      await audit(sql, { actorId: user.id, action: "outreach.claim_invited", entityType: "outreach_contact", entityId: d.id, entityLabel: `${c.contact_name} — ${c.org_title}`, previous: { status: c.status }, next: { status: "claim_invited" } });
      return c;
    }, user.id);
    revalidateOutreach(d.id);

    // Send after the record is saved; a delivery failure never loses the update.
    let warning: string | undefined;
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      await getEmailAdapter().send({
        to: info.email!,
        subject: `Claim your free ${info.org_title} listing on MittenLink`,
        text: [
          `Hello ${info.contact_name},`,
          "",
          `MittenLink is a free directory that helps Michigan families find disability resources. ${info.org_title} is listed, and we'd love your help keeping the information accurate.`,
          "",
          "Claiming the listing is free. Once approved, you can suggest updates to your services, hours, and contact details, which MittenLink staff review before publishing.",
          d.message ? `\n${d.message}\n` : "",
          `Start here: ${site}/providers/${info.org_slug}`,
          "",
          "Thank you,",
          "The MittenLink team",
        ].join("\n"),
      });
    } catch (err) {
      console.error("[outreach] claim invitation email failed", err);
      warning = "The update was saved, but the notification email could not be sent.";
    }
    return { status: "success", message: `Claim invitation recorded for ${info.contact_name}. Status is now Claim Invited.`, warning };
  });
}
