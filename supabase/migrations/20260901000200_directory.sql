-- =====================================================================
-- MittenLink — 0002 Directory: listings supertype + structured subtypes
-- ---------------------------------------------------------------------
-- Every public record (organization, service, program, resource, event)
-- has exactly one row in public.listings (shared identity, verification,
-- publication state and search document) and one row in its own typed
-- table sharing the same id. This is class-table inheritance: typed
-- fields stay in typed tables (no giant generic table), while taxonomy,
-- service areas, verification and saved items can reference any record
-- through a real foreign key.
-- =====================================================================

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('organization', 'service', 'program', 'resource', 'event')),
  slug text not null,
  title text not null,
  summary text not null default '',
  description text not null default '',
  -- Publication (visibility) is separate from verification (trust).
  publication_status text not null default 'published'
    check (publication_status in ('draft', 'pending', 'published', 'archived')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending_review', 'verified', 'needs_update', 'unable_to_verify', 'archived')),
  last_verified_at timestamptz,
  next_review_at date,
  virtual_available boolean not null default false,
  -- Denormalized display/search helpers maintained by app.refresh_listing_search().
  primary_city text,
  primary_county_id smallint references public.counties(id),
  search_text text not null default '',
  search_vector tsvector,
  -- Seeded sample records are flagged so they can never be mistaken for live data.
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);
create index listings_kind_idx on public.listings (kind);
create index listings_pub_idx on public.listings (publication_status, verification_status);
create index listings_county_idx on public.listings (primary_county_id);
create index listings_review_idx on public.listings (next_review_at);
create index listings_search_gin on public.listings using gin (search_vector);
create index listings_search_trgm on public.listings using gin (search_text extensions.gin_trgm_ops);
create index listings_title_trgm on public.listings using gin (lower(title) extensions.gin_trgm_ops);
create trigger listings_touch before update on public.listings
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Organizations (providers)
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key references public.listings(id) on delete cascade,
  org_type text not null default 'nonprofit'
    check (org_type in ('nonprofit', 'government', 'private_practice', 'healthcare', 'school', 'community_group', 'advocacy', 'faith_based', 'other')),
  website text,
  public_email text,
  public_phone text,
  accessibility_info text,
  expanded_description text,          -- Enhanced listing content
  logo_path text,                     -- Enhanced listing content (storage path)
  logo_alt text,
  claimed_at timestamptz,
  -- Written only by the billing service (server-side). Never affects verification.
  listing_tier text not null default 'free' check (listing_tier in ('free', 'enhanced')),
  founded_year smallint
);
create index organizations_tier_idx on public.organizations (listing_tier);

create table public.organization_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  street text not null,
  street2 text,
  city text not null,
  state text not null default 'MI' check (state = upper(state) and length(state) = 2),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  county_id smallint not null references public.counties(id),
  geog extensions.geography(Point, 4326),
  phone text,
  email text,
  hours jsonb not null default '[]'::jsonb,   -- [{ "day": "mon", "open": "09:00", "close": "17:00" }]
  hours_note text,
  wheelchair_accessible boolean,
  accessible_parking boolean,
  transit_info text,
  appointment_required boolean not null default false,
  virtual_services boolean not null default false,
  service_area_note text,
  status text not null default 'open' check (status in ('open', 'temporarily_closed', 'closed')),
  is_primary boolean not null default false,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index org_locations_org_idx on public.organization_locations (organization_id);
create index org_locations_county_idx on public.organization_locations (county_id);
create index org_locations_geog_gix on public.organization_locations using gist (geog);
create trigger org_locations_touch before update on public.organization_locations
  for each row execute function app.touch_updated_at();

-- Public business contact points with provenance (internal) metadata.
create table public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.organization_locations(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email', 'website', 'address', 'fax')),
  label text,
  value text not null,
  is_public boolean not null default true,
  source_type text not null
    check (source_type in ('official_website', 'government_source', 'provider_confirmation', 'phone_confirmation', 'email_confirmation', 'manual_research', 'source_watch', 'community_submission')),
  source_url text,
  discovered_at timestamptz not null default now(),
  last_verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  status text not null default 'active' check (status in ('active', 'unverified', 'outdated')),
  created_at timestamptz not null default now()
);
create index org_contacts_org_idx on public.organization_contacts (organization_id);

create table public.organization_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('logo', 'photo')),
  storage_path text not null,
  alt_text text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  sort_order smallint not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index org_media_org_idx on public.organization_media (organization_id);

-- ---------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key references public.listings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  age_min smallint check (age_min between 0 and 120),
  age_max smallint check (age_max between 0 and 120),
  eligibility text,
  insurance_notes text,
  payment_notes text,
  is_free boolean not null default false,
  referral_required boolean not null default false,
  waitlist_status text not null default 'accepting'
    check (waitlist_status in ('accepting', 'short_wait', 'waitlist', 'not_accepting')),
  in_person boolean not null default true,
  home_based boolean not null default false,
  contact_phone text,
  contact_email text,
  is_featured boolean not null default false  -- Enhanced listing "featured services"
);
create index services_org_idx on public.services (organization_id);

create table public.service_locations (
  service_id uuid not null references public.services(id) on delete cascade,
  location_id uuid not null references public.organization_locations(id) on delete cascade,
  primary key (service_id, location_id)
);
create index service_locations_loc_idx on public.service_locations (location_id);

create table public.service_payment_options (
  service_id uuid not null references public.services(id) on delete cascade,
  payment_option_id integer not null references public.payment_options(id) on delete cascade,
  primary key (service_id, payment_option_id)
);

-- ---------------------------------------------------------------------
-- Programs (may exist independently of an organization)
-- ---------------------------------------------------------------------
create table public.programs (
  id uuid primary key references public.listings(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  eligibility text,
  cost_text text,
  is_free boolean not null default false,
  application_instructions text,
  start_date date,
  end_date date,
  website text,
  contact_email text,
  contact_phone text,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index programs_org_idx on public.programs (organization_id);

-- ---------------------------------------------------------------------
-- Informational resources / plain-language guides
-- ---------------------------------------------------------------------
create table public.resources (
  id uuid primary key references public.listings(id) on delete cascade,
  resource_type text not null
    check (resource_type in ('guide', 'benefits', 'rights', 'toolkit', 'directory', 'article', 'video')),
  url text,
  organization_id uuid references public.organizations(id) on delete set null,
  source_name text,
  source_url text,
  body text,                          -- Plain-language guide body (paragraphs separated by blank lines)
  reading_minutes smallint
);

-- ---------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key references public.listings(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  organizer_name text not null,
  event_type text not null default 'workshop'
    check (event_type in ('workshop', 'support_group', 'webinar', 'recreation', 'community', 'training', 'resource_fair')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Detroit',
  venue_name text,
  street text,
  city text,
  zip text,
  county_id smallint references public.counties(id),
  geog extensions.geography(Point, 4326),
  is_in_person boolean not null default true,
  registration_url text,
  cost_text text,
  is_free boolean not null default true,
  accommodations text,
  contact_email text,
  contact_phone text,
  check (ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at);
create index events_geog_gix on public.events using gist (geog);

-- ---------------------------------------------------------------------
-- Shared relationship tables (normalized, FK-enforced)
-- ---------------------------------------------------------------------
create table public.listing_categories (
  listing_id uuid not null references public.listings(id) on delete cascade,
  category_id integer not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (listing_id, category_id)
);
create index listing_categories_cat_idx on public.listing_categories (category_id);

create table public.listing_populations (
  listing_id uuid not null references public.listings(id) on delete cascade,
  population_id integer not null references public.populations(id) on delete cascade,
  primary key (listing_id, population_id)
);
create index listing_populations_pop_idx on public.listing_populations (population_id);

create table public.listing_disability_categories (
  listing_id uuid not null references public.listings(id) on delete cascade,
  disability_category_id integer not null references public.disability_categories(id) on delete cascade,
  primary key (listing_id, disability_category_id)
);

create table public.listing_languages (
  listing_id uuid not null references public.listings(id) on delete cascade,
  language_code text not null references public.languages(code) on delete cascade,
  primary key (listing_id, language_code)
);
create index listing_languages_lang_idx on public.listing_languages (language_code);

-- Where a record is available beyond its physical locations.
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  scope text not null check (scope in ('statewide', 'county', 'radius')),
  county_id smallint references public.counties(id),
  center extensions.geography(Point, 4326),
  radius_miles numeric(6, 1),
  check (
    (scope = 'statewide' and county_id is null)
    or (scope = 'county' and county_id is not null)
    or (scope = 'radius' and center is not null and radius_miles > 0)
  )
);
create index service_areas_listing_idx on public.service_areas (listing_id);
create index service_areas_county_idx on public.service_areas (county_id);

-- Every physical point associated with a listing (derived; used for radius search + map).
create table public.listing_points (
  listing_id uuid not null references public.listings(id) on delete cascade,
  location_id uuid references public.organization_locations(id) on delete cascade,
  geog extensions.geography(Point, 4326) not null,
  city text,
  county_id smallint references public.counties(id)
);
create index listing_points_listing_idx on public.listing_points (listing_id);
create index listing_points_geog_gix on public.listing_points using gist (geog);
create index listing_points_county_idx on public.listing_points (county_id);
