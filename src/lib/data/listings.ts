import "server-only";
import { asPublic, type SqlClient } from "@/lib/db";
import type { ListingCardData, MatchScope } from "@/lib/search/types";

/*
 * Public read models for listing cards, the homepage and browse pages.
 * Every query runs through asPublic (role anon, RLS enforced), so
 * unpublished/archived records can never leak into public pages.
 */

type CardRow = {
  id: string;
  kind: ListingCardData["kind"];
  slug: string;
  title: string;
  summary: string;
  verification_status: string;
  last_verified_at: Date | null;
  virtual_available: boolean;
  primary_city: string | null;
  county: string | null;
  statewide: boolean;
  categories: { slug: string; name: string }[] | null;
  populations: string[] | null;
  tier: "free" | "enhanced" | null;
  parent_title: string | null;
  parent_slug: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  is_in_person: boolean | null;
  venue_name: string | null;
  event_city: string | null;
  event_type: string | null;
  resource_type: string | null;
  points: { lat: number; lng: number; label: string | null }[] | null;
};

const CARD_SQL = `
select l.id, l.kind, l.slug, l.title, l.summary, l.verification_status, l.last_verified_at, l.virtual_available,
  l.primary_city, pc.name as county,
  exists (select 1 from public.service_areas sa where sa.listing_id = l.id and sa.scope = 'statewide') as statewide,
  (select json_agg(json_build_object('slug', c.slug, 'name', c.name) order by lc.is_primary desc, c.sort_order)
     from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id) as categories,
  (select json_agg(p.name order by p.sort_order)
     from public.listing_populations lp join public.populations p on p.id = lp.population_id where lp.listing_id = l.id) as populations,
  org.listing_tier as tier,
  case when parent.id <> l.id then parent.title end as parent_title,
  case when parent.id <> l.id then parent.slug end as parent_slug,
  e.starts_at, e.ends_at, e.is_in_person, e.venue_name, e.city as event_city, e.event_type,
  r.resource_type,
  (select json_agg(json_build_object(
      'lat', extensions.st_y(lp.geog::extensions.geometry),
      'lng', extensions.st_x(lp.geog::extensions.geometry),
      'label', coalesce(ol.name, e.venue_name, lp.city)))
     from public.listing_points lp left join public.organization_locations ol on ol.id = lp.location_id
     where lp.listing_id = l.id) as points
from public.listings l
left join public.counties pc on pc.id = l.primary_county_id
left join public.listings parent on parent.id = app.listing_organization(l.id)
left join public.organizations org on org.id = parent.id
left join public.events e on e.id = l.id
left join public.resources r on r.id = l.id
where l.id = any ($1::uuid[])`;

export interface CardMeta {
  id: string;
  distance?: number | null;
  scope?: MatchScope | null;
}

/** Load card data for ids, preserving the given order (ranking comes only from search_listings). */
export async function hydrateCards(sql: SqlClient, metas: CardMeta[]): Promise<ListingCardData[]> {
  if (!metas.length) return [];
  const rows = await sql.query<CardRow>(CARD_SQL, [metas.map((m) => m.id)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ListingCardData[] = [];
  for (const m of metas) {
    const r = byId.get(m.id);
    if (!r) continue;
    out.push(toCard(r, m));
  }
  return out;
}

function toCard(r: CardRow, m: CardMeta): ListingCardData {
  return {
    id: r.id,
    kind: r.kind,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    city: r.primary_city ?? r.event_city,
    county: r.county,
    distanceMiles: m.distance ?? null,
    matchScope: m.scope ?? null,
    statewide: r.statewide,
    virtual: r.virtual_available || (r.kind === "event" && r.is_in_person === false),
    categories: r.categories ?? [],
    populations: r.populations ?? [],
    verificationStatus: r.verification_status,
    lastVerifiedAt: r.last_verified_at ? new Date(r.last_verified_at).toISOString() : null,
    tier: r.tier,
    parent: r.parent_title && r.parent_slug ? { title: r.parent_title, slug: r.parent_slug } : null,
    event:
      r.kind === "event" && r.starts_at && r.ends_at
        ? {
            startsAt: new Date(r.starts_at).toISOString(),
            endsAt: new Date(r.ends_at).toISOString(),
            isInPerson: !!r.is_in_person,
            venue: r.venue_name,
            eventType: r.event_type ?? "workshop",
          }
        : null,
    resourceType: r.resource_type,
    points: (r.points ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
  };
}

/** Load cards for ids already chosen by a public query. */
export function cardsByIds(ids: string[]) {
  return asPublic((sql) => hydrateCards(sql, ids.map((id) => ({ id }))));
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export interface CategoryCount {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  count: number;
}

export async function getCategoryCounts(): Promise<CategoryCount[]> {
  return asPublic((sql) =>
    sql.query<CategoryCount>(
      `select c.slug, c.name, c.description, c.icon,
         (select count(distinct lc.listing_id)::int from public.listing_categories lc
            join public.listings l on l.id = lc.listing_id
            left join public.events e on e.id = l.id
            where lc.category_id = c.id and l.publication_status = 'published' and l.verification_status <> 'archived'
              and (l.kind <> 'event' or e.ends_at >= now())) as count
       from public.categories c where c.is_active order by c.is_featured desc, c.sort_order`,
    ),
  );
}

export async function getRecentlyVerified(limit = 6): Promise<ListingCardData[]> {
  return asPublic(async (sql) => {
    const rows = await sql.query<{ id: string }>(
      `select id from public.listings
       where publication_status = 'published' and verification_status = 'verified' and last_verified_at is not null
         and kind in ('organization', 'service', 'program')
       order by last_verified_at desc, title limit $1`,
      [limit],
    );
    return hydrateCards(sql, rows);
  });
}

export async function getUpcomingEvents(limit = 4, opts: { type?: string; virtualOnly?: boolean; inPersonOnly?: boolean; offset?: number } = {}) {
  return asPublic(async (sql) => {
    const params: unknown[] = [limit, opts.offset ?? 0];
    let where = "";
    if (opts.type) {
      params.push(opts.type);
      where += ` and e.event_type = $${params.length}`;
    }
    if (opts.virtualOnly) where += " and not e.is_in_person";
    if (opts.inPersonOnly) where += " and e.is_in_person";
    const rows = await sql.query<{ id: string; total: number }>(
      `select l.id, count(*) over ()::int as total from public.listings l join public.events e on e.id = l.id
       where l.publication_status = 'published' and l.verification_status <> 'archived' and e.ends_at >= now() ${where}
       order by e.starts_at, l.title limit $1 offset $2`,
      params,
    );
    return { cards: await hydrateCards(sql, rows), total: rows[0]?.total ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// Browse pages
// ---------------------------------------------------------------------------

export async function listOrganizations(opts: { page: number; pageSize: number; county?: number | null; region?: string | null; category?: string | null; letter?: string | null }) {
  return asPublic(async (sql) => {
    const params: unknown[] = [opts.pageSize, (opts.page - 1) * opts.pageSize];
    let where = "";
    if (opts.county) {
      params.push(opts.county);
      where += ` and (exists (select 1 from public.organization_locations ol where ol.organization_id = l.id and ol.county_id = $${params.length})
                  or exists (select 1 from public.service_areas sa where sa.listing_id = l.id and sa.county_id = $${params.length}))`;
    }
    if (opts.region) {
      params.push(opts.region);
      where += ` and (exists (select 1 from public.organization_locations ol join public.counties c on c.id = ol.county_id where ol.organization_id = l.id and c.region = $${params.length})
                  or exists (select 1 from public.service_areas sa join public.counties c on c.id = sa.county_id where sa.listing_id = l.id and c.region = $${params.length}))`;
    }
    if (opts.category) {
      params.push(opts.category);
      where += ` and exists (select 1 from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id and c.slug = $${params.length})`;
    }
    if (opts.letter) {
      params.push(opts.letter.toLowerCase());
      where += ` and lower(left(l.title, 1)) = $${params.length}`;
    }
    const rows = await sql.query<{ id: string; total: number }>(
      `select l.id, count(*) over ()::int as total from public.listings l
       where l.kind = 'organization' and l.publication_status = 'published' and l.verification_status <> 'archived' ${where}
       order by lower(l.title) limit $1 offset $2`,
      params,
    );
    return { cards: await hydrateCards(sql, rows), total: rows[0]?.total ?? 0 };
  });
}

export async function listPrograms(opts: { page: number; pageSize: number; category?: string | null }) {
  return asPublic(async (sql) => {
    const params: unknown[] = [opts.pageSize, (opts.page - 1) * opts.pageSize];
    let where = "";
    if (opts.category) {
      params.push(opts.category);
      where += ` and exists (select 1 from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = l.id and c.slug = $${params.length})`;
    }
    const rows = await sql.query<{ id: string; total: number }>(
      `select l.id, count(*) over ()::int as total from public.listings l join public.programs p on p.id = l.id
       where l.publication_status = 'published' and l.verification_status <> 'archived'
         and (p.end_date is null or p.end_date >= current_date) ${where}
       order by lower(l.title) limit $1 offset $2`,
      params,
    );
    return { cards: await hydrateCards(sql, rows), total: rows[0]?.total ?? 0 };
  });
}

export async function listGuides() {
  return asPublic(async (sql) => {
    const rows = await sql.query<{ id: string; category: string | null; category_slug: string | null }>(
      `select l.id,
         (select c.name from public.listing_categories lc join public.categories c on c.id = lc.category_id
            where lc.listing_id = l.id order by lc.is_primary desc, c.sort_order limit 1) as category,
         (select c.slug from public.listing_categories lc join public.categories c on c.id = lc.category_id
            where lc.listing_id = l.id order by lc.is_primary desc, c.sort_order limit 1) as category_slug
       from public.listings l
       where l.kind = 'resource' and l.publication_status = 'published' and l.verification_status <> 'archived'
       order by lower(l.title)`,
    );
    const cards = await hydrateCards(sql, rows);
    const groups = new Map<string, { slug: string | null; name: string; cards: ListingCardData[] }>();
    rows.forEach((r) => {
      const card = cards.find((c) => c.id === r.id);
      if (!card) return;
      const key = r.category ?? "General information";
      if (!groups.has(key)) groups.set(key, { slug: r.category_slug, name: key, cards: [] });
      groups.get(key)!.cards.push(card);
    });
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getFilterReference() {
  return asPublic(async (sql) => {
    // Sequential: one connection per transaction.
    const categories = await sql.query<{ slug: string; name: string }>("select slug, name from public.categories where is_active order by is_featured desc, sort_order");
    const populations = await sql.query<{ slug: string; name: string }>("select slug, name from public.populations order by sort_order");
    const languages = await sql.query<{ code: string; name: string }>("select code, name from public.languages order by sort_order, name");
    const counties = await sql.query<{ id: number; name: string; region: string }>("select id, name, region from public.counties order by name");
    return { categories, populations, languages, counties };
  });
}
