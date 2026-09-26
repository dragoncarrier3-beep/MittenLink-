-- =====================================================================
-- MittenLink — 0004 Authorization helpers, search document maintenance,
-- unified search function and public-safe views.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies never recurse)
-- ---------------------------------------------------------------------
create or replace function app.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role_key = p_role and p.is_active
  )
$$;

create or replace function app.has_any_role(p_roles text[]) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role_key = any (p_roles) and p.is_active
  )
$$;

create or replace function app.is_super_admin() returns boolean
language sql stable as $$ select app.has_role('super_admin') $$;

create or replace function app.is_admin() returns boolean
language sql stable as $$ select app.has_any_role(array['admin', 'super_admin']) $$;

create or replace function app.is_staff() returns boolean
language sql stable as $$ select app.has_any_role(array['verifier', 'admin', 'super_admin']) $$;

-- Organization that owns a listing (the org itself, or the parent org).
create or replace function app.listing_organization(p_listing uuid) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select o.id from public.organizations o where o.id = p_listing),
    (select s.organization_id from public.services s where s.id = p_listing),
    (select p.organization_id from public.programs p where p.id = p_listing),
    (select e.organization_id from public.events e where e.id = p_listing),
    (select r.organization_id from public.resources r where r.id = p_listing)
  )
$$;

create or replace function app.manages_organization(p_org uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.provider_members m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create or replace function app.listing_is_public(p_listing uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing and l.publication_status = 'published' and l.verification_status <> 'archived'
  )
$$;

create or replace function app.can_read_listing(p_listing uuid) returns boolean
language sql stable as $$
  select app.listing_is_public(p_listing)
      or app.is_staff()
      or app.manages_organization(app.listing_organization(p_listing))
$$;

-- ---------------------------------------------------------------------
-- Search document maintenance
-- ---------------------------------------------------------------------
-- Query-term synonyms (data-driven; administrators can extend this table).
create table public.search_synonyms (
  term text primary key,
  alternatives text[] not null
);

create or replace function app.refresh_listing_search(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_kind text;
  v_org uuid;
  v_categories text;
  v_populations text;
  v_disabilities text;
  v_org_name text;
  v_cities text;
  v_counties text;
  v_title text;
  v_summary text;
  v_description text;
begin
  select kind, title, summary, description into v_kind, v_title, v_summary, v_description
  from listings where id = p_id;
  if not found then return; end if;

  v_org := app.listing_organization(p_id);
  if v_org is not null and v_org <> p_id then
    select title into v_org_name from listings where id = v_org;
  end if;

  select string_agg(c.name, ' ') into v_categories
  from listing_categories lc join categories c on c.id = lc.category_id where lc.listing_id = p_id;
  select string_agg(p.name, ' ') into v_populations
  from listing_populations lp join populations p on p.id = lp.population_id where lp.listing_id = p_id;
  select string_agg(d.name, ' ') into v_disabilities
  from listing_disability_categories ld join disability_categories d on d.id = ld.disability_category_id where ld.listing_id = p_id;

  -- Rebuild physical points.
  delete from listing_points where listing_id = p_id;
  if v_kind = 'organization' then
    insert into listing_points (listing_id, location_id, geog, city, county_id)
    select p_id, ol.id, ol.geog, ol.city, ol.county_id
    from organization_locations ol
    where ol.organization_id = p_id and ol.geog is not null and ol.status <> 'closed';
  elsif v_kind = 'service' then
    insert into listing_points (listing_id, location_id, geog, city, county_id)
    select p_id, ol.id, ol.geog, ol.city, ol.county_id
    from service_locations sl join organization_locations ol on ol.id = sl.location_id
    where sl.service_id = p_id and ol.geog is not null and ol.status <> 'closed';
  elsif v_kind = 'event' then
    insert into listing_points (listing_id, location_id, geog, city, county_id)
    select p_id, null, e.geog, e.city, e.county_id from events e where e.id = p_id and e.geog is not null;
  end if;

  select string_agg(distinct lp.city, ' ') into v_cities from listing_points lp where lp.listing_id = p_id;
  select string_agg(distinct c.name || ' County', ' ') into v_counties
  from (
    select county_id from listing_points where listing_id = p_id
    union select county_id from service_areas where listing_id = p_id and county_id is not null
  ) x join counties c on c.id = x.county_id;

  update listings l set
    search_text = lower(extensions.unaccent(concat_ws(' ', v_title, v_categories, v_org_name, v_populations, v_disabilities, v_cities, v_counties))),
    search_vector =
      setweight(to_tsvector('english', extensions.unaccent(coalesce(v_title, ''))), 'A') ||
      setweight(to_tsvector('english', extensions.unaccent(coalesce(v_categories, '') || ' ' || coalesce(v_disabilities, ''))), 'A') ||
      setweight(to_tsvector('english', extensions.unaccent(coalesce(v_summary, ''))), 'B') ||
      setweight(to_tsvector('english', extensions.unaccent(coalesce(v_org_name, '') || ' ' || coalesce(v_populations, ''))), 'C') ||
      setweight(to_tsvector('english', extensions.unaccent(coalesce(v_description, ''))), 'C') ||
      setweight(to_tsvector('simple', extensions.unaccent(coalesce(v_cities, '') || ' ' || coalesce(v_counties, ''))), 'D'),
    primary_city = coalesce(
      (select lp.city from listing_points lp
         left join organization_locations ol on ol.id = lp.location_id
         where lp.listing_id = p_id order by ol.is_primary desc nulls last, ol.sort_order nulls last limit 1),
      (select e.city from events e where e.id = p_id),
      l.primary_city),
    primary_county_id = coalesce(
      (select lp.county_id from listing_points lp
         left join organization_locations ol on ol.id = lp.location_id
         where lp.listing_id = p_id order by ol.is_primary desc nulls last, ol.sort_order nulls last limit 1),
      (select sa.county_id from service_areas sa where sa.listing_id = p_id and sa.county_id is not null limit 1),
      l.primary_county_id)
  where l.id = p_id;
end $$;

create or replace function app.refresh_all_listings() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n integer := 0;
begin
  for r in select id from listings order by case kind when 'organization' then 0 else 1 end loop
    perform app.refresh_listing_search(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Trigger plumbing. Bulk loaders set app.bulk_load = 'on' and call
-- app.refresh_all_listings() once at the end.
create or replace function app.bulk_loading() returns boolean
language sql stable as $$ select coalesce(current_setting('app.bulk_load', true), '') = 'on' $$;

create or replace function app.trg_refresh_listing() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if app.bulk_loading() then return null; end if;
  if tg_op = 'DELETE' then v_id := old.listing_id; else v_id := new.listing_id; end if;
  perform app.refresh_listing_search(v_id);
  return null;
end $$;

create or replace function app.trg_refresh_listing_self() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if app.bulk_loading() then return null; end if;
  perform app.refresh_listing_search(new.id);
  return null;
end $$;

create or replace function app.trg_refresh_org_children() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid; r record;
begin
  if app.bulk_loading() then return null; end if;
  if tg_op = 'DELETE' then v_org := old.organization_id; else v_org := new.organization_id; end if;
  perform app.refresh_listing_search(v_org);
  for r in select id from services where organization_id = v_org loop
    perform app.refresh_listing_search(r.id);
  end loop;
  return null;
end $$;

create or replace function app.trg_refresh_service_location() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if app.bulk_loading() then return null; end if;
  perform app.refresh_listing_search(case when tg_op = 'DELETE' then old.service_id else new.service_id end);
  return null;
end $$;

create trigger listings_search_refresh
  after insert or update of title, summary, description on public.listings
  for each row execute function app.trg_refresh_listing_self();
create trigger listing_categories_refresh after insert or delete on public.listing_categories
  for each row execute function app.trg_refresh_listing();
create trigger listing_populations_refresh after insert or delete on public.listing_populations
  for each row execute function app.trg_refresh_listing();
create trigger listing_disabilities_refresh after insert or delete on public.listing_disability_categories
  for each row execute function app.trg_refresh_listing();
create trigger service_areas_refresh after insert or update or delete on public.service_areas
  for each row execute function app.trg_refresh_listing();
create trigger org_locations_refresh after insert or update or delete on public.organization_locations
  for each row execute function app.trg_refresh_org_children();
create trigger service_locations_refresh after insert or delete on public.service_locations
  for each row execute function app.trg_refresh_service_location();
create trigger events_refresh after insert or update on public.events
  for each row execute function app.trg_refresh_listing_self();
create trigger services_refresh after insert or update of organization_id on public.services
  for each row execute function app.trg_refresh_listing_self();

-- ---------------------------------------------------------------------
-- Query normalization → tsquery with AND semantics, prefix matching,
-- synonym groups and removal of generic words.
-- ---------------------------------------------------------------------
create or replace function app.normalize_query(p_query text) returns text
language sql stable set search_path = public, extensions as $$
  select btrim(regexp_replace(lower(extensions.unaccent(coalesce(p_query, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function app.build_tsquery(p_query text) returns tsquery
language plpgsql stable set search_path = public, extensions as $$
declare
  v_terms text[];
  v_parts text[] := '{}';
  v_term text;
  v_alts text[];
  v_group text;
  v_generic text[] := array['service', 'services', 'program', 'programs', 'resource', 'resources', 'help',
    'near', 'in', 'for', 'the', 'and', 'of', 'a', 'an', 'me', 'my', 'mi', 'michigan', 'with', 'around',
    'find', 'looking', 'need', 'to', 'or', 'on', 'at', 'by', 'from', 'options', 'info', 'information'];
begin
  v_terms := array(
    select distinct t from regexp_split_to_table(app.normalize_query(p_query), '\s+') t
    where length(t) > 1 and not (t = any (v_generic))
  );
  if coalesce(array_length(v_terms, 1), 0) = 0 then return null; end if;
  foreach v_term in array v_terms loop
    select s.alternatives into v_alts from search_synonyms s where s.term = v_term;
    v_group := (
      select string_agg(quote_literal(x) || ':*', ' | ')
      from unnest(array[v_term] || coalesce(v_alts, '{}')) x
      where x ~ '^[a-z0-9]+$'
    );
    v_parts := v_parts || ('(' || v_group || ')');
  end loop;
  return to_tsquery('english', array_to_string(v_parts, ' & '));
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Unified search (security invoker: RLS decides visibility)
-- match_scope: 'nearby' (a physical location is in range), 'serves_area'
-- (a county/radius service area covers the search area), 'statewide'
-- (statewide or virtual), 'anywhere' (no location given).
-- ---------------------------------------------------------------------
create or replace function public.search_listings(
  p_query text default null,
  p_kinds text[] default null,
  p_categories text[] default null,
  p_populations text[] default null,
  p_delivery text[] default null,
  p_verified_only boolean default false,
  p_accepting_only boolean default false,
  p_free_only boolean default false,
  p_insurance_only boolean default false,
  p_accessible_only boolean default false,
  p_language text default null,
  p_org_type text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_miles double precision default null,
  p_county_id smallint default null,
  p_include_statewide boolean default true,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
  id uuid,
  kind text,
  distance_miles double precision,
  rank real,
  match_scope text,
  total_count bigint,
  local_count bigint,
  statewide_count bigint
)
language sql stable security invoker set search_path = public, extensions as $$
with params as (
  select
    app.build_tsquery(p_query) as tsq,
    nullif(app.normalize_query(p_query), '') as qnorm,
    case when p_lat is not null and p_lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end as center,
    case when p_radius_miles is not null then p_radius_miles * 1609.344 end as meters
),
base as (
  select l.*, o.org_type as own_org_type
  from listings l
  left join organizations o on o.id = l.id
  where l.publication_status = 'published'
    and l.verification_status <> 'archived'
    and (p_kinds is null or l.kind = any (p_kinds))
    and (not p_verified_only or l.verification_status = 'verified')
    -- Past events are not returned.
    and (l.kind <> 'event' or exists (select 1 from events e where e.id = l.id and e.ends_at >= now()))
),
text_match as (
  select b.*,
    case
      when pr.tsq is null and pr.qnorm is null then 0::real
      else (coalesce(ts_rank_cd(b.search_vector, pr.tsq), 0)
            + 0.6 * extensions.word_similarity(pr.qnorm, b.search_text)
            + 0.4 * extensions.similarity(pr.qnorm, lower(b.title)))::real
    end as text_rank
  from base b, params pr
  where pr.qnorm is null
     or (pr.tsq is not null and b.search_vector @@ pr.tsq)
     or extensions.word_similarity(pr.qnorm, b.search_text) >= 0.6
     or extensions.similarity(pr.qnorm, lower(b.title)) >= 0.35
),
filtered as (
  select t.*
  from text_match t
  where
    (p_categories is null or exists (
      select 1 from listing_categories lc join categories c on c.id = lc.category_id
      where lc.listing_id = t.id and c.slug = any (p_categories)))
    and (p_populations is null or exists (
      select 1 from listing_populations lp join populations p on p.id = lp.population_id
      where lp.listing_id = t.id and p.slug = any (p_populations)))
    and (p_language is null or exists (
      select 1 from listing_languages ll where ll.listing_id = t.id and ll.language_code = p_language))
    and (p_org_type is null or coalesce(t.own_org_type, (
      select o2.org_type from organizations o2 where o2.id = app.listing_organization(t.id))) = p_org_type)
    and (p_delivery is null or (
         ('virtual' = any (p_delivery) and t.virtual_available)
      or ('in_person' = any (p_delivery) and (
            (t.kind = 'service' and exists (select 1 from services s where s.id = t.id and s.in_person))
         or (t.kind = 'organization' and exists (select 1 from services s where s.organization_id = t.id and s.in_person))
         or (t.kind = 'event' and exists (select 1 from events e where e.id = t.id and e.is_in_person))
         or (t.kind = 'program' and exists (select 1 from listing_points lp where lp.listing_id = t.id))))
      or ('home_based' = any (p_delivery) and (
            (t.kind = 'service' and exists (select 1 from services s where s.id = t.id and s.home_based))
         or (t.kind = 'organization' and exists (select 1 from services s where s.organization_id = t.id and s.home_based))))))
    and (not p_accepting_only or
         (t.kind = 'service' and exists (select 1 from services s where s.id = t.id and s.waitlist_status in ('accepting', 'short_wait')))
      or (t.kind = 'organization' and exists (select 1 from services s where s.organization_id = t.id and s.waitlist_status in ('accepting', 'short_wait'))))
    and (not p_free_only or
         (t.kind = 'service' and exists (select 1 from services s where s.id = t.id and s.is_free))
      or (t.kind = 'organization' and exists (select 1 from services s where s.organization_id = t.id and s.is_free))
      or (t.kind = 'program' and exists (select 1 from programs p where p.id = t.id and p.is_free))
      or (t.kind = 'event' and exists (select 1 from events e where e.id = t.id and e.is_free))
      or t.kind = 'resource')
    and (not p_insurance_only or exists (
      select 1 from services s
      join service_payment_options spo on spo.service_id = s.id
      join payment_options po on po.id = spo.payment_option_id and po.is_insurance
      where (t.kind = 'service' and s.id = t.id) or (t.kind = 'organization' and s.organization_id = t.id)))
    and (not p_accessible_only or exists (
      select 1 from listing_points lp join organization_locations ol on ol.id = lp.location_id
      where lp.listing_id = t.id and ol.wheelchair_accessible))
),
geo as (
  select f.*,
    (select min(extensions.st_distance(lp.geog, pr.center)) / 1609.344
       from listing_points lp where lp.listing_id = f.id and pr.center is not null) as dist,
    case
      when pr.center is null and p_county_id is null then 'anywhere'
      when pr.center is not null and pr.meters is not null and exists (
        select 1 from listing_points lp where lp.listing_id = f.id and extensions.st_dwithin(lp.geog, pr.center, pr.meters)) then 'nearby'
      when pr.meters is null and p_county_id is not null and exists (
        select 1 from listing_points lp where lp.listing_id = f.id and lp.county_id = p_county_id) then 'nearby'
      when exists (
        select 1 from service_areas sa left join counties c on c.id = sa.county_id
        where sa.listing_id = f.id and (
             (sa.scope = 'county' and sa.county_id = p_county_id)
          or (sa.scope = 'county' and pr.center is not null and pr.meters is not null and (
                case when c.boundary is not null then extensions.st_dwithin(c.boundary, pr.center, pr.meters)
                     else extensions.st_dwithin(c.centroid, pr.center, pr.meters + 16000) end))
          or (sa.scope = 'radius' and pr.center is not null and extensions.st_dwithin(sa.center, pr.center, sa.radius_miles * 1609.344))
        )) then 'serves_area'
      when p_include_statewide and (
           exists (select 1 from service_areas sa where sa.listing_id = f.id and sa.scope = 'statewide')
        or (f.kind = 'event' and exists (select 1 from events e where e.id = f.id and not e.is_in_person))) then 'statewide'
      else null
    end as scope
  from filtered f, params pr
),
scoped as (
  select g.* from geo g where g.scope is not null
),
counted as (
  select s.*,
    count(*) over () as total,
    count(*) filter (where s.scope in ('nearby', 'serves_area', 'anywhere')) over () as local_total,
    count(*) filter (where s.scope = 'statewide') over () as statewide_total
  from scoped s
)
select c.id, c.kind, c.dist, c.text_rank, c.scope, c.total, c.local_total, c.statewide_total
from counted c
left join events ev on ev.id = c.id
order by
  case c.scope when 'nearby' then 0 when 'serves_area' then 1 when 'anywhere' then 1 else 2 end,
  case when p_sort = 'distance' then c.dist end asc nulls last,
  case when p_sort = 'name' then lower(c.title) end asc,
  case when p_sort = 'recent' then c.last_verified_at end desc nulls last,
  case when p_sort = 'date' then ev.starts_at end asc nulls last,
  (c.text_rank + case when c.verification_status = 'verified' then 0.05 else 0 end) desc,
  c.dist asc nulls last,
  lower(c.title) asc
limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
$$;

-- ---------------------------------------------------------------------
-- Public-safe views (expose only columns intended for the public)
-- These views intentionally run with owner privileges and filter rows
-- themselves, so base tables can stay staff-only.
-- ---------------------------------------------------------------------
create view public.public_verification_history as
select vh.id, vh.listing_id, vh.new_status, vh.action, vh.method, vh.public_summary, vh.created_at
from public.verification_history vh
join public.listings l on l.id = vh.listing_id
where l.publication_status = 'published' and l.verification_status <> 'archived'
  and vh.action in ('verified', 'status_change', 'change_approved', 'update_requested', 'unable_to_verify');

create view public.public_family_experiences as
select r.id, r.organization_id, r.service_type, r.approx_service_month, r.experience_category,
       r.accessibility_rating, r.accessibility_notes, r.communication_rating, r.comments, r.published_at
from public.family_experience_reports r
join public.listings l on l.id = r.organization_id
where r.status = 'approved' and r.publish_anonymously and r.published_at is not null
  and l.publication_status = 'published';

-- Gap indicators: demand (unsuccessful searches) vs supply per county.
create view public.resource_gap_indicators as
select fs.id, fs.normalized_query, fs.county_id, c.name as county_name, c.region,
       fs.search_count, fs.last_result_count, fs.last_seen_at, fs.status,
       case
         when fs.search_count >= 20 and fs.last_result_count = 0 then 'high'
         when fs.search_count >= 8 then 'medium'
         else 'low'
       end as gap_level
from public.failed_searches fs
left join public.counties c on c.id = fs.county_id;
