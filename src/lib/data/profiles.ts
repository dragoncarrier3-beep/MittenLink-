import "server-only";
import { asPublic, type SqlClient } from "@/lib/db";

/*
 * Public detail pages. asPublic = role anon with RLS, so unpublished and
 * archived records return nothing (→ 404). Internal notes and contact
 * provenance are never selected; verification information comes only from
 * the public_verification_history view and family reports only from
 * public_family_experiences.
 */

export interface Hours {
  day: string;
  open: string;
  close: string;
}

export interface LocationInfo {
  id: string;
  name: string;
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  county: string;
  phone: string | null;
  email: string | null;
  hours: Hours[];
  hours_note: string | null;
  wheelchair_accessible: boolean | null;
  accessible_parking: boolean | null;
  transit_info: string | null;
  appointment_required: boolean;
  virtual_services: boolean;
  service_area_note: string | null;
  status: string;
  is_primary: boolean;
  lat: number | null;
  lng: number | null;
}

export interface VerificationEntry {
  id: string;
  new_status: string;
  action: string;
  method: string | null;
  public_summary: string | null;
  created_at: Date;
}

export interface Taxonomy {
  categories: { slug: string; name: string }[];
  populations: string[];
  disabilities: string[];
  languages: string[];
  areas: string[];
  statewide: boolean;
}

interface ListingBase {
  id: string;
  kind: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  verification_status: string;
  last_verified_at: Date | null;
  next_review_at: string | null;
  virtual_available: boolean;
  is_demo: boolean;
  updated_at: Date;
}

const LISTING_COLS = `l.id, l.kind, l.slug, l.title, l.summary, l.description, l.verification_status, l.last_verified_at,
  l.next_review_at::text as next_review_at, l.virtual_available, l.is_demo, l.updated_at`;

async function taxonomy(sql: SqlClient, id: string): Promise<Taxonomy> {
  const [row] = await sql.query<{
    categories: { slug: string; name: string }[] | null;
    populations: string[] | null;
    disabilities: string[] | null;
    languages: string[] | null;
    areas: string[] | null;
    statewide: boolean;
  }>(
    `select
      (select json_agg(json_build_object('slug', c.slug, 'name', c.name) order by lc.is_primary desc, c.sort_order)
         from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = $1) as categories,
      (select json_agg(p.name order by p.sort_order) from public.listing_populations lp join public.populations p on p.id = lp.population_id where lp.listing_id = $1) as populations,
      (select json_agg(d.name order by d.sort_order) from public.listing_disability_categories ld join public.disability_categories d on d.id = ld.disability_category_id where ld.listing_id = $1) as disabilities,
      (select json_agg(g.name order by g.sort_order, g.name) from public.listing_languages ll join public.languages g on g.code = ll.language_code where ll.listing_id = $1) as languages,
      (select json_agg(case sa.scope when 'county' then c.name || ' County' when 'radius' then 'Within ' || sa.radius_miles::float8 || ' miles of a service location' else 'All of Michigan' end order by sa.scope desc, c.name)
         from public.service_areas sa left join public.counties c on c.id = sa.county_id where sa.listing_id = $1) as areas,
      exists (select 1 from public.service_areas sa where sa.listing_id = $1 and sa.scope = 'statewide') as statewide`,
    [id],
  );
  return {
    categories: row?.categories ?? [],
    populations: row?.populations ?? [],
    disabilities: row?.disabilities ?? [],
    languages: row?.languages ?? [],
    areas: row?.areas ?? [],
    statewide: !!row?.statewide,
  };
}

async function verificationHistory(sql: SqlClient, id: string) {
  return sql.query<VerificationEntry>(
    `select id, new_status, action, method, public_summary, created_at from public.public_verification_history
     where listing_id = $1 order by created_at desc limit 8`,
    [id],
  );
}

const LOCATION_COLS = `ol.id, ol.name, ol.street, ol.street2, ol.city, ol.state, ol.zip, c.name as county, ol.phone, ol.email, ol.hours, ol.hours_note,
  ol.wheelchair_accessible, ol.accessible_parking, ol.transit_info, ol.appointment_required, ol.virtual_services, ol.service_area_note,
  ol.status, ol.is_primary,
  extensions.st_y(ol.geog::extensions.geometry) as lat, extensions.st_x(ol.geog::extensions.geometry) as lng`;

// ---------------------------------------------------------------------------
// Provider (organization)
// ---------------------------------------------------------------------------

export interface ServiceSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  verification_status: string;
  last_verified_at: Date | null;
  virtual_available: boolean;
  age_min: number | null;
  age_max: number | null;
  eligibility: string | null;
  insurance_notes: string | null;
  payment_notes: string | null;
  is_free: boolean;
  referral_required: boolean;
  waitlist_status: string;
  in_person: boolean;
  home_based: boolean;
  is_featured: boolean;
  payments: string[] | null;
  location_names: string[] | null;
  areas: string[] | null;
  categories: string[] | null;
}

const SERVICE_SUMMARY_SQL = `
select l.id, l.slug, l.title, l.summary, l.verification_status, l.last_verified_at, l.virtual_available,
  s.age_min, s.age_max, s.eligibility, s.insurance_notes, s.payment_notes, s.is_free, s.referral_required, s.waitlist_status,
  s.in_person, s.home_based, s.is_featured,
  (select json_agg(po.name order by po.sort_order) from public.service_payment_options spo join public.payment_options po on po.id = spo.payment_option_id where spo.service_id = s.id) as payments,
  (select json_agg(ol.name order by ol.is_primary desc, ol.sort_order) from public.service_locations sl join public.organization_locations ol on ol.id = sl.location_id where sl.service_id = s.id and ol.status <> 'closed') as location_names,
  (select json_agg(case sa.scope when 'county' then c.name || ' County' when 'radius' then 'Within ' || sa.radius_miles::float8 || ' miles' else 'All of Michigan' end order by sa.scope desc, c.name)
     from public.service_areas sa left join public.counties c on c.id = sa.county_id where sa.listing_id = s.id) as areas,
  (select json_agg(c.name order by lc.is_primary desc, c.sort_order) from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = s.id) as categories
from public.services s join public.listings l on l.id = s.id`;

export async function getProviderProfile(slug: string) {
  return asPublic(async (sql) => {
    const [org] = await sql.query<
      ListingBase & {
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
    >(
      `select ${LISTING_COLS}, o.org_type, o.website, o.public_email, o.public_phone, o.accessibility_info, o.expanded_description,
         o.logo_path, o.logo_alt, o.claimed_at, o.listing_tier, o.founded_year
       from public.listings l join public.organizations o on o.id = l.id
       where l.kind = 'organization' and l.slug = $1`,
      [slug],
    );
    if (!org) return null;
    const tax = await taxonomy(sql, org.id);
    const locations = await sql.query<LocationInfo>(
      `select ${LOCATION_COLS} from public.organization_locations ol join public.counties c on c.id = ol.county_id
       where ol.organization_id = $1 and ol.status <> 'closed' order by ol.is_primary desc, ol.sort_order, ol.name`,
      [org.id],
    );
    const services = await sql.query<ServiceSummary>(
      `${SERVICE_SUMMARY_SQL} where s.organization_id = $1 order by s.is_featured desc, lower(l.title)`,
      [org.id],
    );
    const programs = await sql.query<{ id: string; slug: string; title: string; summary: string; cost_text: string | null; start_date: string | null; end_date: string | null }>(
      `select l.id, l.slug, l.title, l.summary, p.cost_text, p.start_date::text as start_date, p.end_date::text as end_date
       from public.programs p join public.listings l on l.id = p.id where p.organization_id = $1 order by lower(l.title)`,
      [org.id],
    );
    const events = await sql.query<{ id: string; slug: string; title: string; starts_at: Date; ends_at: Date; is_in_person: boolean; city: string | null }>(
      `select l.id, l.slug, l.title, e.starts_at, e.ends_at, e.is_in_person, e.city
       from public.events e join public.listings l on l.id = e.id where e.organization_id = $1 and e.ends_at >= now() order by e.starts_at limit 5`,
      [org.id],
    );
    const guides = await sql.query<{ id: string; slug: string; title: string; summary: string }>(
      `select l.id, l.slug, l.title, l.summary from public.resources r join public.listings l on l.id = r.id where r.organization_id = $1 order by lower(l.title)`,
      [org.id],
    );
    const experiences = await sql.query<{
      id: string;
      service_type: string;
      approx_service_month: string | null;
      experience_category: string;
      accessibility_rating: string;
      accessibility_notes: string | null;
      communication_rating: string;
      comments: string | null;
      published_at: Date;
    }>(
      `select id, service_type, approx_service_month::text as approx_service_month, experience_category, accessibility_rating, accessibility_notes,
         communication_rating, comments, published_at
       from public.public_family_experiences where organization_id = $1 order by published_at desc limit 10`,
      [org.id],
    );
    const history = await verificationHistory(sql, org.id);
    return { org, tax, locations, services, programs, events, guides, experiences, history };
  });
}

export type ProviderProfile = NonNullable<Awaited<ReturnType<typeof getProviderProfile>>>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getServiceDetail(slug: string) {
  return asPublic(async (sql) => {
    const [base] = await sql.query<ListingBase & { organization_id: string; contact_phone: string | null; contact_email: string | null }>(
      `select ${LISTING_COLS}, s.organization_id, s.contact_phone, s.contact_email
       from public.listings l join public.services s on s.id = l.id where l.kind = 'service' and l.slug = $1`,
      [slug],
    );
    if (!base) return null;
    const [service] = await sql.query<ServiceSummary>(`${SERVICE_SUMMARY_SQL} where s.id = $1`, [base.id]);
    const [org] = await sql.query<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      verification_status: string;
      website: string | null;
      public_phone: string | null;
      public_email: string | null;
      listing_tier: string;
    }>(
      `select l.id, l.slug, l.title, l.summary, l.verification_status, o.website, o.public_phone, o.public_email, o.listing_tier
       from public.listings l join public.organizations o on o.id = l.id where l.id = $1`,
      [base.organization_id],
    );
    const locations = await sql.query<LocationInfo>(
      `select ${LOCATION_COLS} from public.service_locations sl
       join public.organization_locations ol on ol.id = sl.location_id join public.counties c on c.id = ol.county_id
       where sl.service_id = $1 and ol.status <> 'closed' order by ol.is_primary desc, ol.sort_order`,
      [base.id],
    );
    const tax = await taxonomy(sql, base.id);
    const history = await verificationHistory(sql, base.id);
    const related = org
      ? await sql.query<{ slug: string; title: string }>(
          `select l.slug, l.title from public.services s join public.listings l on l.id = s.id
           where s.organization_id = $1 and s.id <> $2 order by s.is_featured desc, lower(l.title) limit 6`,
          [org.id, base.id],
        )
      : [];
    return { base, service, org: org ?? null, locations, tax, history, related };
  });
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export async function getProgramDetail(slug: string) {
  return asPublic(async (sql) => {
    const [program] = await sql.query<
      ListingBase & {
        organization_id: string | null;
        eligibility: string | null;
        cost_text: string | null;
        is_free: boolean;
        application_instructions: string | null;
        start_date: string | null;
        end_date: string | null;
        website: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        org_slug: string | null;
        org_title: string | null;
        org_summary: string | null;
      }
    >(
      `select ${LISTING_COLS}, p.organization_id, p.eligibility, p.cost_text, p.is_free, p.application_instructions,
         p.start_date::text as start_date, p.end_date::text as end_date, p.website, p.contact_email, p.contact_phone,
         ol.slug as org_slug, ol.title as org_title, ol.summary as org_summary
       from public.listings l join public.programs p on p.id = l.id
       left join public.listings ol on ol.id = p.organization_id
       where l.kind = 'program' and l.slug = $1`,
      [slug],
    );
    if (!program) return null;
    const tax = await taxonomy(sql, program.id);
    const history = await verificationHistory(sql, program.id);
    return { program, tax, history };
  });
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export async function getEventDetail(slug: string) {
  return asPublic(async (sql) => {
    const [event] = await sql.query<
      ListingBase & {
        organization_id: string | null;
        organizer_name: string;
        event_type: string;
        starts_at: Date;
        ends_at: Date;
        venue_name: string | null;
        street: string | null;
        city: string | null;
        zip: string | null;
        county: string | null;
        is_in_person: boolean;
        registration_url: string | null;
        cost_text: string | null;
        is_free: boolean;
        accommodations: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        org_slug: string | null;
        org_title: string | null;
      }
    >(
      `select ${LISTING_COLS}, e.organization_id, e.organizer_name, e.event_type, e.starts_at, e.ends_at, e.venue_name, e.street, e.city, e.zip,
         c.name as county, e.is_in_person, e.registration_url, e.cost_text, e.is_free, e.accommodations, e.contact_email, e.contact_phone,
         ol.slug as org_slug, ol.title as org_title
       from public.listings l join public.events e on e.id = l.id
       left join public.counties c on c.id = e.county_id
       left join public.listings ol on ol.id = e.organization_id
       where l.kind = 'event' and l.slug = $1`,
      [slug],
    );
    if (!event) return null;
    const tax = await taxonomy(sql, event.id);
    const history = await verificationHistory(sql, event.id);
    return { event, tax, history };
  });
}

// ---------------------------------------------------------------------------
// Guide (informational resource)
// ---------------------------------------------------------------------------

export async function getGuideDetail(slug: string) {
  return asPublic(async (sql) => {
    const [guide] = await sql.query<
      ListingBase & {
        resource_type: string;
        url: string | null;
        source_name: string | null;
        source_url: string | null;
        body: string | null;
        reading_minutes: number | null;
        org_slug: string | null;
        org_title: string | null;
      }
    >(
      `select ${LISTING_COLS}, r.resource_type, r.url, r.source_name, r.source_url, r.body, r.reading_minutes,
         ol.slug as org_slug, ol.title as org_title
       from public.listings l join public.resources r on r.id = l.id
       left join public.listings ol on ol.id = r.organization_id
       where l.kind = 'resource' and l.slug = $1`,
      [slug],
    );
    if (!guide) return null;
    const tax = await taxonomy(sql, guide.id);
    const history = await verificationHistory(sql, guide.id);
    const related = await sql.query<{ slug: string; title: string; summary: string }>(
      `select l.slug, l.title, l.summary from public.listings l
       where l.kind = 'resource' and l.id <> $1 and exists (
         select 1 from public.listing_categories a join public.listing_categories b on a.category_id = b.category_id
         where a.listing_id = l.id and b.listing_id = $1)
       order by lower(l.title) limit 4`,
      [guide.id],
    );
    return { guide, tax, history, related };
  });
}
