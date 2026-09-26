-- =====================================================================
-- Local-only Supabase compatibility shim (PGlite / plain PostgreSQL)
-- ---------------------------------------------------------------------
-- Supabase projects already provide these objects. This file is applied
-- ONLY by the local embedded database (DB_DRIVER=pglite) so that the
-- exact same migrations in /supabase/migrations run unchanged locally.
-- Never apply this file to a Supabase project.
-- =====================================================================

do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Minimal auth.users table mirroring the Supabase columns the app relies on.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same resolution logic Supabase uses for auth.uid()/auth.role()/auth.jwt().
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
