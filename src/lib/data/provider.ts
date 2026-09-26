import "server-only";
import { redirect } from "next/navigation";
import { asService } from "@/lib/db";
import { asCurrentUser, requireOrganizationAccess, requireUser, type CurrentUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/provider/active-org";
import { getCurrentSubscription, getPlanSettings, type PlanSettings, type SubscriptionRecord } from "@/lib/integrations/billing";

/*
 * Read models for the Provider Dashboard.
 *
 * Every page first calls loadProviderContext(), which requires a signed-in
 * user who actively manages the organization (requireOrganizationAccess).
 * Only after that check do the helpers below read with asService, always
 * scoped to that organization id.
 */

export type MemberRole = "owner" | "manager" | "editor";

export interface ProviderContext {
  user: CurrentUser;
  org: { id: string; title: string; slug: string };
  memberRole: MemberRole | null;
  /** Owners and managers can manage billing; editors cannot. */
  canManageBilling: boolean;
}

export async function loadProviderContext(path = "/provider"): Promise<ProviderContext> {
  const user = await requireUser(path);
  const org = await getActiveOrganization(user);
  if (!org) redirect("/provider");
  await requireOrganizationAccess(org.id, path);
  const [member] = await asService((sql) =>
    sql.query<{ member_role: MemberRole }>(
      "select member_role from public.provider_members where organization_id = $1 and user_id = $2 and status = 'active'",
      [org.id, user.id],
    ),
  );
  const memberRole = member?.member_role ?? null;
  return { user, org, memberRole, canManageBilling: memberRole === "owner" || memberRole === "manager" };
}

// ---------------------------------------------------------------- reference data
export interface Option {
  value: string;
  label: string;
}
export interface ReferenceOptions {
  categories: Option[];
  populations: Option[];
  languages: Option[];
  paymentOptions: Option[];
}

export async function getReferenceOptions(): Promise<ReferenceOptions> {
  return asService(async (sql) => {
    const categories = await sql.query<Option>("select slug as value, name as label from public.categories where is_active order by sort_order, name");
    const populations = await sql.query<Option>("select slug as value, name as label from public.populations order by sort_order, name");
    const languages = await sql.query<Option>("select code as value, name as label from public.languages order by sort_order, name");
    const paymentOptions = await sql.query<Option>("select slug as value, name as label from public.payment_options order by sort_order, name");
    return { categories, populations, languages, paymentOptions };
  });
}

// ---------------------------------------------------------------- organization
export interface OrganizationRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  last_verified_at: Date | null;
  next_review_at: Date | string | null;
  org_type: string;
  website: string | null;
  public_email: string | null;
  public_phone: string | null;
  accessibility_info: string | null;
  expanded_description: string | null;
  logo_path: string | null;
  logo_alt: string | null;
  listing_tier: "free" | "enhanced";
  claimed_at: Date | null;
  categories: string[];
  populations: string[];
  languages: string[];
}

export async function getOrganization(orgId: string): Promise<OrganizationRecord | null> {
  const [row] = await asService((sql) =>
    sql.query<OrganizationRecord>(
      `select l.id, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.last_verified_at, l.next_review_at,
              o.org_type, o.website, o.public_email, o.public_phone, o.accessibility_info, o.expanded_description, o.logo_path, o.logo_alt,
              o.listing_tier, o.claimed_at,
              array(select c.slug from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id order by lc.is_primary desc, c.slug) as categories,
              array(select p.slug from public.listing_populations lp join public.populations p on p.id = lp.population_id where lp.listing_id = l.id order by p.slug) as populations,
              array(select ll.language_code from public.listing_languages ll where ll.listing_id = l.id order by ll.language_code) as languages
       from public.listings l join public.organizations o on o.id = l.id where l.id = $1`,
      [orgId],
    ),
  );
  return row ?? null;
}

// ---------------------------------------------------------------- locations
export interface HoursEntry {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: string;
  close: string;
}
export interface LocationRecord {
  id: string;
  name: string;
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  county_name: string | null;
  phone: string | null;
  email: string | null;
  hours: HoursEntry[];
  hours_note: string | null;
  wheelchair_accessible: boolean | null;
  accessible_parking: boolean | null;
  transit_info: string | null;
  appointment_required: boolean;
  virtual_services: boolean;
  status: "open" | "temporarily_closed" | "closed";
  is_primary: boolean;
}

export async function listLocations(orgId: string): Promise<LocationRecord[]> {
  const rows = await asService((sql) =>
    sql.query<LocationRecord>(
      `select ol.id, ol.name, ol.street, ol.street2, ol.city, ol.state, ol.zip, c.name as county_name, ol.phone, ol.email, ol.hours, ol.hours_note,
              ol.wheelchair_accessible, ol.accessible_parking, ol.transit_info, ol.appointment_required, ol.virtual_services, ol.status, ol.is_primary
       from public.organization_locations ol left join public.counties c on c.id = ol.county_id
       where ol.organization_id = $1 order by ol.is_primary desc, ol.sort_order, ol.name`,
      [orgId],
    ),
  );
  return rows.map((r) => ({ ...r, hours: Array.isArray(r.hours) ? r.hours : typeof r.hours === "string" ? JSON.parse(r.hours) : [] }));
}

// ---------------------------------------------------------------- services
export interface ServiceRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  last_verified_at: Date | null;
  virtual_available: boolean;
  eligibility: string | null;
  age_min: number | null;
  age_max: number | null;
  is_free: boolean;
  referral_required: boolean;
  waitlist_status: string;
  in_person: boolean;
  home_based: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  insurance_notes: string | null;
  payment_notes: string | null;
  is_featured: boolean;
  categories: string[];
  populations: string[];
  languages: string[];
  payment_options: string[];
  location_ids: string[];
}

export async function listServices(orgId: string): Promise<ServiceRecord[]> {
  return asService((sql) =>
    sql.query<ServiceRecord>(
      `select l.id, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.last_verified_at, l.virtual_available,
              s.eligibility, s.age_min, s.age_max, s.is_free, s.referral_required, s.waitlist_status, s.in_person, s.home_based,
              s.contact_phone, s.contact_email, s.insurance_notes, s.payment_notes, s.is_featured,
              array(select c.slug from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id order by lc.is_primary desc, c.slug) as categories,
              array(select p.slug from public.listing_populations lp join public.populations p on p.id = lp.population_id where lp.listing_id = l.id order by p.slug) as populations,
              array(select ll.language_code from public.listing_languages ll where ll.listing_id = l.id order by 1) as languages,
              array(select po.slug from public.service_payment_options spo join public.payment_options po on po.id = spo.payment_option_id where spo.service_id = l.id order by 1) as payment_options,
              array(select sl.location_id::text from public.service_locations sl where sl.service_id = l.id order by 1) as location_ids
       from public.services s join public.listings l on l.id = s.id
       where s.organization_id = $1 and l.publication_status <> 'archived'
       order by s.is_featured desc, l.title`,
      [orgId],
    ),
  );
}

// ---------------------------------------------------------------- programs
export interface ProgramRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  virtual_available: boolean;
  eligibility: string | null;
  cost_text: string | null;
  is_free: boolean;
  application_instructions: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  categories: string[];
  populations: string[];
}

export async function listPrograms(orgId: string): Promise<ProgramRecord[]> {
  return asService((sql) =>
    sql.query<ProgramRecord>(
      `select l.id, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.virtual_available,
              p.eligibility, p.cost_text, p.is_free, p.application_instructions, p.start_date, p.end_date, p.website, p.contact_email, p.contact_phone,
              array(select c.slug from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id order by lc.is_primary desc, c.slug) as categories,
              array(select po.slug from public.listing_populations lp join public.populations po on po.id = lp.population_id where lp.listing_id = l.id order by po.slug) as populations
       from public.programs p join public.listings l on l.id = p.id
       where p.organization_id = $1 and l.publication_status <> 'archived'
       order by l.title`,
      [orgId],
    ),
  );
}

// ---------------------------------------------------------------- events
export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  virtual_available: boolean;
  event_type: string;
  starts_at: Date;
  ends_at: Date;
  venue_name: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  is_in_person: boolean;
  registration_url: string | null;
  cost_text: string | null;
  is_free: boolean;
  accommodations: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  categories: string[];
  populations: string[];
}

export async function listEvents(orgId: string): Promise<EventRecord[]> {
  return asService((sql) =>
    sql.query<EventRecord>(
      `select l.id, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.virtual_available,
              e.event_type, e.starts_at, e.ends_at, e.venue_name, e.street, e.city, e.zip, e.is_in_person, e.registration_url, e.cost_text, e.is_free,
              e.accommodations, e.contact_email, e.contact_phone,
              array(select c.slug from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id order by lc.is_primary desc, c.slug) as categories,
              array(select po.slug from public.listing_populations lp join public.populations po on po.id = lp.population_id where lp.listing_id = l.id order by po.slug) as populations
       from public.events e join public.listings l on l.id = e.id
       where e.organization_id = $1 and l.publication_status <> 'archived'
       order by e.starts_at desc`,
      [orgId],
    ),
  );
}

// ---------------------------------------------------------------- change requests
export const OPEN_CHANGE_STATUSES = ["pending_review", "more_info_required"] as const;

export interface ChangeRequestRecord {
  id: string;
  target_type: "organization" | "location" | "service" | "program" | "event";
  target_id: string | null;
  action: "create" | "update" | "archive";
  summary: string;
  proposed: Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  sources: { label: string; url?: string | null }[];
  status: string;
  submitted_by: string;
  submitted_by_name: string | null;
  review_message: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  target_title: string | null;
  target_slug: string | null;
}

export async function listChangeRequests(orgId: string, opts: { openOnly?: boolean; limit?: number } = {}): Promise<ChangeRequestRecord[]> {
  return asService((sql) =>
    sql.query<ChangeRequestRecord>(
      `select cr.id, cr.target_type, cr.target_id, cr.action, cr.summary, cr.proposed, cr.current_snapshot, cr.sources, cr.status,
              cr.submitted_by, p.full_name as submitted_by_name, cr.review_message, cr.reviewed_at, cr.created_at,
              coalesce(l.title, loc.name, cr.proposed->>'title', cr.proposed->>'name') as target_title,
              l.slug as target_slug
       from public.provider_change_requests cr
       left join public.profiles p on p.id = cr.submitted_by
       left join public.listings l on l.id = cr.target_id and cr.target_type <> 'location'
       left join public.organization_locations loc on loc.id = cr.target_id and cr.target_type = 'location'
       where cr.organization_id = $1 and ($2::boolean = false or cr.status in ('pending_review', 'more_info_required'))
       order by cr.created_at desc
       limit $3`,
      [orgId, !!opts.openOnly, opts.limit ?? 200],
    ),
  );
}

export async function getChangeRequest(orgId: string, id: string): Promise<ChangeRequestRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await listChangeRequests(orgId);
  return rows.find((r) => r.id === id) ?? null;
}

/** Latest open change request per target id (for "Update pending review" banners). */
export function openRequestsByTarget(requests: ChangeRequestRecord[]) {
  const map = new Map<string, ChangeRequestRecord>();
  for (const r of requests) {
    if (!r.target_id || !(OPEN_CHANGE_STATUSES as readonly string[]).includes(r.status)) continue;
    if (!map.has(r.target_id)) map.set(r.target_id, r);
  }
  return map;
}

// ---------------------------------------------------------------- notifications
export interface NotificationRecord {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: Date | null;
  created_at: Date;
}

export async function getRecentNotifications(limit = 5): Promise<NotificationRecord[]> {
  return asCurrentUser((sql) =>
    sql.query<NotificationRecord>(
      "select id, kind, title, body, link_url, read_at, created_at from public.notifications where user_id = auth.uid() order by created_at desc limit $1",
      [limit],
    ),
  );
}

// ---------------------------------------------------------------- verification history
export interface PublicHistoryRecord {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_kind: string;
  new_status: string;
  action: string;
  method: string | null;
  public_summary: string | null;
  created_at: Date;
}

export async function getVerificationHistory(orgId: string, limit = 25): Promise<PublicHistoryRecord[]> {
  return asService((sql) =>
    sql.query<PublicHistoryRecord>(
      `select h.id, h.listing_id, l.title as listing_title, l.kind as listing_kind, h.new_status, h.action, h.method, h.public_summary, h.created_at
       from public.public_verification_history h join public.listings l on l.id = h.listing_id
       where app.listing_organization(h.listing_id) = $1
       order by h.created_at desc limit $2`,
      [orgId, limit],
    ),
  );
}

// ---------------------------------------------------------------- overview
export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export function profileCompleteness(org: OrganizationRecord, locations: LocationRecord[], serviceCount: number) {
  const items: CompletenessItem[] = [
    { key: "description", label: "Full description", done: org.description.trim().length >= 40, href: "/provider/organization#field-description" },
    { key: "website", label: "Website", done: !!org.website, href: "/provider/organization#field-contact" },
    { key: "phone", label: "Public phone", done: !!org.public_phone, href: "/provider/organization#field-contact" },
    { key: "email", label: "Public email", done: !!org.public_email, href: "/provider/organization#field-contact" },
    { key: "accessibility", label: "Accessibility information", done: !!org.accessibility_info?.trim(), href: "/provider/organization#field-accessibility" },
    { key: "hours", label: "At least one location with hours", done: locations.some((l) => l.hours.length > 0 && l.status !== "closed"), href: "/provider/locations" },
    { key: "service", label: "At least one service", done: serviceCount > 0, href: "/provider/services/new" },
    { key: "categories", label: "Service categories", done: org.categories.length > 0, href: "/provider/organization#field-categories" },
    { key: "populations", label: "Populations served", done: org.populations.length > 0, href: "/provider/organization#field-populations" },
    { key: "languages", label: "Languages", done: org.languages.length > 0, href: "/provider/organization#field-languages" },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, percent: Math.round((done / items.length) * 100), missing: items.filter((i) => !i.done) };
}

export async function getOverviewCounts(orgId: string) {
  const [row] = await asService((sql) =>
    sql.query<{ locations: number; services: number; programs: number; events: number }>(
      `select
         (select count(*)::int from public.organization_locations where organization_id = $1 and status <> 'closed') as locations,
         (select count(*)::int from public.services s join public.listings l on l.id = s.id where s.organization_id = $1 and l.publication_status <> 'archived') as services,
         (select count(*)::int from public.programs p join public.listings l on l.id = p.id where p.organization_id = $1 and l.publication_status <> 'archived') as programs,
         (select count(*)::int from public.events e join public.listings l on l.id = e.id where e.organization_id = $1 and l.publication_status <> 'archived' and e.ends_at >= now()) as events`,
      [orgId],
    ),
  );
  return row ?? { locations: 0, services: 0, programs: 0, events: 0 };
}

// ---------------------------------------------------------------- analytics
export interface AnalyticsSummary {
  views30: number;
  viewsPrev30: number;
  serviceViews30: number;
  saves: number;
  saves30: number;
  buckets: { label: string; start: Date; end: Date; views: number }[];
  sources: { source: string; views: number }[];
}

export async function getListingAnalytics(orgId: string): Promise<AnalyticsSummary> {
  return asService(async (sql) => {
    const [totals] = await sql.query<{ views30: number; views_prev30: number; service_views30: number; saves: number; saves30: number }>(
      `select
         (select count(*)::int from public.analytics_events where event_name = 'provider_viewed' and listing_id = $1 and created_at >= now() - interval '30 days') as views30,
         (select count(*)::int from public.analytics_events where event_name = 'provider_viewed' and listing_id = $1 and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days') as views_prev30,
         (select count(*)::int from public.analytics_events a join public.services s on s.id = a.listing_id where a.event_name = 'service_viewed' and s.organization_id = $1 and a.created_at >= now() - interval '30 days') as service_views30,
         (select count(*)::int from public.saved_resources sr where app.listing_organization(sr.listing_id) = $1) as saves,
         (select count(*)::int from public.saved_resources sr where app.listing_organization(sr.listing_id) = $1 and sr.created_at >= now() - interval '30 days') as saves30`,
      [orgId],
    );
    const bucketRows = await sql.query<{ bucket: number; views: number }>(
      `select floor(extract(epoch from (now() - created_at)) / (7 * 86400))::int as bucket, count(*)::int as views
       from public.analytics_events
       where event_name = 'provider_viewed' and listing_id = $1 and created_at >= now() - interval '30 days'
       group by 1`,
      [orgId],
    );
    const sources = await sql.query<{ source: string; views: number }>(
      `select coalesce(nullif(properties->>'source', ''), 'other') as source, count(*)::int as views
       from public.analytics_events
       where event_name = 'provider_viewed' and listing_id = $1 and created_at >= now() - interval '30 days'
       group by 1 order by 2 desc, 1 limit 8`,
      [orgId],
    );
    const now = Date.now();
    const DAY = 86400000;
    const buckets = [4, 3, 2, 1, 0].map((b) => {
      const end = new Date(now - b * 7 * DAY);
      const start = new Date(Math.max(now - 30 * DAY, now - (b + 1) * 7 * DAY));
      return { label: "", start, end, views: bucketRows.find((r) => r.bucket === b)?.views ?? 0 };
    });
    return {
      views30: totals?.views30 ?? 0,
      viewsPrev30: totals?.views_prev30 ?? 0,
      serviceViews30: totals?.service_views30 ?? 0,
      saves: totals?.saves ?? 0,
      saves30: totals?.saves30 ?? 0,
      buckets,
      sources,
    };
  });
}

// ---------------------------------------------------------------- billing
export interface BillingEventRecord {
  id: string;
  event_type: string;
  summary: string | null;
  billing_provider: string;
  livemode: boolean;
  created_at: Date;
}

export async function getBillingOverview(orgId: string): Promise<{ plan: PlanSettings; subscription: SubscriptionRecord | null; events: BillingEventRecord[] }> {
  return asService(async (sql) => {
    const plan = await getPlanSettings(sql);
    const subscription = await getCurrentSubscription(sql, orgId);
    const events = await sql.query<BillingEventRecord>(
      "select id, event_type, summary, billing_provider, livemode, created_at from public.billing_events where organization_id = $1 order by created_at desc limit 25",
      [orgId],
    );
    return { plan, subscription, events };
  });
}

export async function getPlanOnly(): Promise<PlanSettings> {
  return asService((sql) => getPlanSettings(sql));
}

// ---------------------------------------------------------------- media
export interface MediaRecord {
  id: string;
  kind: string;
  storage_path: string;
  alt_text: string;
  status: "pending_review" | "approved" | "rejected";
  created_at: Date;
}

export async function listLogoMedia(orgId: string): Promise<MediaRecord[]> {
  return asService((sql) =>
    sql.query<MediaRecord>(
      "select id, kind, storage_path, alt_text, status, created_at from public.organization_media where organization_id = $1 and kind = 'logo' order by created_at desc limit 5",
      [orgId],
    ),
  );
}

// ---------------------------------------------------------------- lookups for diffs
export interface DiffLookups {
  categories: Record<string, string>;
  populations: Record<string, string>;
  languages: Record<string, string>;
  paymentOptions: Record<string, string>;
  locations: Record<string, string>;
}

export async function getDiffLookups(orgId: string, ref?: ReferenceOptions): Promise<DiffLookups> {
  const options = ref ?? (await getReferenceOptions());
  const locs = await asService((sql) =>
    sql.query<{ id: string; name: string }>("select id, name from public.organization_locations where organization_id = $1", [orgId]),
  );
  const toMap = (o: Option[]) => Object.fromEntries(o.map((x) => [x.value, x.label]));
  return {
    categories: toMap(options.categories),
    populations: toMap(options.populations),
    languages: toMap(options.languages),
    paymentOptions: toMap(options.paymentOptions),
    locations: Object.fromEntries(locs.map((l) => [l.id, l.name])),
  };
}
