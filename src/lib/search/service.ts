import "server-only";
import { asPublic, asService, type SqlClient } from "@/lib/db";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/server/analytics";
import { hydrateCards } from "@/lib/data/listings";
import { activeFilterCount, DEFAULT_RADIUS, filtersForLog, hasCriteria, PAGE_SIZE, searchHref, toQueryString, type SearchParams } from "./params";
import { isExactPlace, normalizeLocationText, resolvePlace } from "./places";
import type { ListingCardData, MatchScope, ResolvedLocation, SearchFallback, SearchResponse } from "./types";

// ---------------------------------------------------------------------------
// Settings (platform_settings is staff-only under RLS; read with the service
// connection — these values are non-sensitive configuration, cached briefly).
// ---------------------------------------------------------------------------
let settingsCache: { at: number; lowThreshold: number; defaultRadius: number } | null = null;

async function searchSettings() {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache;
  let lowThreshold = 2;
  let defaultRadius = DEFAULT_RADIUS;
  try {
    const rows = await asService((sql) =>
      sql.query<{ key: string; value: unknown }>(
        "select key, value from public.platform_settings where key in ('low_result_threshold', 'default_search_radius_miles')",
      ),
    );
    for (const r of rows) {
      const n = Number(r.value);
      if (!Number.isFinite(n)) continue;
      if (r.key === "low_result_threshold") lowThreshold = n;
      if (r.key === "default_search_radius_miles" && n > 0) defaultRadius = n;
    }
  } catch (err) {
    console.warn("[search] settings unavailable, using defaults", err instanceof Error ? err.message : err);
  }
  settingsCache = { at: Date.now(), lowThreshold, defaultRadius };
  return settingsCache;
}

// ---------------------------------------------------------------------------
// search_listings wrapper
// ---------------------------------------------------------------------------
type SearchRow = {
  id: string;
  kind: string;
  distance_miles: number | null;
  rank: number;
  match_scope: MatchScope;
  total_count: number;
  local_count: number;
  statewide_count: number;
};

interface CallOptions {
  q: string | null;
  params: SearchParams;
  location: ResolvedLocation | null;
  radius?: number | null;
  includeStatewide?: boolean;
  noFilters?: boolean;
  limit: number;
  offset: number;
}

async function callSearch(sql: SqlClient, o: CallOptions) {
  const p = o.params;
  const nf = o.noFilters;
  const arr = (v: string[]) => (v.length ? v : null);
  const loc = o.location;
  const radius = loc && loc.kind !== "county" ? (o.radius ?? loc.radius) : null;
  const sort = p.sort === "distance" && (!loc || loc.kind === "county") ? "relevance" : p.sort;
  const rows = await sql.query<SearchRow>(
    `select id, kind, distance_miles::float8 as distance_miles, rank::float8 as rank, match_scope,
            total_count::int as total_count, local_count::int as local_count, statewide_count::int as statewide_count
     from public.search_listings(
       p_query => $1, p_kinds => $2::text[], p_categories => $3::text[], p_populations => $4::text[], p_delivery => $5::text[],
       p_verified_only => $6, p_accepting_only => $7, p_free_only => $8, p_insurance_only => $9, p_accessible_only => $10,
       p_language => $11, p_org_type => $12, p_lat => $13::float8, p_lng => $14::float8, p_radius_miles => $15::float8,
       p_county_id => $16::smallint, p_include_statewide => $17, p_sort => $18, p_limit => $19, p_offset => $20)`,
    [
      o.q || null,
      arr(p.kind),
      nf ? null : arr(p.category),
      nf ? null : arr(p.population),
      nf ? null : arr(p.delivery),
      nf ? false : p.verified,
      nf ? false : p.accepting,
      nf ? false : p.free,
      nf ? false : p.insurance,
      nf ? false : p.accessible,
      nf ? null : p.language || null,
      nf ? null : p.orgType || null,
      loc && loc.kind !== "county" ? loc.lat : null,
      loc && loc.kind !== "county" ? loc.lng : null,
      radius,
      loc ? loc.countyId : null,
      o.includeStatewide ?? true,
      sort,
      o.limit,
      o.offset,
    ],
  );
  const first = rows[0];
  return {
    rows,
    total: first?.total_count ?? 0,
    localCount: first?.local_count ?? 0,
    statewideCount: first?.statewide_count ?? 0,
  };
}

/** Split "Autism services near Ann Arbor" into query + location when the tail is a known place. */
async function interpretQuery(sql: SqlClient, q: string): Promise<{ q: string; location: string } | null> {
  const prep = q.match(/^(.+?)\s+(?:near|in|around|close to|by)\s+(.+?)[.?!]*$/i);
  if (prep && (await isExactPlace(sql, prep[2]))) return { q: prep[1].trim(), location: prep[2].trim() };
  const zip = q.match(/^(.+?)[\s,]+(4[89]\d{3})$/);
  if (zip && (await isExactPlace(sql, zip[2]))) return { q: zip[1].trim(), location: zip[2] };
  return null;
}

export interface RunSearchOptions {
  /** A committed search (Enter/Apply/pause ≥ 1.2 s or a page load) — logged for gap analysis. */
  commit: boolean;
  trigger?: "load" | "query" | "filter" | "location" | "page" | "sort";
  /** The previous committed search returned zero results and the user just removed filters. */
  abandonedFilters?: boolean;
}

// Short-lived cache of public search computations. Typing produces a live
// request and, after a pause, a "committed" request for the same query; the
// second reuses the first (in-flight or finished) and only adds logging.
type Core = Awaited<ReturnType<typeof computeCore>>;
const coreCache = new Map<string, { at: number; promise: Promise<Core> }>();
const CORE_TTL_MS = 15_000;

function cachedCore(input: SearchParams, defaultRadius: number): Promise<Core> {
  const key = `${defaultRadius}|${toQueryString(input, { view: "list" })}`;
  const now = Date.now();
  for (const [k, v] of coreCache) if (now - v.at > CORE_TTL_MS) coreCache.delete(k);
  const hit = coreCache.get(key);
  if (hit) return hit.promise;
  const promise = computeCore(input, defaultRadius);
  coreCache.set(key, { at: now, promise });
  promise.catch(() => coreCache.delete(key));
  if (coreCache.size > 300) coreCache.delete(coreCache.keys().next().value as string);
  return promise;
}

async function computeCore(input: SearchParams, defaultRadius: number) {
  let params = { ...input };
  return asPublic(async (sql) => {
    let interpreted: { q: string; location: string } | null = null;
    if (params.q && !params.location) {
      interpreted = await interpretQuery(sql, params.q);
      if (interpreted) params = { ...params, q: interpreted.q, location: interpreted.location };
    }

    const location = params.location ? await resolvePlace(sql, params.location, params.radius, defaultRadius) : null;
    const locationUnmatched = params.location && !location ? params.location : null;
    const stripCounty = (t: string) => normalizeLocationText(t).replace(/ *county$/, "").trim();
    const typed = stripCounty(params.location);
    const matched = location ? stripCounty(location.label) : "";
    const locationCorrectedFrom = location && location.kind !== "zip" && typed !== matched ? params.location : null;

    const offset = (params.page - 1) * PAGE_SIZE;
    const main = await callSearch(sql, { q: params.q, params, location, limit: PAGE_SIZE, offset });
    const results = await hydrateCards(
      sql,
      main.rows.map((r) => ({ id: r.id, distance: r.distance_miles, scope: r.match_scope })),
    );

    const located = !!location;
    const noLocalMatch = located && main.localCount === 0;
    let fallback: SearchFallback | null = null;
    if (params.page === 1 && (noLocalMatch || main.total === 0)) {
      fallback = await findRelated(sql, params, location, new Set(results.map((r) => r.id)));
    }
    return { params, interpreted, location, locationUnmatched, locationCorrectedFrom, main, results, noLocalMatch, fallback };
  });
}

export async function runSearch(input: SearchParams, opts: RunSearchOptions): Promise<SearchResponse> {
  const settings = await searchSettings();
  const core = await cachedCore(input, settings.defaultRadius);
  const params = core.params;
  const { main, location } = core;
  const countForOutcome = location ? main.localCount : main.total;
  const outcome: SearchResponse["outcome"] = countForOutcome === 0 ? "zero" : countForOutcome <= settings.lowThreshold ? "low" : "ok";

  if (opts.commit && params.page === 1 && hasCriteria(params)) {
    await logSearch(params, location, countForOutcome, outcome);
    const props = {
      has_query: !!params.q,
      has_location: !!location,
      filter_count: activeFilterCount(params),
      result_count: countForOutcome,
      total_count: main.total,
      outcome,
      trigger: opts.trigger ?? "query",
    };
    await track("search_performed", { properties: props });
    if (outcome === "zero") await track("search_zero_results", { properties: props });
    if (opts.trigger === "filter" && activeFilterCount(params) > 0) {
      await track("filter_applied", { properties: { filter_count: activeFilterCount(params), result_count: countForOutcome } });
    }
    if (opts.abandonedFilters) {
      await track("filter_abandoned", { properties: { filter_count: activeFilterCount(params), result_count: countForOutcome } });
    }
  }

  const user = await getCurrentUser();
  let savedIds: string[] = [];
  if (user) {
    const ids = [...core.results.map((r) => r.id), ...(core.fallback?.related.map((r) => r.id) ?? [])];
    if (ids.length) {
      try {
        const rows = await asCurrentUser((sql) =>
          sql.query<{ listing_id: string }>("select listing_id from public.saved_resources where listing_id = any ($1::uuid[])", [ids]),
        );
        savedIds = rows.map((r) => r.listing_id);
      } catch (err) {
        console.warn("[search] could not load saved resources", err instanceof Error ? err.message : err);
      }
    }
  }

  return {
    ok: true,
    results: core.results,
    total: main.total,
    localCount: main.localCount,
    statewideCount: main.statewideCount,
    page: params.page,
    pageSize: PAGE_SIZE,
    location,
    locationUnmatched: core.locationUnmatched,
    locationCorrectedFrom: core.locationCorrectedFrom,
    interpreted: core.interpreted,
    outcome,
    noLocalMatch: core.noLocalMatch,
    fallback: core.fallback,
    savedIds,
    signedIn: !!user,
  };
}

/**
 * Broaden a search that found nothing locally. Only real, published records
 * are returned — the broadening steps are, in order: a wider radius, the same
 * search anywhere in Michigan, then the same area without refinement filters.
 */
async function findRelated(sql: SqlClient, params: SearchParams, location: ResolvedLocation | null, exclude: Set<string>): Promise<SearchFallback | null> {
  const pick = async (o: Omit<CallOptions, "limit" | "offset">) => {
    const res = await callSearch(sql, { ...o, limit: 12, offset: 0 });
    const metas = res.rows.filter((r) => !exclude.has(r.id)).slice(0, 6);
    return hydrateCards(sql, metas.map((r) => ({ id: r.id, distance: r.distance_miles, scope: r.match_scope })));
  };
  let related: ListingCardData[] = [];

  if (location && location.kind !== "county" && (location.radius ?? 0) < 100) {
    related = await pick({ q: params.q, params, location, radius: 100, includeStatewide: false });
    if (related.length) {
      return {
        related,
        relatedLabel: `Related resources in the wider ${location.label} region (up to about 100 miles)`,
        relatedHref: searchHref({ ...params, page: 1, radius: 100 }),
      };
    }
  }
  if (location) {
    related = await pick({ q: params.q, params, location: null, includeStatewide: false });
    if (related.length) {
      return { related, relatedLabel: "Matching resources in other parts of Michigan", relatedHref: searchHref({ ...params, page: 1, location: "", radius: null }) };
    }
  }
  if (activeFilterCount(params) > 0) {
    related = await pick({ q: params.q, params, location, noFilters: true });
    if (related.length) {
      return {
        related,
        relatedLabel: location ? `Resources near ${location.label} without your filters` : "Resources that match without your filters",
        relatedHref: searchHref({ q: params.q, location: params.location, radius: params.radius, kind: params.kind }),
      };
    }
  }
  if (params.category.length && params.q) {
    related = await pick({ q: null, params, location: null });
    if (related.length) {
      return { related, relatedLabel: "Other resources in the same category", relatedHref: searchHref({ category: params.category }) };
    }
  }
  return null;
}

/** Privacy-conscious search logging (no user id, no IP address). */
async function logSearch(params: SearchParams, location: ResolvedLocation | null, resultCount: number, outcome: "ok" | "low" | "zero") {
  const filters = filtersForLog(params);
  // Empty text query: describe the search by its categories so gap analysis stays useful.
  const queryText = params.q || params.category.join(" ").replace(/-/g, " ");
  try {
    await asService(async (sql) => {
      await sql.query(
        `insert into public.search_logs (normalized_query, location_label, county_id, radius_miles, filters, result_count, outcome)
         values (app.normalize_query($1), $2, $3, $4, $5::jsonb, $6, $7)`,
        [queryText, location?.label ?? null, location?.countyId ?? null, location?.radius ?? null, JSON.stringify(filters), resultCount, outcome],
      );
      if ((outcome === "zero" || outcome === "low") && queryText.trim()) {
        await sql.query(
          `insert into public.failed_searches (normalized_query, county_id, search_count, last_result_count)
           values (app.normalize_query($1), $2, 1, $3)
           on conflict (normalized_query, (coalesce(county_id, 0))) do update
             set search_count = public.failed_searches.search_count + 1,
                 last_result_count = excluded.last_result_count,
                 last_seen_at = now()`,
          [queryText, location?.countyId ?? null, resultCount],
        );
      }
    });
  } catch (err) {
    // Logging must never break a search.
    console.warn("[search] log failed", err instanceof Error ? err.message : err);
  }
}
