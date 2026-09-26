-- =====================================================================
-- MittenLink — 0001 Extensions, identity and reference data tables
-- =====================================================================

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Private schema for helper functions (not exposed through the Supabase API).
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- Generic updated_at trigger.
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Identity: profiles, roles, user_roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  job_title text,
  phone text,
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

create table public.roles (
  key text primary key,
  name text not null,
  description text not null,
  rank smallint not null unique
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.roles(key),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_key)
);
create index user_roles_role_idx on public.user_roles (role_key);

-- ---------------------------------------------------------------------
-- Geography: counties and a local gazetteer (cities / ZIP codes)
-- ---------------------------------------------------------------------
create table public.counties (
  id smallint primary key,
  name text not null unique,
  slug text not null unique,
  fips text not null unique,
  region text not null,
  centroid extensions.geography(Point, 4326) not null,
  -- Optional exact boundaries (e.g. US Census TIGER/Line, public domain).
  -- When present, geographic matching uses the boundary instead of the centroid.
  boundary extensions.geography(MultiPolygon, 4326)
);
create index counties_centroid_gix on public.counties using gist (centroid);
create index counties_boundary_gix on public.counties using gist (boundary);

create table public.places (
  id serial primary key,
  kind text not null check (kind in ('city', 'zip')),
  name text not null,
  zip text,
  county_id smallint not null references public.counties(id),
  geog extensions.geography(Point, 4326) not null,
  population integer
);
create index places_name_trgm on public.places using gin (lower(name) extensions.gin_trgm_ops);
create index places_zip_idx on public.places (zip);
create index places_geog_gix on public.places using gist (geog);

-- ---------------------------------------------------------------------
-- Taxonomies
-- ---------------------------------------------------------------------
create table public.categories (
  id serial primary key,
  slug text not null unique,
  name text not null unique,
  description text,
  icon text,
  parent_id integer references public.categories(id) on delete set null,
  sort_order smallint not null default 100,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.populations (
  id serial primary key,
  slug text not null unique,
  name text not null unique,
  sort_order smallint not null default 100
);

create table public.disability_categories (
  id serial primary key,
  slug text not null unique,
  name text not null unique,
  sort_order smallint not null default 100
);

create table public.languages (
  code text primary key,
  name text not null unique,
  sort_order smallint not null default 100
);

create table public.payment_options (
  id serial primary key,
  slug text not null unique,
  name text not null unique,
  is_insurance boolean not null default false,
  sort_order smallint not null default 100
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
