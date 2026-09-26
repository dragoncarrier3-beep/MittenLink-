"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertSignedIn } from "@/lib/auth";
import { asService, type SqlClient } from "@/lib/db";
import { parseForm, runAction, zCheckbox, zEmail, zOptionalEmail, zOptionalText, zOptionalUrl, zPhone, zText, UserFacingError, type ActionState } from "@/lib/server/action";
import { rateLimit } from "@/lib/server/rate-limit";
import { audit } from "@/lib/server/audit";
import { deliverAfterCommit, notify, notifyRole } from "@/lib/server/notifications";
import { slugify, withEchoedArrays } from "@/components/community/server";

const ORG_TYPES = ["nonprofit", "government", "private_practice", "healthcare", "school", "community_group", "advocacy", "faith_based", "other"] as const;
const RELATIONSHIPS = ["owner", "executive", "staff", "board_member", "authorized_representative"] as const;

const idList = z.array(z.string()).optional().default([]);

const Schema = z
  .object({
    name: zText("Organization name", 160),
    orgType: z.enum(ORG_TYPES, { error: "Choose the type of organization." }),
    description: zText("Description", 4000).refine((v) => v.length >= 40, "Please describe your organization in at least a sentence or two (40 characters)."),
    website: zOptionalUrl(),
    publicPhone: zPhone(),
    publicEmail: zOptionalEmail(),
    locationName: zOptionalText(120),
    street: zText("Street address", 200),
    city: zText("City", 120),
    zip: z.string().trim().regex(/^[0-9]{5}$/, "Enter a 5-digit ZIP code."),
    virtual: zCheckbox(),
    "categories[]": idList,
    "populations[]": idList,
    "languages[]": idList,
    accessibility: zOptionalText(2000),
    submitterName: zText("Your name", 120),
    submitterTitle: zText("Your title", 120),
    submitterEmail: zEmail("Your email"),
    relationship: z.enum(RELATIONSHIPS, { error: "Choose your relationship to the organization." }),
    requestManagement: zCheckbox(),
    authorized: zCheckbox(),
  })
  .superRefine((v, ctx) => {
    if (v["categories[]"].length === 0) ctx.addIssue({ code: "custom", path: ["categories[]"], message: "Choose at least one category." });
    if (!v.authorized) ctx.addIssue({ code: "custom", path: ["authorized"], message: "Confirm that you're authorized to represent this organization." });
    if (!v.publicPhone && !v.publicEmail && !v.website) {
      ctx.addIssue({ code: "custom", path: ["publicPhone"], message: "Add at least one way for families to contact you: phone, email, or website." });
    }
  });

async function uniqueSlug(sql: SqlClient, base: string) {
  const rows = await sql.query<{ slug: string }>("select slug from public.listings where kind = 'organization' and (slug = $1 or slug like $2)", [base, `${base}-%`]);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

function summarize(description: string) {
  const firstSentence = description.split(/(?<=[.!?])\s+/)[0] ?? description;
  return firstSentence.length <= 220 ? firstSentence : `${description.slice(0, 217).replace(/\s+\S*$/, "")}…`;
}

export async function submitOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(formData, async () => {
    const user = await assertSignedIn();
    const limited = await rateLimit("new-organization", 3, 30 * 60_000);
    if (!limited.ok) {
      return { status: "error", message: `You've submitted several organizations recently. Please wait ${Math.ceil(limited.retryAfterSeconds / 60)} minutes and try again.` };
    }
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;

    const created = await asService(async (sql) => {
      // Resolve county + coordinates from the local Michigan gazetteer (ZIP first, then city).
      const [place] = await sql.query<{ county_id: number; lat: number; lng: number }>(
        `select county_id, extensions.st_y(geog::extensions.geometry) as lat, extensions.st_x(geog::extensions.geometry) as lng
         from public.places
         where zip = $1 or (kind = 'city' and lower(name) = lower($2))
         order by (zip = $1) desc, population desc nulls last limit 1`,
        [d.zip, d.city],
      );
      if (!place) {
        throw new UserFacingError("Please check the address.", { zip: "We couldn't find that ZIP code in Michigan. Check the ZIP code and city." });
      }

      // Validate taxonomy ids against reference tables.
      const categoryIds = [...new Set(d["categories[]"].map(Number).filter(Number.isInteger))];
      const populationIds = [...new Set(d["populations[]"].map(Number).filter(Number.isInteger))];
      const languageCodes = [...new Set(d["languages[]"].filter((c) => /^[a-z-]{2,12}$/i.test(c)))];
      const validCats = await sql.query<{ id: number }>("select id from public.categories where id = any($1::int[]) and is_active order by sort_order", [categoryIds]);
      if (validCats.length === 0) throw new UserFacingError("Please choose at least one category.", { "categories[]": "Choose at least one category." });
      const validPops = await sql.query<{ id: number }>("select id from public.populations where id = any($1::int[])", [populationIds]);
      const validLangs = await sql.query<{ code: string }>("select code from public.languages where code = any($1::text[])", [languageCodes]);

      const slug = await uniqueSlug(sql, slugify(d.name));
      const [listing] = await sql.query<{ id: string }>(
        `insert into public.listings (kind, slug, title, summary, description, publication_status, verification_status, virtual_available, created_by)
         values ('organization', $1, $2, $3, $4, 'pending', 'pending_review', $5, $6) returning id`,
        [slug, d.name, summarize(d.description), d.description, d.virtual, user.id],
      );
      const orgId = listing.id;
      await sql.query(
        `insert into public.organizations (id, org_type, website, public_email, public_phone, accessibility_info)
         values ($1, $2, $3, $4, $5, $6)`,
        [orgId, d.orgType, d.website, d.publicEmail, d.publicPhone, d.accessibility],
      );
      const [location] = await sql.query<{ id: string }>(
        `insert into public.organization_locations (organization_id, name, street, city, zip, county_id, geog, phone, email, virtual_services, is_primary, status)
         values ($1, $2, $3, $4, $5, $6, extensions.st_setsrid(extensions.st_makepoint($7, $8), 4326)::extensions.geography, $9, $10, $11, true, 'open')
         returning id`,
        [orgId, d.locationName ?? "Main office", d.street, d.city, d.zip, place.county_id, place.lng, place.lat, d.publicPhone, d.publicEmail, d.virtual],
      );

      for (const [i, c] of validCats.entries()) {
        await sql.query("insert into public.listing_categories (listing_id, category_id, is_primary) values ($1, $2, $3)", [orgId, c.id, i === 0]);
      }
      for (const p of validPops) await sql.query("insert into public.listing_populations (listing_id, population_id) values ($1, $2)", [orgId, p.id]);
      for (const l of validLangs) await sql.query("insert into public.listing_languages (listing_id, language_code) values ($1, $2)", [orgId, l.code]);
      await sql.query("insert into public.service_areas (listing_id, scope, county_id) values ($1, 'county', $2)", [orgId, place.county_id]);

      // Provenance: every public contact point was supplied by the provider.
      const contacts: { kind: string; value: string; locationId: string | null }[] = [{ kind: "address", value: `${d.street}, ${d.city}, MI ${d.zip}`, locationId: location.id }];
      if (d.publicPhone) contacts.push({ kind: "phone", value: d.publicPhone, locationId: location.id });
      if (d.publicEmail) contacts.push({ kind: "email", value: d.publicEmail, locationId: null });
      if (d.website) contacts.push({ kind: "website", value: d.website, locationId: null });
      for (const c of contacts) {
        await sql.query(
          `insert into public.organization_contacts (organization_id, location_id, kind, value, is_public, source_type, confidence, status)
           values ($1, $2, $3, $4, true, 'provider_confirmation', 'medium', 'unverified')`,
          [orgId, c.locationId, c.kind, c.value],
        );
      }

      await sql.query(
        `insert into public.verification_tasks (listing_id, reason, priority, status, details, due_at)
         values ($1, 'new_submission', 'normal', 'open', $2, current_date + 7)`,
        [orgId, `New organization submitted by ${d.submitterName} (${d.submitterTitle}, ${d.submitterEmail}). Confirm details before publishing.`],
      );

      let claimId: string | null = null;
      if (d.requestManagement) {
        const [claim] = await sql.query<{ id: string }>(
          `insert into public.provider_claims (organization_id, claimant_user_id, relationship, claimant_name, claimant_title, work_email, verification_details, status, submitted_at)
           values ($1, $2, $3, $4, $5, $6, $7, 'submitted', now()) returning id`,
          [orgId, user.id, d.relationship, d.submitterName, d.submitterTitle, d.submitterEmail, `Submitted together with the new listing request for ${d.name}.`],
        );
        claimId = claim.id;
      }

      await notifyRole(sql, ["admin", "super_admin"], {
        kind: "new_submission",
        title: `New organization submitted: ${d.name}`,
        body: `${d.submitterName} (${d.submitterTitle}) submitted a new listing for review.${claimId ? " They also requested management access." : ""}`,
        link: "/admin/submissions",
      });
      const email = await notify(sql, {
        userId: user.id,
        kind: "new_submission_received",
        title: "Your organization was submitted for review.",
        body: `Thank you for submitting ${d.name}. We'll review it and let you know when it's published.`,
        link: claimId ? "/account/claims" : "/account",
        email: true,
      });
      await audit(sql, {
        actorId: user.id,
        action: "provider.created",
        entityType: "organization",
        entityId: orgId,
        entityLabel: d.name,
        next: { publication_status: "pending", verification_status: "pending_review", slug, county_id: place.county_id, management_claim: claimId },
      });
      return { email };
    }, user.id);

    // Email is best effort after commit; the submission is already saved.
    const warning = await deliverAfterCommit([created.email]);
    revalidatePath("/", "layout");
    redirect(warning ? "/list-your-organization/submitted?email=failed" : "/list-your-organization/submitted");
  });
  return withEchoedArrays(result, formData, ["categories", "populations", "languages"]);
}
