import "server-only";
import { asService, type SqlClient } from "@/lib/db";

/*
 * Read models for the admin record-management screens. Every function here
 * uses the privileged service connection, so callers MUST have already
 * checked the admin role (the admin layout + requireAdmin() on each page).
 */

export const PAGE_SIZE = 25;

const offsetFor = (page: number) => (Math.max(1, page) - 1) * PAGE_SIZE;

/** Escape LIKE wildcards in user input. */
export function likePattern(q: string | undefined) {
  if (!q) return null;
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export interface RefOption {
  value: string;
  label: string;
}

export async function getReferenceOptions() {
  return asService(async (sql) => {
    const counties = await sql.query<{ id: number; name: string; region: string }>("select id, name, region from public.counties order by name");
    const categories = await sql.query<{ id: number; name: string; is_active: boolean }>("select id, name, is_active from public.categories order by sort_order, name");
    const populations = await sql.query<{ id: number; name: string }>("select id, name from public.populations order by sort_order, name");
    const regions = [...new Set(counties.map((c) => c.region))].sort();
    return {
      counties: counties.map((c) => ({ value: String(c.id), label: `${c.name} County` })),
      regions: regions.map((r) => ({ value: r, label: r })),
      categories: categories.map((c) => ({ value: String(c.id), label: c.is_active ? c.name : `${c.name} (inactive)` })),
      populations: populations.map((p) => ({ value: String(p.id), label: p.name })),
    };
  });
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export interface OrgListFilters {
  q?: string;
  verification?: string;
  tier?: string;
  claimed?: string;
  county?: string;
  region?: string;
  publication?: string;
  page: number;
}

export interface OrgListRow {
  id: string;
  slug: string;
  title: string;
  org_type: string;
  primary_city: string | null;
  county: string | null;
  verification_status: string;
  listing_tier: string;
  claimed: boolean;
  publication_status: string;
  last_verified_at: Date | null;
  is_demo: boolean;
  locations: number;
  services: number;
  total: number;
}

export async function listOrganizations(f: OrgListFilters) {
  const rows = await asService((sql) =>
    sql.query<OrgListRow>(
      `select l.id, l.slug, l.title, o.org_type, l.primary_city, c.name as county, l.verification_status, o.listing_tier,
              (o.claimed_at is not null) as claimed, l.publication_status, l.last_verified_at, l.is_demo,
              (select count(*)::int from public.organization_locations ol where ol.organization_id = l.id) as locations,
              (select count(*)::int from public.services s where s.organization_id = l.id) as services,
              count(*) over ()::int as total
       from public.listings l
       join public.organizations o on o.id = l.id
       left join public.counties c on c.id = l.primary_county_id
       where ($1::text is null or l.title ilike $1 or extensions.similarity(lower(l.title), lower($2)) > 0.35)
         and ($3::text is null or l.verification_status = $3)
         and ($4::text is null or o.listing_tier = $4)
         and ($5::text is null or ($5 = 'yes' and o.claimed_at is not null) or ($5 = 'no' and o.claimed_at is null))
         and ($6::int is null or l.primary_county_id = $6
              or exists (select 1 from public.organization_locations ol where ol.organization_id = l.id and ol.county_id = $6))
         and ($7::text is null or c.region = $7)
         and ($8::text is null or l.publication_status = $8)
       order by l.title
       limit ${PAGE_SIZE} offset $9`,
      [likePattern(f.q), f.q ?? "", f.verification ?? null, f.tier ?? null, f.claimed ?? null, f.county ? Number(f.county) : null, f.region ?? null, f.publication ?? null, offsetFor(f.page)],
    ),
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

export interface OrgAdmin {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  last_verified_at: Date | null;
  next_review_at: string | null;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
  primary_city: string | null;
  county: string | null;
  org_type: string;
  website: string | null;
  public_email: string | null;
  public_phone: string | null;
  accessibility_info: string | null;
  expanded_description: string | null;
  logo_path: string | null;
  logo_alt: string | null;
  claimed_at: Date | null;
  listing_tier: string;
  founded_year: number | null;
}

export async function getOrganizationAdmin(id: string) {
  return asService(async (sql) => {
    const [org] = await sql.query<OrgAdmin>(
      `select l.id, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.last_verified_at,
              l.next_review_at::text as next_review_at, l.is_demo, l.created_at, l.updated_at, l.primary_city, c.name as county,
              o.org_type, o.website, o.public_email, o.public_phone, o.accessibility_info, o.expanded_description, o.logo_path, o.logo_alt,
              o.claimed_at, o.listing_tier, o.founded_year
       from public.listings l join public.organizations o on o.id = l.id
       left join public.counties c on c.id = l.primary_county_id
       where l.id = $1`,
      [id],
    );
    if (!org) return null;
    const locations = await sql.query<{
      id: string; name: string; street: string; street2: string | null; city: string; zip: string; county: string; phone: string | null;
      wheelchair_accessible: boolean | null; status: string; is_primary: boolean;
    }>(
      `select ol.id, ol.name, ol.street, ol.street2, ol.city, ol.zip, c.name as county, ol.phone, ol.wheelchair_accessible, ol.status, ol.is_primary
       from public.organization_locations ol join public.counties c on c.id = ol.county_id
       where ol.organization_id = $1 order by ol.is_primary desc, ol.sort_order, ol.name`,
      [id],
    );
    const children = await sql.query<{
      id: string; kind: string; slug: string; title: string; verification_status: string; publication_status: string; last_verified_at: Date | null; starts_at: Date | null;
    }>(
      `select l.id, l.kind, l.slug, l.title, l.verification_status, l.publication_status, l.last_verified_at, e.starts_at
       from public.listings l
       left join public.services s on s.id = l.id
       left join public.programs p on p.id = l.id
       left join public.events e on e.id = l.id
       where l.kind in ('service', 'program', 'event') and coalesce(s.organization_id, p.organization_id, e.organization_id) = $1
       order by l.kind, coalesce(e.starts_at, l.created_at) desc, l.title`,
      [id],
    );
    const managers = await sql.query<{ user_id: string; full_name: string; email: string; member_role: string; status: string; created_at: Date; is_active: boolean }>(
      `select m.user_id, p.full_name, p.email, m.member_role, m.status, m.created_at, p.is_active
       from public.provider_members m join public.profiles p on p.id = m.user_id
       where m.organization_id = $1 order by m.status, p.full_name`,
      [id],
    );
    const claims = await sql.query<{ id: string; claimant_name: string; claimant_title: string; work_email: string; relationship: string; status: string; submitted_at: Date | null; reviewed_at: Date | null; reviewer: string | null }>(
      `select c.id, c.claimant_name, c.claimant_title, c.work_email, c.relationship, c.status, c.submitted_at, c.reviewed_at, r.full_name as reviewer
       from public.provider_claims c left join public.profiles r on r.id = c.reviewed_by
       where c.organization_id = $1 and c.status <> 'draft' order by coalesce(c.submitted_at, c.created_at) desc`,
      [id],
    );
    const [subscription] = await sql.query<{ id: string; status: string; billing_provider: string; price_cents: number; currency: string; current_period_end: Date | null; created_at: Date; cancel_at_period_end: boolean }>(
      `select id, status, billing_provider, price_cents, currency, current_period_end, created_at, cancel_at_period_end
       from public.subscriptions where organization_id = $1 order by created_at desc limit 1`,
      [id],
    );
    const contacts = await sql.query<{
      id: string; kind: string; label: string | null; value: string; is_public: boolean; source_type: string; source_url: string | null; discovered_at: Date;
      last_verified_at: Date | null; verified_by_name: string | null; confidence: string; status: string; location_name: string | null;
    }>(
      `select oc.id, oc.kind, oc.label, oc.value, oc.is_public, oc.source_type, oc.source_url, oc.discovered_at, oc.last_verified_at,
              p.full_name as verified_by_name, oc.confidence, oc.status, ol.name as location_name
       from public.organization_contacts oc
       left join public.profiles p on p.id = oc.verified_by
       left join public.organization_locations ol on ol.id = oc.location_id
       where oc.organization_id = $1 order by oc.kind, oc.created_at`,
      [id],
    );
    const pendingMedia = await sql.query<{ id: string; kind: string; storage_path: string; alt_text: string; created_at: Date; uploader: string | null }>(
      `select m.id, m.kind, m.storage_path, m.alt_text, m.created_at, p.full_name as uploader
       from public.organization_media m left join public.profiles p on p.id = m.created_by
       where m.organization_id = $1 and m.status = 'pending_review' order by m.created_at desc`,
      [id],
    );
    const history = await getVerificationHistory(sql, id);
    return { org, locations, children, managers, claims, subscription: subscription ?? null, contacts, pendingMedia, history };
  });
}

export interface HistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  action: string;
  method: string | null;
  public_summary: string | null;
  internal_notes: string | null;
  created_at: Date;
  verifier: string | null;
  sources: { source_type: string; url: string | null; description: string | null }[];
}

export async function getVerificationHistory(sql: SqlClient, listingId: string, limit = 25): Promise<HistoryEntry[]> {
  const rows = await sql.query<Omit<HistoryEntry, "sources">>(
    `select vh.id, vh.previous_status, vh.new_status, vh.action, vh.method, vh.public_summary, vh.internal_notes, vh.created_at, p.full_name as verifier
     from public.verification_history vh left join public.profiles p on p.id = vh.verifier_id
     where vh.listing_id = $1 order by vh.created_at desc limit ${limit}`,
    [listingId],
  );
  if (rows.length === 0) return [];
  const sources = await sql.query<{ history_id: string; source_type: string; url: string | null; description: string | null }>(
    "select history_id, source_type, url, description from public.verification_sources where history_id = any($1::uuid[]) order by checked_at",
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({ ...r, sources: sources.filter((s) => s.history_id === r.id) }));
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export interface LocationRow {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  county: string;
  wheelchair_accessible: boolean | null;
  status: string;
  is_primary: boolean;
  organization_id: string;
  org_title: string;
  total: number;
}

export async function listLocations(f: { q?: string; county?: string; status?: string; accessible?: string; page: number }) {
  const rows = await asService((sql) =>
    sql.query<LocationRow>(
      `select ol.id, ol.name, ol.street, ol.city, ol.zip, c.name as county, ol.wheelchair_accessible, ol.status, ol.is_primary,
              ol.organization_id, l.title as org_title, count(*) over ()::int as total
       from public.organization_locations ol
       join public.listings l on l.id = ol.organization_id
       join public.counties c on c.id = ol.county_id
       where ($1::text is null or ol.name ilike $1 or l.title ilike $1 or ol.city ilike $1)
         and ($2::int is null or ol.county_id = $2)
         and ($3::text is null or ol.status = $3)
         and ($4::text is null or ($4 = 'yes' and ol.wheelchair_accessible is true) or ($4 = 'no' and ol.wheelchair_accessible is false) or ($4 = 'unknown' and ol.wheelchair_accessible is null))
       order by l.title, ol.is_primary desc, ol.name
       limit ${PAGE_SIZE} offset $5`,
      [likePattern(f.q), f.county ? Number(f.county) : null, f.status ?? null, f.accessible ?? null, offsetFor(f.page)],
    ),
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Services / programs / resources / events
// ---------------------------------------------------------------------------
export type ChildKind = "service" | "program" | "resource" | "event";

export interface ListingRow {
  id: string;
  kind: string;
  slug: string;
  title: string;
  verification_status: string;
  publication_status: string;
  last_verified_at: Date | null;
  next_review_at: string | null;
  is_demo: boolean;
  org_id: string | null;
  org_title: string | null;
  resource_type: string | null;
  event_type: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  total: number;
}

export async function listListings(kind: ChildKind, f: { q?: string; verification?: string; publication?: string; when?: string; type?: string; page: number }) {
  const rows = await asService((sql) =>
    sql.query<ListingRow>(
      `select l.id, l.kind, l.slug, l.title, l.verification_status, l.publication_status, l.last_verified_at, l.next_review_at::text as next_review_at, l.is_demo,
              org.id as org_id, org.title as org_title, r.resource_type, e.event_type, e.starts_at, e.ends_at,
              count(*) over ()::int as total
       from public.listings l
       left join public.services s on s.id = l.id
       left join public.programs p on p.id = l.id
       left join public.resources r on r.id = l.id
       left join public.events e on e.id = l.id
       left join public.listings org on org.id = coalesce(s.organization_id, p.organization_id, r.organization_id, e.organization_id)
       where l.kind = $1
         and ($2::text is null or l.title ilike $2 or org.title ilike $2 or extensions.similarity(lower(l.title), lower($3)) > 0.35)
         and ($4::text is null or l.verification_status = $4)
         and ($5::text is null or l.publication_status = $5)
         and ($6::text is null or ($6 = 'upcoming' and e.ends_at >= now()) or ($6 = 'past' and e.ends_at < now()))
         and ($7::text is null or r.resource_type = $7 or e.event_type = $7)
       order by ${kind === "event" ? "e.starts_at desc" : "l.title"}
       limit ${PAGE_SIZE} offset $8`,
      [kind, likePattern(f.q), f.q ?? "", f.verification ?? null, f.publication ?? null, f.when ?? null, f.type ?? null, offsetFor(f.page)],
    ),
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

export interface ListingAdmin {
  id: string;
  kind: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publication_status: string;
  verification_status: string;
  last_verified_at: Date | null;
  next_review_at: string | null;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
  primary_city: string | null;
  county: string | null;
  virtual_available: boolean;
  org_id: string | null;
  org_title: string | null;
}

export async function getListingAdmin(kind: ChildKind, id: string) {
  return asService(async (sql) => {
    const [listing] = await sql.query<ListingAdmin>(
      `select l.id, l.kind, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.last_verified_at,
              l.next_review_at::text as next_review_at, l.is_demo, l.created_at, l.updated_at, l.primary_city, c.name as county, l.virtual_available,
              org.id as org_id, org.title as org_title
       from public.listings l
       left join public.counties c on c.id = l.primary_county_id
       left join public.listings org on org.id = app.listing_organization(l.id) and org.id <> l.id
       where l.id = $1 and l.kind = $2`,
      [id, kind],
    );
    if (!listing) return null;
    let details: Record<string, unknown> = {};
    if (kind === "service") {
      [details] = await sql.query(
        `select age_min, age_max, eligibility, is_free, referral_required, waitlist_status, in_person, home_based, contact_phone, contact_email from public.services where id = $1`,
        [id],
      );
    } else if (kind === "program") {
      [details] = await sql.query(
        `select eligibility, cost_text, is_free, application_instructions, start_date::text as start_date, end_date::text as end_date, website, contact_email, contact_phone from public.programs where id = $1`,
        [id],
      );
    } else if (kind === "resource") {
      [details] = await sql.query(`select resource_type, url, source_name, source_url, reading_minutes, body from public.resources where id = $1`, [id]);
    } else if (kind === "event") {
      [details] = await sql.query(
        `select organizer_name, event_type, starts_at, ends_at, venue_name, street, city, zip, is_in_person, registration_url, cost_text, is_free, accommodations from public.events where id = $1`,
        [id],
      );
    }
    const categories = await sql.query<{ name: string }>(
      "select c.name from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = $1 order by lc.is_primary desc, c.name",
      [id],
    );
    const history = await getVerificationHistory(sql, id);
    return { listing, details: details ?? {}, categories: categories.map((c) => c.name), history };
  });
}

export async function getResourceForEdit(id: string) {
  return asService(async (sql) => {
    const [row] = await sql.query<{
      id: string; slug: string; title: string; summary: string; resource_type: string; url: string | null; source_name: string | null; source_url: string | null;
      body: string | null; reading_minutes: number | null; verification_status: string; statewide: boolean;
    }>(
      `select l.id, l.slug, l.title, l.summary, r.resource_type, r.url, r.source_name, r.source_url, r.body, r.reading_minutes, l.verification_status,
              exists (select 1 from public.service_areas sa where sa.listing_id = l.id and sa.scope = 'statewide') as statewide
       from public.listings l join public.resources r on r.id = l.id where l.id = $1`,
      [id],
    );
    if (!row) return null;
    const cats = await sql.query<{ category_id: number }>("select category_id from public.listing_categories where listing_id = $1", [id]);
    const pops = await sql.query<{ population_id: number }>("select population_id from public.listing_populations where listing_id = $1", [id]);
    return { ...row, categoryIds: cats.map((c) => String(c.category_id)), populationIds: pops.map((p) => String(p.population_id)) };
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_active: boolean;
  is_demo: boolean;
  created_at: Date;
  organizations: string[];
  total: number;
}

export async function listUsers(f: { q?: string; role?: string; status?: string; page: number }) {
  const rows = await asService((sql) =>
    sql.query<UserRow>(
      `select p.id, p.full_name, p.email, p.is_active, p.is_demo, p.created_at,
              coalesce((select array_agg(ur.role_key order by r.rank) from public.user_roles ur join public.roles r on r.key = ur.role_key where ur.user_id = p.id), '{}') as roles,
              coalesce((select array_agg(l.title order by l.title) from public.provider_members m join public.listings l on l.id = m.organization_id
                        where m.user_id = p.id and m.status = 'active'), '{}') as organizations,
              count(*) over ()::int as total
       from public.profiles p
       where ($1::text is null or p.full_name ilike $1 or p.email ilike $1)
         and ($2::text is null or exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role_key = $2))
         and ($3::text is null or ($3 = 'active' and p.is_active) or ($3 = 'inactive' and not p.is_active))
       order by p.full_name
       limit ${PAGE_SIZE} offset $4`,
      [likePattern(f.q), f.role ?? null, f.status ?? null, offsetFor(f.page)],
    ),
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

export async function getUserAdmin(id: string, includeSensitiveAudit: boolean) {
  return asService(async (sql) => {
    const [profile] = await sql.query<{ id: string; full_name: string; email: string; job_title: string | null; phone: string | null; is_active: boolean; is_demo: boolean; created_at: Date; updated_at: Date }>(
      "select id, full_name, email, job_title, phone, is_active, is_demo, created_at, updated_at from public.profiles where id = $1",
      [id],
    );
    if (!profile) return null;
    const roles = await sql.query<{ role_key: string; granted_at: Date; granted_by_name: string | null }>(
      `select ur.role_key, ur.granted_at, g.full_name as granted_by_name from public.user_roles ur
       join public.roles r on r.key = ur.role_key left join public.profiles g on g.id = ur.granted_by
       where ur.user_id = $1 order by r.rank`,
      [id],
    );
    const organizations = await sql.query<{ id: string; title: string; member_role: string; status: string; created_at: Date }>(
      `select l.id, l.title, m.member_role, m.status, m.created_at from public.provider_members m join public.listings l on l.id = m.organization_id
       where m.user_id = $1 order by m.status, l.title`,
      [id],
    );
    const claims = await sql.query<{ id: string; org_id: string; org_title: string; status: string; submitted_at: Date | null; created_at: Date }>(
      `select c.id, c.organization_id as org_id, l.title as org_title, c.status, c.submitted_at, c.created_at
       from public.provider_claims c join public.listings l on l.id = c.organization_id
       where c.claimant_user_id = $1 order by c.created_at desc`,
      [id],
    );
    const activity = await sql.query<{ id: string; action: string; entity_type: string; entity_label: string | null; created_at: Date }>(
      `select id::text, action, entity_type, entity_label, created_at from public.audit_logs
       where actor_id = $1 and ($2::boolean or entity_type not in ('user_role', 'platform_setting'))
       order by created_at desc limit 15`,
      [id, includeSensitiveAudit],
    );
    const [{ super_admins }] = await sql.query<{ super_admins: number }>(
      `select count(*)::int as super_admins from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role_key = 'super_admin' and p.is_active`,
    );
    return { profile, roles, organizations, claims, activity, superAdminCount: super_admins };
  });
}

// ---------------------------------------------------------------------------
// Categories + synonyms
// ---------------------------------------------------------------------------
export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  parent_id: number | null;
  parent_name: string | null;
  sort_order: number;
  is_featured: boolean;
  is_active: boolean;
  listing_count: number;
}

export async function listCategories() {
  return asService((sql) =>
    sql.query<CategoryRow>(
      `select c.id, c.slug, c.name, c.description, c.icon, c.parent_id, p.name as parent_name, c.sort_order, c.is_featured, c.is_active,
              (select count(*)::int from public.listing_categories lc where lc.category_id = c.id) as listing_count
       from public.categories c left join public.categories p on p.id = c.parent_id
       order by c.sort_order, c.name`,
    ),
  );
}

export async function listSynonyms() {
  return asService((sql) => sql.query<{ term: string; alternatives: string[] }>("select term, alternatives from public.search_synonyms order by term"));
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export interface AuditFilters {
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export interface AuditRow {
  id: string;
  created_at: Date;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  previous_state: unknown;
  new_state: unknown;
  metadata: unknown;
  total: number;
}

const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function auditWhere(f: AuditFilters, includeSensitive: boolean) {
  const params: unknown[] = [f.action ?? null, f.entity ?? null, f.actor ?? null, isDate(f.from), isDate(f.to), includeSensitive];
  const where = `
    ($1::text is null or a.action = $1)
    and ($2::text is null or a.entity_type = $2)
    and ($3::text is null or a.actor_label = $3)
    and ($4::date is null or a.created_at >= ($4::date::timestamp at time zone 'America/Detroit'))
    and ($5::date is null or a.created_at < (($5::date + 1)::timestamp at time zone 'America/Detroit'))
    and ($6::boolean or a.entity_type not in ('user_role', 'platform_setting'))`;
  return { where, params };
}

export async function listAudit(f: AuditFilters & { page: number }, includeSensitive: boolean) {
  const { where, params } = auditWhere(f, includeSensitive);
  const rows = await asService((sql) =>
    sql.query<AuditRow>(
      `select a.id::text, a.created_at, a.actor_id, a.actor_label, a.action, a.entity_type, a.entity_id, a.entity_label, a.previous_state, a.new_state, a.metadata,
              count(*) over ()::int as total
       from public.audit_logs a where ${where}
       order by a.created_at desc, a.id desc limit ${PAGE_SIZE} offset $7`,
      [...params, offsetFor(f.page)],
    ),
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

export async function exportAudit(f: AuditFilters, includeSensitive: boolean) {
  const { where, params } = auditWhere(f, includeSensitive);
  return asService((sql) =>
    sql.query<AuditRow>(
      `select a.id::text, a.created_at, a.actor_id, a.actor_label, a.action, a.entity_type, a.entity_id, a.entity_label, a.previous_state, a.new_state, a.metadata, 0 as total
       from public.audit_logs a where ${where} order by a.created_at desc, a.id desc limit 50000`,
      params,
    ),
  );
}

export async function auditFilterOptions(includeSensitive: boolean) {
  return asService(async (sql) => {
    const cond = includeSensitive ? "" : "where entity_type not in ('user_role', 'platform_setting')";
    const actions = await sql.query<{ v: string }>(`select distinct action as v from public.audit_logs ${cond} order by 1`);
    const entities = await sql.query<{ v: string }>(`select distinct entity_type as v from public.audit_logs ${cond} order by 1`);
    const actors = await sql.query<{ v: string }>(`select distinct actor_label as v from public.audit_logs ${cond ? cond + " and" : "where"} actor_label is not null order by 1`);
    return { actions: actions.map((r) => r.v), entities: entities.map((r) => r.v), actors: actors.map((r) => r.v) };
  });
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------
export interface PlatformSettings {
  enhanced_plan: { name: string; price_cents: number; currency: string; interval: string; demo_pricing: boolean };
  verification_interval_days: number;
  low_result_threshold: number;
  family_reports_enabled: boolean;
  default_search_radius_miles: number;
  updated: { key: string; updated_at: Date; updated_by_name: string | null }[];
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await asService((sql) =>
    sql.query<{ key: string; value: unknown; updated_at: Date; updated_by_name: string | null }>(
      "select s.key, s.value, s.updated_at, p.full_name as updated_by_name from public.platform_settings s left join public.profiles p on p.id = s.updated_by",
    ),
  );
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const plan = (v.enhanced_plan ?? {}) as Partial<PlatformSettings["enhanced_plan"]>;
  return {
    enhanced_plan: {
      name: plan.name ?? "MittenLink Enhanced",
      price_cents: Number(plan.price_cents ?? 2900),
      currency: plan.currency ?? "usd",
      interval: plan.interval ?? "month",
      demo_pricing: plan.demo_pricing ?? true,
    },
    verification_interval_days: Number(v.verification_interval_days ?? 180),
    low_result_threshold: Number(v.low_result_threshold ?? 2),
    family_reports_enabled: v.family_reports_enabled === undefined ? true : Boolean(v.family_reports_enabled),
    default_search_radius_miles: Number(v.default_search_radius_miles ?? 25),
    updated: rows.map((r) => ({ key: r.key, updated_at: r.updated_at, updated_by_name: r.updated_by_name })),
  };
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export async function getBillingOverview() {
  return asService(async (sql) => {
    const subscriptions = await sql.query<{
      id: string; organization_id: string; org_title: string; status: string; billing_provider: string; price_cents: number; currency: string;
      current_period_end: Date | null; created_at: Date; cancel_at_period_end: boolean; livemode: boolean; listing_tier: string;
    }>(
      `select s.id, s.organization_id, l.title as org_title, s.status, s.billing_provider, s.price_cents, s.currency, s.current_period_end, s.created_at,
              s.cancel_at_period_end, s.livemode, o.listing_tier
       from public.subscriptions s join public.listings l on l.id = s.organization_id join public.organizations o on o.id = s.organization_id
       order by s.created_at desc`,
    );
    const events = await sql.query<{ id: string; created_at: Date; event_type: string; summary: string | null; billing_provider: string; org_title: string | null; livemode: boolean }>(
      `select be.id, be.created_at, be.event_type, be.summary, be.billing_provider, l.title as org_title, be.livemode
       from public.billing_events be left join public.listings l on l.id = be.organization_id
       order by be.created_at desc limit 50`,
    );
    const [enhanced] = await sql.query<{ n: number }>("select count(*)::int as n from public.organizations where listing_tier = 'enhanced'");
    return { subscriptions, events, enhancedCount: enhanced?.n ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (Array.isArray(v)) s = v.join("; ");
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a UTF-8 BOM so spreadsheet apps detect the encoding. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.map(csvCell).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const EXPORT_DATASETS = {
  organizations: "Organizations (with locations)",
  services: "Services",
  programs: "Programs",
  resources: "Guides & resources",
  events: "Events",
  verification_history: "Verification history",
  audit_logs: "Audit log",
} as const;
export type ExportDataset = keyof typeof EXPORT_DATASETS;

export async function exportDataset(dataset: ExportDataset, includeSensitiveAudit: boolean): Promise<Record<string, unknown>[]> {
  return asService(async (sql) => {
    const base = `l.id, l.slug, l.title, l.summary, l.publication_status, l.verification_status, l.last_verified_at, l.next_review_at::text as next_review_at,
                  l.primary_city, c.name as primary_county, l.virtual_available, l.is_demo, l.created_at, l.updated_at`;
    switch (dataset) {
      case "organizations":
        return sql.query(
          `select ${base}, o.org_type, o.website, o.public_email, o.public_phone, o.accessibility_info, o.listing_tier, o.claimed_at,
                  ol.id as location_id, ol.name as location_name, ol.street, ol.street2, ol.city, ol.state, ol.zip, lc.name as location_county,
                  ol.phone as location_phone, ol.wheelchair_accessible, ol.accessible_parking, ol.appointment_required, ol.status as location_status, ol.is_primary
           from public.listings l join public.organizations o on o.id = l.id
           left join public.counties c on c.id = l.primary_county_id
           left join public.organization_locations ol on ol.organization_id = l.id
           left join public.counties lc on lc.id = ol.county_id
           order by l.title, ol.is_primary desc nulls last, ol.name`,
        );
      case "services":
        return sql.query(
          `select ${base}, org.title as organization, s.age_min, s.age_max, s.eligibility, s.is_free, s.referral_required, s.waitlist_status,
                  s.in_person, s.home_based, s.contact_phone, s.contact_email
           from public.listings l join public.services s on s.id = l.id join public.listings org on org.id = s.organization_id
           left join public.counties c on c.id = l.primary_county_id order by org.title, l.title`,
        );
      case "programs":
        return sql.query(
          `select ${base}, org.title as organization, p.eligibility, p.cost_text, p.is_free, p.application_instructions, p.start_date::text as start_date,
                  p.end_date::text as end_date, p.website, p.contact_email, p.contact_phone
           from public.listings l join public.programs p on p.id = l.id left join public.listings org on org.id = p.organization_id
           left join public.counties c on c.id = l.primary_county_id order by l.title`,
        );
      case "resources":
        return sql.query(
          `select ${base}, r.resource_type, r.url, org.title as organization, r.source_name, r.source_url, r.reading_minutes, r.body
           from public.listings l join public.resources r on r.id = l.id left join public.listings org on org.id = r.organization_id
           left join public.counties c on c.id = l.primary_county_id order by l.title`,
        );
      case "events":
        return sql.query(
          `select ${base}, org.title as organization, e.organizer_name, e.event_type, e.starts_at, e.ends_at, e.timezone, e.venue_name, e.street, e.city, e.zip,
                  e.is_in_person, e.registration_url, e.cost_text, e.is_free, e.accommodations, e.contact_email, e.contact_phone
           from public.listings l join public.events e on e.id = l.id left join public.listings org on org.id = e.organization_id
           left join public.counties c on c.id = l.primary_county_id order by e.starts_at desc`,
        );
      case "verification_history":
        return sql.query(
          `select vh.id, vh.created_at, l.kind as listing_kind, l.title as listing_title, vh.listing_id, vh.previous_status, vh.new_status, vh.action, vh.method,
                  p.full_name as verifier, vh.public_summary, vh.internal_notes,
                  (select string_agg(coalesce(vs.url, vs.description, vs.source_type), ' | ') from public.verification_sources vs where vs.history_id = vh.id) as sources
           from public.verification_history vh join public.listings l on l.id = vh.listing_id left join public.profiles p on p.id = vh.verifier_id
           order by vh.created_at desc`,
        );
      case "audit_logs":
        return sql.query(
          `select a.id::text as id, a.created_at, a.actor_label, a.action, a.entity_type, a.entity_id, a.entity_label, a.previous_state, a.new_state, a.metadata
           from public.audit_logs a where ($1::boolean or a.entity_type not in ('user_role', 'platform_setting'))
           order by a.created_at desc`,
          [includeSensitiveAudit],
        );
    }
  });
}
