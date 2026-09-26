import "server-only";
import { z } from "zod";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify, notifyRole } from "@/lib/server/notifications";
import { UserFacingError } from "@/lib/server/action";

/*
 * Moderated provider edits.
 *
 * Providers never write directory tables directly (RLS has no provider write
 * policy). They submit a provider_change_request containing only whitelisted
 * fields; a verifier/admin reviews it and `applyChangeRequest` publishes it.
 * The same zod schemas validate input at submission AND at application.
 */

export type TargetType = "organization" | "location" | "service" | "program" | "event";

const optText = (max = 2000) => z.string().trim().max(max).nullable().optional();
const optBool = z.boolean().optional();
const slugList = z.array(z.string().trim().min(1).max(80)).max(30).optional();
const phone = z.string().trim().max(30).regex(/^[0-9()+\-.\s]*$/, "Enter a valid phone number.").nullable().optional();
const email = z.string().trim().max(200).email("Enter a valid email address.").or(z.literal("")).nullable().optional();
const url = z.string().trim().max(500).regex(/^(https?:\/\/[^\s]+)?$/, "Enter a full web address starting with https://").nullable().optional();
const hours = z.array(z.object({ day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) })).max(14).optional();

export const proposalSchemas = {
  organization: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    summary: optText(300),
    description: optText(4000),
    website: url,
    public_email: email,
    public_phone: phone,
    accessibility_info: optText(2000),
    expanded_description: optText(6000),
    org_type: z.enum(["nonprofit", "government", "private_practice", "healthcare", "school", "community_group", "advocacy", "faith_based", "other"]).optional(),
    categories: slugList,
    populations: slugList,
    languages: slugList,
  }),
  location: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    street: z.string().trim().min(3).max(200).optional(),
    street2: optText(120),
    city: z.string().trim().min(2).max(80).optional(),
    zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code.").optional(),
    phone,
    email,
    hours,
    hours_note: optText(300),
    wheelchair_accessible: z.boolean().nullable().optional(),
    accessible_parking: z.boolean().nullable().optional(),
    transit_info: optText(500),
    appointment_required: optBool,
    virtual_services: optBool,
    status: z.enum(["open", "temporarily_closed", "closed"]).optional(),
  }),
  service: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    summary: optText(300),
    description: optText(4000),
    eligibility: optText(1000),
    age_min: z.number().int().min(0).max(120).nullable().optional(),
    age_max: z.number().int().min(0).max(120).nullable().optional(),
    is_free: optBool,
    referral_required: optBool,
    waitlist_status: z.enum(["accepting", "short_wait", "waitlist", "not_accepting"]).optional(),
    in_person: optBool,
    home_based: optBool,
    virtual_available: optBool,
    contact_phone: phone,
    contact_email: email,
    insurance_notes: optText(1000),
    payment_notes: optText(1000),
    categories: slugList,
    populations: slugList,
    languages: slugList,
    payment_options: slugList,
    location_ids: z.array(z.string().uuid()).max(30).optional(),
  }),
  program: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    summary: optText(300),
    description: optText(4000),
    eligibility: optText(1000),
    cost_text: optText(200),
    is_free: optBool,
    application_instructions: optText(2000),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    website: url,
    contact_email: email,
    contact_phone: phone,
    virtual_available: optBool,
    categories: slugList,
    populations: slugList,
  }),
  event: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    summary: optText(300),
    description: optText(4000),
    event_type: z.enum(["workshop", "support_group", "webinar", "recreation", "community", "training", "resource_fair"]).optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    ends_at: z.string().datetime({ offset: true }).optional(),
    venue_name: optText(160),
    street: optText(200),
    city: optText(80),
    zip: z.string().trim().regex(/^(\d{5})?$/).nullable().optional(),
    is_in_person: optBool,
    virtual_available: optBool,
    registration_url: url,
    cost_text: optText(200),
    is_free: optBool,
    accommodations: optText(1000),
    contact_email: email,
    contact_phone: phone,
    categories: slugList,
    populations: slugList,
  }),
} satisfies Record<TargetType, z.ZodTypeAny>;

export type Proposal<T extends TargetType> = z.infer<(typeof proposalSchemas)[T]>;

/** Fields that live on public.listings rather than the typed table. */
const LISTING_FIELDS = new Set(["title", "summary", "description", "virtual_available"]);
const ARRAY_FIELDS = new Set(["categories", "populations", "languages", "payment_options", "location_ids"]);
const TYPED_TABLE: Record<TargetType, string> = {
  organization: "organizations",
  location: "organization_locations",
  service: "services",
  program: "programs",
  event: "events",
};
/** Fields required when proposing a brand-new record. */
const REQUIRED_ON_CREATE: Record<TargetType, string[]> = {
  organization: [],
  location: ["name", "street", "city", "zip"],
  service: ["title", "summary"],
  program: ["title", "summary"],
  event: ["title", "summary", "starts_at", "ends_at"],
};

export const FIELD_LABELS: Record<string, string> = {
  title: "Name",
  summary: "Short description",
  description: "Full description",
  website: "Website",
  public_email: "Public email",
  public_phone: "Public phone",
  accessibility_info: "Accessibility information",
  expanded_description: "Expanded description (Enhanced)",
  org_type: "Organization type",
  categories: "Categories",
  populations: "Populations served",
  languages: "Languages",
  name: "Location name",
  street: "Street address",
  street2: "Suite / unit",
  city: "City",
  zip: "ZIP code",
  phone: "Phone",
  email: "Email",
  hours: "Hours",
  hours_note: "Hours note",
  wheelchair_accessible: "Wheelchair accessible",
  accessible_parking: "Accessible parking",
  transit_info: "Public transportation",
  appointment_required: "Appointment required",
  virtual_services: "Virtual services",
  status: "Location status",
  eligibility: "Eligibility",
  age_min: "Minimum age",
  age_max: "Maximum age",
  is_free: "Free",
  referral_required: "Referral required",
  waitlist_status: "Accepting new clients",
  in_person: "In person",
  home_based: "Home based",
  virtual_available: "Virtual",
  contact_phone: "Contact phone",
  contact_email: "Contact email",
  insurance_notes: "Insurance notes",
  payment_notes: "Payment notes",
  payment_options: "Payment options",
  location_ids: "Locations",
  cost_text: "Cost",
  application_instructions: "How to apply",
  start_date: "Start date",
  end_date: "End date",
  event_type: "Event type",
  starts_at: "Starts",
  ends_at: "Ends",
  venue_name: "Venue",
  is_in_person: "In person",
  registration_url: "Registration link",
  accommodations: "Accessibility accommodations",
};

async function snapshot(sql: SqlClient, type: TargetType, targetId: string, fields: string[]) {
  const out: Record<string, unknown> = {};
  const listingId = type === "location" ? null : targetId;
  const plain = fields.filter((f) => !ARRAY_FIELDS.has(f));
  const listingCols = plain.filter((f) => LISTING_FIELDS.has(f));
  const typedCols = plain.filter((f) => !LISTING_FIELDS.has(f));
  if (listingId && listingCols.length) {
    const [row] = await sql.query<Record<string, unknown>>(`select ${listingCols.map((c) => `"${c}"`).join(", ")} from public.listings where id = $1`, [listingId]);
    Object.assign(out, row ?? {});
  }
  if (typedCols.length) {
    const [row] = await sql.query<Record<string, unknown>>(`select ${typedCols.map((c) => `"${c}"`).join(", ")} from public.${TYPED_TABLE[type]} where id = $1`, [targetId]);
    Object.assign(out, row ?? {});
  }
  for (const f of fields.filter((x) => ARRAY_FIELDS.has(x))) {
    if (f === "categories") out[f] = (await sql.query<{ slug: string }>("select c.slug from listing_categories lc join categories c on c.id = lc.category_id where lc.listing_id = $1 order by c.slug", [targetId])).map((r) => r.slug);
    if (f === "populations") out[f] = (await sql.query<{ slug: string }>("select p.slug from listing_populations lp join populations p on p.id = lp.population_id where lp.listing_id = $1 order by p.slug", [targetId])).map((r) => r.slug);
    if (f === "languages") out[f] = (await sql.query<{ code: string }>("select language_code as code from listing_languages where listing_id = $1 order by 1", [targetId])).map((r) => r.code);
    if (f === "payment_options") out[f] = (await sql.query<{ slug: string }>("select po.slug from service_payment_options spo join payment_options po on po.id = spo.payment_option_id where spo.service_id = $1 order by 1", [targetId])).map((r) => r.slug);
    if (f === "location_ids") out[f] = (await sql.query<{ id: string }>("select location_id as id from service_locations where service_id = $1 order by 1", [targetId])).map((r) => r.id);
  }
  return out;
}

/** Remove fields whose proposed value equals the current value. */
function diff(proposed: Record<string, unknown>, current: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(proposed)) {
    if (v === undefined) continue;
    const a = normalize(v);
    const b = normalize(current[k]);
    if (!sameValue(a, b)) out[k] = v;
  }
  return out;
}
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/;
function stableStringify(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
function normalize(v: unknown): unknown {
  if (v === "" || v === undefined) return null;
  // Arrays of objects (e.g. hours) compare by content, not "[object Object]".
  if (Array.isArray(v)) return [...v].map((x) => (x && typeof x === "object" ? stableStringify(x) : String(x))).sort();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && DATE_TIME.test(v) && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return v;
}
function sameValue(a: unknown, b: unknown) {
  // Date-only proposals (YYYY-MM-DD) against date columns returned as Date objects.
  if (typeof a === "string" && typeof b === "string") {
    if (DATE_ONLY.test(a) && DATE_TIME.test(b)) return a === b.slice(0, 10);
    if (DATE_ONLY.test(b) && DATE_TIME.test(a)) return b === a.slice(0, 10);
  }
  return stableStringify(a) === stableStringify(b);
}

async function targetOrganization(sql: SqlClient, type: TargetType, targetId: string): Promise<string | null> {
  if (type === "organization") return targetId;
  const table = TYPED_TABLE[type];
  const [row] = await sql.query<{ organization_id: string | null }>(`select organization_id from public.${table} where id = $1`, [targetId]);
  return row?.organization_id ?? null;
}

export interface SubmitChangeInput<T extends TargetType = TargetType> {
  organizationId: string;
  targetType: T;
  targetId: string | null; // null => create
  proposed: Proposal<T>;
  summary: string;
  sources?: { label: string; url?: string | null }[];
  submittedBy: string;
}

/**
 * Validates and records a proposed change, opens a verification task, and
 * notifies verifiers. Must be called AFTER assertOrganizationAccess().
 * Runs inside the caller's service transaction.
 */
export async function submitChangeRequest(sql: SqlClient, input: SubmitChangeInput) {
  const schema = proposalSchemas[input.targetType];
  const parsed = schema.safeParse(input.proposed);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    throw new UserFacingError("Some of the information needs to be corrected.", fieldErrors);
  }
  const proposed = parsed.data as Record<string, unknown>;
  const action = input.targetId ? "update" : "create";

  if (action === "create") {
    const missing = REQUIRED_ON_CREATE[input.targetType].filter((f) => proposed[f] === undefined || proposed[f] === null || proposed[f] === "");
    if (missing.length) {
      throw new UserFacingError("Please complete the required fields.", Object.fromEntries(missing.map((f) => [f, `${FIELD_LABELS[f] ?? f} is required.`])));
    }
  } else {
    const owner = await targetOrganization(sql, input.targetType, input.targetId!);
    if (owner !== input.organizationId) throw new UserFacingError("This record does not belong to the selected organization.");
  }

  const current = input.targetId ? await snapshot(sql, input.targetType, input.targetId, Object.keys(proposed)) : {};
  const changes = input.targetId ? diff(proposed, current) : proposed;
  if (Object.keys(changes).length === 0) throw new UserFacingError("No changes were detected. Edit at least one field before submitting.");
  const currentSubset = Object.fromEntries(Object.keys(changes).map((k) => [k, current[k] ?? null]));

  const listingId =
    input.targetType === "location" ? input.organizationId : input.targetId ?? null;

  const [cr] = await sql.query<{ id: string }>(
    `insert into public.provider_change_requests
       (organization_id, listing_id, target_type, target_id, action, summary, proposed, current_snapshot, sources, status, submitted_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review', $10) returning id`,
    [
      input.organizationId,
      listingId,
      input.targetType,
      input.targetId,
      action,
      input.summary.slice(0, 300),
      JSON.stringify(changes),
      JSON.stringify(currentSubset),
      JSON.stringify(input.sources ?? []),
      input.submittedBy,
    ],
  );

  const [org] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [input.organizationId]);
  await sql.query(
    `insert into public.verification_tasks (listing_id, reason, priority, status, change_request_id, details, due_at)
     values ($1, 'provider_update', 'normal', 'open', $2, $3, (now() + interval '5 days')::date)`,
    [listingId ?? input.organizationId, cr.id, `Provider submitted: ${input.summary.slice(0, 200)}`],
  );
  await notifyRole(sql, ["verifier"], {
    kind: "task_assigned",
    title: `Provider update ready for review: ${org?.title ?? "organization"}`,
    body: input.summary,
    link: "/verify",
  });
  await audit(sql, {
    actorId: input.submittedBy,
    action: "provider_update.submitted",
    entityType: "provider_change_request",
    entityId: cr.id,
    entityLabel: `${org?.title ?? ""} — ${input.summary}`.slice(0, 200),
    previous: currentSubset,
    next: changes,
  });
  return { id: cr.id, changes };
}

async function slugIds(sql: SqlClient, table: "categories" | "populations" | "payment_options", slugs: string[]) {
  if (!slugs.length) return [];
  const rows = await sql.query<{ id: number; slug: string }>(`select id, slug from public.${table} where slug = any($1)`, [slugs]);
  return rows.map((r) => r.id);
}

/** Applies an approved change request to the directory. Service transaction only. */
export async function applyChangeRequest(sql: SqlClient, changeRequestId: string, reviewerId: string, reviewMessage?: string | null) {
  const [cr] = await sql.query<{
    id: string; organization_id: string; target_type: TargetType; target_id: string | null; action: string; proposed: Record<string, unknown>; status: string; submitted_by: string; summary: string;
  }>("select * from public.provider_change_requests where id = $1 for update", [changeRequestId]);
  if (!cr) throw new UserFacingError("This change request no longer exists.");
  if (!["pending_review", "more_info_required"].includes(cr.status)) throw new UserFacingError("This change request has already been reviewed.");

  const parsed = proposalSchemas[cr.target_type].safeParse(cr.proposed);
  if (!parsed.success) throw new UserFacingError("The proposed values are no longer valid. Ask the provider to resubmit.");
  const proposed = parsed.data as Record<string, unknown>;
  const type = cr.target_type;
  let targetId = cr.target_id;

  // ---- create new records
  if (cr.action === "create") {
    if (type === "location") {
      const place = await sql.query<{ county_id: number; lat: number; lng: number }>(
        `select county_id, extensions.st_y(geog::extensions.geometry) as lat, extensions.st_x(geog::extensions.geometry) as lng
         from public.places where zip = $1 or lower(name) = lower($2) order by (zip = $1) desc limit 1`,
        [proposed.zip, proposed.city],
      );
      if (!place[0]) throw new UserFacingError("We couldn't place this ZIP code in Michigan. Please confirm the address with the provider.");
      const [loc] = await sql.query<{ id: string }>(
        `insert into public.organization_locations (organization_id, name, street, city, zip, county_id, geog)
         values ($1, $2, $3, $4, $5, $6, extensions.st_setsrid(extensions.st_makepoint($7, $8), 4326)::extensions.geography) returning id`,
        [cr.organization_id, proposed.name, proposed.street, proposed.city, proposed.zip, place[0].county_id, place[0].lng, place[0].lat],
      );
      targetId = loc.id;
    } else {
      const base = String(proposed.title ?? "record").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const [{ n }] = await sql.query<{ n: number }>("select count(*)::int as n from public.listings where kind = $1 and slug like $2", [type, `${base}%`]);
      const slug = n ? `${base}-${n + 1}` : base;
      const [listing] = await sql.query<{ id: string }>(
        `insert into public.listings (kind, slug, title, summary, description, publication_status, verification_status, created_by)
         values ($1, $2, $3, $4, $5, 'published', 'pending_review', $6) returning id`,
        [type, slug, proposed.title, proposed.summary ?? "", proposed.description ?? "", cr.submitted_by],
      );
      targetId = listing.id;
      if (type === "service") {
        await sql.query("insert into public.services (id, organization_id) values ($1, $2)", [targetId, cr.organization_id]);
      } else if (type === "program") {
        await sql.query("insert into public.programs (id, organization_id) values ($1, $2)", [targetId, cr.organization_id]);
      } else if (type === "event") {
        const [org] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [cr.organization_id]);
        await sql.query(
          "insert into public.events (id, organization_id, organizer_name, starts_at, ends_at) values ($1, $2, $3, $4, $5)",
          [targetId, cr.organization_id, org?.title ?? "Organizer", proposed.starts_at, proposed.ends_at],
        );
      }
      // Inherit the organization's service areas so new records are geographically searchable.
      await sql.query(
        `insert into public.service_areas (listing_id, scope, county_id, center, radius_miles)
         select $1, scope, county_id, center, radius_miles from public.service_areas where listing_id = $2`,
        [targetId, cr.organization_id],
      );
    }
  }
  if (!targetId) throw new UserFacingError("The record to update could not be found.");

  // ---- scalar fields
  const listingSets: string[] = [];
  const listingVals: unknown[] = [];
  const typedSets: string[] = [];
  const typedVals: unknown[] = [];
  for (const [field, value] of Object.entries(proposed)) {
    if (ARRAY_FIELDS.has(field) || value === undefined) continue;
    const v = value === "" ? null : field === "hours" ? JSON.stringify(value) : value;
    if (LISTING_FIELDS.has(field) && type !== "location") {
      listingVals.push(v);
      listingSets.push(`"${field}" = $${listingVals.length}`);
    } else if (!LISTING_FIELDS.has(field)) {
      typedVals.push(v);
      typedSets.push(`"${field}" = $${typedVals.length}`);
    }
  }
  if (listingSets.length) {
    listingVals.push(targetId);
    await sql.query(`update public.listings set ${listingSets.join(", ")} where id = $${listingVals.length}`, listingVals);
  }
  if (typedSets.length) {
    typedVals.push(targetId);
    await sql.query(`update public.${TYPED_TABLE[type]} set ${typedSets.join(", ")} where id = $${typedVals.length}`, typedVals);
  }
  // Re-geocode a location if its ZIP changed (approximate centroid; verifier can refine).
  if (type === "location" && cr.action === "update" && proposed.zip) {
    await sql.query(
      `update public.organization_locations ol set county_id = p.county_id, geog = p.geog
       from (select county_id, geog from public.places where zip = $2 limit 1) p where ol.id = $1`,
      [targetId, proposed.zip],
    );
  }

  // ---- relationship fields
  if (proposed.categories) {
    const ids = await slugIds(sql, "categories", proposed.categories as string[]);
    await sql.query("delete from public.listing_categories where listing_id = $1", [targetId]);
    for (const [i, id] of ids.entries()) await sql.query("insert into public.listing_categories (listing_id, category_id, is_primary) values ($1, $2, $3)", [targetId, id, i === 0]);
  }
  if (proposed.populations) {
    const ids = await slugIds(sql, "populations", proposed.populations as string[]);
    await sql.query("delete from public.listing_populations where listing_id = $1", [targetId]);
    for (const id of ids) await sql.query("insert into public.listing_populations (listing_id, population_id) values ($1, $2)", [targetId, id]);
  }
  if (proposed.languages) {
    await sql.query("delete from public.listing_languages where listing_id = $1", [targetId]);
    for (const code of proposed.languages as string[]) {
      await sql.query("insert into public.listing_languages (listing_id, language_code) select $1, code from public.languages where code = $2", [targetId, code]);
    }
  }
  if (proposed.payment_options && type === "service") {
    const ids = await slugIds(sql, "payment_options", proposed.payment_options as string[]);
    await sql.query("delete from public.service_payment_options where service_id = $1", [targetId]);
    for (const id of ids) await sql.query("insert into public.service_payment_options (service_id, payment_option_id) values ($1, $2)", [targetId, id]);
  }
  if (proposed.location_ids && type === "service") {
    await sql.query("delete from public.service_locations where service_id = $1", [targetId]);
    for (const id of proposed.location_ids as string[]) {
      await sql.query(
        "insert into public.service_locations (service_id, location_id) select $1, id from public.organization_locations where id = $2 and organization_id = $3",
        [targetId, id, cr.organization_id],
      );
    }
  }
  // Make sure search documents reflect the change (covers typed-table-only edits).
  await sql.query("select app.refresh_listing_search($1)", [type === "location" ? cr.organization_id : targetId]);
  if (type === "location") {
    await sql.query("select app.refresh_listing_search(s.id) from public.services s where s.organization_id = $1", [cr.organization_id]);
  }

  await sql.query(
    `update public.provider_change_requests set status = 'approved', reviewer_id = $2, review_message = $3, reviewed_at = now(),
       target_id = coalesce(target_id, $4) where id = $1`,
    [cr.id, reviewerId, reviewMessage ?? null, targetId],
  );
  const sendEmail = await notify(sql, {
    userId: cr.submitted_by,
    kind: "change_approved",
    title: "Your organization update was approved.",
    body: `“${cr.summary}” is now published on MittenLink.`,
    link: "/provider/verification",
    email: true,
  });
  await audit(sql, {
    actorId: reviewerId,
    action: "provider_update.published",
    entityType: "provider_change_request",
    entityId: cr.id,
    entityLabel: cr.summary,
    next: proposed,
    metadata: { target_type: type, target_id: targetId, created: cr.action === "create" },
  });
  return { targetId, listingId: type === "location" ? cr.organization_id : targetId, sendEmail };
}

/** Rejects or asks for more information on a change request. Service transaction only. */
export async function reviewChangeRequest(
  sql: SqlClient,
  changeRequestId: string,
  reviewerId: string,
  decision: "rejected" | "more_info_required",
  message: string,
) {
  const [cr] = await sql.query<{ id: string; status: string; submitted_by: string; summary: string }>(
    "select id, status, submitted_by, summary from public.provider_change_requests where id = $1 for update",
    [changeRequestId],
  );
  if (!cr) throw new UserFacingError("This change request no longer exists.");
  if (!["pending_review", "more_info_required"].includes(cr.status)) throw new UserFacingError("This change request has already been reviewed.");
  await sql.query(
    "update public.provider_change_requests set status = $2, reviewer_id = $3, review_message = $4, reviewed_at = now() where id = $1",
    [cr.id, decision, reviewerId, message],
  );
  const sendEmail = await notify(sql, {
    userId: cr.submitted_by,
    kind: decision === "rejected" ? "change_rejected" : "change_more_info",
    title: decision === "rejected" ? "Your organization update was not approved." : "Your organization update requires additional information.",
    body: message,
    link: "/provider/verification",
    email: true,
  });
  await audit(sql, {
    actorId: reviewerId,
    action: decision === "rejected" ? "provider_update.rejected" : "provider_update.more_info_requested",
    entityType: "provider_change_request",
    entityId: cr.id,
    entityLabel: cr.summary,
    previous: { status: cr.status },
    next: { status: decision },
  });
  return { sendEmail };
}
