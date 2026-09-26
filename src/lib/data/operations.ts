import "server-only";
import { asService, type SqlClient } from "@/lib/db";
import type { DiscoverySuggestions, DuplicateMatch } from "@/lib/integrations/discovery/types";

/*
 * Read models for admin operations: Source Watch, Outreach CRM, and
 * search-gap analytics. These use asService (RLS bypass), so every caller
 * MUST be a page/action that already passed requireAdmin()/assertRole().
 */

export interface Option {
  value: string;
  label: string;
}

// ------------------------------------------------------------------ shared lookups

export async function getLookups() {
  return asService(async (sql) => {
    const [categories, counties, populations, staff, admins] = await Promise.all([
      sql.query<{ id: number; slug: string; name: string }>("select id, slug, name from public.categories where is_active order by name"),
      sql.query<{ id: number; name: string; region: string }>("select id, name, region from public.counties order by name"),
      sql.query<{ slug: string; name: string }>("select slug, name from public.populations order by sort_order, name"),
      staffQuery(sql, ["verifier", "admin", "super_admin"]),
      staffQuery(sql, ["admin", "super_admin"]),
    ]);
    const regions = [...new Set(counties.map((c) => c.region))].sort();
    return { categories, counties, populations, staff, admins, regions };
  });
}

function staffQuery(sql: SqlClient, roles: string[]) {
  return sql.query<{ id: string; full_name: string }>(
    `select distinct p.id, p.full_name from public.profiles p join public.user_roles ur on ur.user_id = p.id
     where ur.role_key = any($1) and p.is_active order by p.full_name`,
    [roles],
  );
}

// ------------------------------------------------------------------ source watch

export interface CandidateRow {
  id: string;
  name: string;
  url: string | null;
  status: string;
  category_name: string | null;
  possible_city: string | null;
  county_name: string | null;
  source_name: string | null;
  discovered_at: Date;
  duplicate_confidence: number | null;
}

export async function listCandidates(status: string | null) {
  return asService(async (sql) => {
    const rows = await sql.query<CandidateRow>(
      `select c.id, c.name, c.url, c.status, cat.name as category_name, c.possible_city, co.name as county_name,
              s.name as source_name, c.discovered_at, c.duplicate_confidence
       from public.source_watch_candidates c
       left join public.categories cat on cat.id = c.suggested_category_id
       left join public.counties co on co.id = c.possible_county_id
       left join public.source_watch_sources s on s.id = c.source_id
       where ($1::text is null or c.status = $1)
       order by case c.status when 'new' then 0 when 'reviewing' then 1 when 'possible_duplicate' then 2 when 'approved_for_import' then 3 else 4 end,
                c.discovered_at desc`,
      [status],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from public.source_watch_candidates group by status");
    return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number> };
  });
}

export interface CandidateDetail {
  id: string;
  name: string;
  url: string | null;
  excerpt: string | null;
  status: string;
  suggested_category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  possible_city: string | null;
  possible_county_id: number | null;
  county_name: string | null;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  source_type: string | null;
  discovered_at: Date;
  duplicate_confidence: number | null;
  duplicate_listing_id: string | null;
  suggestions: Partial<DiscoverySuggestions> | null;
  suggestion_engine: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  imported_listing_id: string | null;
  imported_kind: string | null;
  imported_slug: string | null;
  imported_title: string | null;
}

export async function getCandidate(id: string) {
  return asService(async (sql) => {
    const [c] = await sql.query<CandidateDetail>(
      `select c.id, c.name, c.url, c.excerpt, c.status, c.suggested_category_id, cat.name as category_name, cat.slug as category_slug,
              c.possible_city, c.possible_county_id, co.name as county_name, c.source_id, s.name as source_name, s.url as source_url,
              s.source_type, c.discovered_at, c.duplicate_confidence, c.duplicate_listing_id, c.suggestions, c.suggestion_engine,
              rp.full_name as reviewed_by_name, c.reviewed_at, c.imported_listing_id, il.kind as imported_kind, il.slug as imported_slug,
              il.title as imported_title
       from public.source_watch_candidates c
       left join public.categories cat on cat.id = c.suggested_category_id
       left join public.counties co on co.id = c.possible_county_id
       left join public.source_watch_sources s on s.id = c.source_id
       left join public.profiles rp on rp.id = c.reviewed_by
       left join public.listings il on il.id = c.imported_listing_id
       where c.id = $1`,
      [id],
    );
    if (!c) return null;
    // Existing listings to compare side by side: suggested duplicates + the linked duplicate.
    const ids = new Set<string>();
    if (c.duplicate_listing_id) ids.add(c.duplicate_listing_id);
    for (const d of c.suggestions?.duplicates ?? []) if (d?.listing_id) ids.add(d.listing_id);
    const matches = ids.size ? await listingSummaries(sql, [...ids]) : [];
    const confidenceFor = (lid: string) =>
      c.suggestions?.duplicates?.find((d) => d.listing_id === lid)?.confidence ?? (lid === c.duplicate_listing_id ? c.duplicate_confidence ?? 0 : 0);
    const dupes: DuplicateMatch[] = matches
      .map((m) => ({ ...m, confidence: confidenceFor(m.listing_id), signals: { name_similarity: 0, same_website_domain: false, same_phone: false } }))
      .sort((a, b) => b.confidence - a.confidence);
    return { candidate: c, duplicates: dupes };
  });
}

async function listingSummaries(sql: SqlClient, ids: string[]) {
  return sql.query<Omit<DuplicateMatch, "confidence" | "signals">>(
    `select l.id as listing_id, l.kind, l.slug, l.title, l.publication_status, l.verification_status, l.primary_city as city, co.name as county,
            coalesce(o.website, p.website, so.website) as website,
            coalesce(o.public_phone, s.contact_phone, p.contact_phone, so.public_phone) as phone
     from public.listings l
     left join public.counties co on co.id = l.primary_county_id
     left join public.organizations o on o.id = l.id
     left join public.services s on s.id = l.id
     left join public.organizations so on so.id = s.organization_id
     left join public.programs p on p.id = l.id
     where l.id = any($1::uuid[])`,
    [ids],
  );
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  source_type: string;
  coverage: string;
  county_id: number | null;
  is_statewide: boolean;
  check_frequency_days: number;
  last_checked_at: Date | null;
  status: string;
  automated_checks_authorized: boolean;
  notes: string | null;
  candidate_count: number;
  check_due: boolean;
}

export async function listSources() {
  return asService((sql) =>
    sql.query<SourceRow>(
      `select s.*, (select count(*)::int from public.source_watch_candidates c where c.source_id = s.id) as candidate_count,
              (s.last_checked_at is null or s.last_checked_at < now() - make_interval(days => s.check_frequency_days::int)) as check_due
       from public.source_watch_sources s
       order by case s.status when 'needs_attention' then 0 when 'active' then 1 else 2 end, s.name`,
    ),
  );
}

export async function getSource(id: string) {
  const rows = await asService((sql) => sql.query<SourceRow>("select s.*, 0 as candidate_count, false as check_due from public.source_watch_sources s where s.id = $1", [id]));
  return rows[0] ?? null;
}

export interface ResearchTaskRow {
  id: string;
  title: string;
  details: string | null;
  status: string;
  county_name: string | null;
  category_name: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  gap_flag_id: string | null;
  gap_title: string | null;
  created_at: Date;
  created_by_name: string | null;
}

export async function listResearchTasks() {
  return asService((sql) =>
    sql.query<ResearchTaskRow>(
      `select t.id, t.title, t.details, t.status, co.name as county_name, cat.name as category_name, t.assigned_to,
              ap.full_name as assignee_name, t.gap_flag_id, g.title as gap_title, t.created_at, cp.full_name as created_by_name
       from public.source_watch_tasks t
       left join public.counties co on co.id = t.county_id
       left join public.categories cat on cat.id = t.category_id
       left join public.profiles ap on ap.id = t.assigned_to
       left join public.profiles cp on cp.id = t.created_by
       left join public.resource_gap_flags g on g.id = t.gap_flag_id
       order by case t.status when 'in_progress' then 0 when 'open' then 1 when 'done' then 2 else 3 end, t.created_at desc`,
    ),
  );
}

// ------------------------------------------------------------------ outreach

export interface OutreachRow {
  id: string;
  organization_id: string;
  organization_title: string;
  organization_slug: string;
  contact_name: string;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  last_contacted_at: Date | null;
  next_follow_up_at: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  notes: string | null;
  is_overdue: boolean;
  is_due: boolean;
}

const OUTREACH_SELECT = `
  select oc.id, oc.organization_id, l.title as organization_title, l.slug as organization_slug, oc.contact_name, oc.contact_role,
         oc.email, oc.phone, oc.status, oc.last_contacted_at, to_char(oc.next_follow_up_at, 'YYYY-MM-DD') as next_follow_up_at,
         oc.assigned_to, p.full_name as assignee_name, oc.notes,
         (oc.next_follow_up_at < current_date and oc.status not in ('claimed', 'declined')) as is_overdue,
         (oc.next_follow_up_at <= current_date and oc.status not in ('claimed', 'declined')) as is_due
  from public.outreach_contacts oc
  join public.listings l on l.id = oc.organization_id
  left join public.profiles p on p.id = oc.assigned_to`;

export async function listOutreach(filters: { status: string | null; assignedTo: string | null; overdue: boolean; queue: boolean }) {
  return asService(async (sql) => {
    const rows = await sql.query<OutreachRow>(
      `${OUTREACH_SELECT}
       where ($1::text is null or oc.status = $1)
         and ($2::uuid is null or oc.assigned_to = $2::uuid)
         and (not $3 or (oc.next_follow_up_at < current_date and oc.status not in ('claimed', 'declined')))
         and (not $4 or (oc.next_follow_up_at <= current_date and oc.status not in ('claimed', 'declined')))
       order by ${filters.queue ? "oc.next_follow_up_at asc, l.title" : "oc.next_follow_up_at asc nulls last, l.title"}`,
      [filters.status, filters.assignedTo, filters.overdue, filters.queue],
    );
    const [c] = await sql.query<{ due: number; total: number }>(
      `select count(*) filter (where next_follow_up_at <= current_date and status not in ('claimed', 'declined'))::int as due, count(*)::int as total
       from public.outreach_contacts`,
    );
    return { rows, dueCount: c?.due ?? 0, total: c?.total ?? 0 };
  });
}

export interface InteractionRow {
  id: string;
  channel: string;
  summary: string;
  status_after: string | null;
  occurred_at: Date;
  author: string | null;
}

export async function getOutreach(id: string) {
  return asService(async (sql) => {
    const [contact] = await sql.query<OutreachRow>(`${OUTREACH_SELECT} where oc.id = $1`, [id]);
    if (!contact) return null;
    const interactions = await sql.query<InteractionRow>(
      `select i.id, i.channel, i.summary, i.status_after, i.occurred_at, p.full_name as author
       from public.outreach_interactions i left join public.profiles p on p.id = i.created_by
       where i.outreach_contact_id = $1 order by i.occurred_at desc`,
      [id],
    );
    const [org] = await sql.query<{ claimed_at: Date | null; listing_tier: string; claim_status: string | null; claim_id: string | null; publication_status: string; verification_status: string }>(
      `select o.claimed_at, o.listing_tier, l.publication_status, l.verification_status,
              (select pc.status from public.provider_claims pc where pc.organization_id = o.id order by pc.created_at desc limit 1) as claim_status,
              (select pc.id from public.provider_claims pc where pc.organization_id = o.id order by pc.created_at desc limit 1) as claim_id
       from public.organizations o join public.listings l on l.id = o.id where o.id = $1`,
      [contact.organization_id],
    );
    return { contact, interactions, org: org ?? null };
  });
}

export async function getOrganizationOptions(): Promise<Option[]> {
  const rows = await asService((sql) =>
    sql.query<{ id: string; title: string; city: string | null }>(
      "select l.id, l.title, l.primary_city as city from public.listings l join public.organizations o on o.id = l.id where l.publication_status <> 'archived' order by l.title",
    ),
  );
  return rows.map((r) => ({ value: r.id, label: r.city ? `${r.title} (${r.city})` : r.title }));
}

// ------------------------------------------------------------------ search analytics

export type GapLevel = "high" | "medium" | "low";

export interface FailedSearchRow {
  id: string;
  normalized_query: string;
  county_id: number | null;
  county_name: string | null;
  region: string | null;
  search_count: number;
  last_result_count: number;
  last_seen_at: Date;
  status: string;
  gap_level: GapLevel;
}

export async function listSearchGaps(filters: { county: number | null; region: string | null; level: GapLevel | null; includeReviewed: boolean }) {
  return asService((sql) =>
    sql.query<FailedSearchRow>(
      `select id, normalized_query, county_id, county_name, region, search_count, last_result_count, last_seen_at, status, gap_level
       from public.resource_gap_indicators
       where ($1::smallint is null or county_id = $1)
         and ($2::text is null or region = $2)
         and ($3::text is null or gap_level = $3)
         and ($4 or status = 'open')
       order by case gap_level when 'high' then 0 when 'medium' then 1 else 2 end, search_count desc`,
      [filters.county, filters.region, filters.level, filters.includeReviewed],
    ),
  );
}

export async function getSearchStats(days = 30) {
  return asService(async (sql) => {
    const [totals] = await sql.query<{ total: number; zero: number; low: number }>(
      `select count(*)::int as total, count(*) filter (where outcome = 'zero')::int as zero, count(*) filter (where outcome = 'low')::int as low
       from public.search_logs where created_at >= now() - make_interval(days => $1)`,
      [days],
    );
    const topUnsuccessful = await sql.query<{ query: string; searches: number; zero: number }>(
      `select normalized_query as query, count(*)::int as searches, count(*) filter (where outcome = 'zero')::int as zero
       from public.search_logs
       where created_at >= now() - make_interval(days => $1) and outcome in ('zero', 'low') and normalized_query <> ''
       group by normalized_query order by searches desc, query limit 8`,
      [days],
    );
    const byRegion = await sql.query<{ region: string; searches: number; unsuccessful: number }>(
      `select coalesce(c.region, 'No location given') as region, count(*)::int as searches,
              count(*) filter (where s.outcome in ('zero', 'low'))::int as unsuccessful
       from public.search_logs s left join public.counties c on c.id = s.county_id
       where s.created_at >= now() - make_interval(days => $1)
       group by 1 order by searches desc`,
      [days],
    );
    return { totals: totals ?? { total: 0, zero: 0, low: 0 }, topUnsuccessful, byRegion };
  });
}

export interface GapFlagRow {
  id: string;
  title: string;
  description: string;
  indicator_type: string;
  severity: string;
  category_id: number | null;
  category_name: string | null;
  county_id: number | null;
  county_name: string | null;
  region: string | null;
  search_count: number;
  resource_count: number;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: Date;
  updated_at: Date;
  task_count: number;
}

const GAP_SELECT = `
  select g.id, g.title, g.description, g.indicator_type, g.severity, g.category_id, cat.name as category_name, g.county_id,
         co.name as county_name, coalesce(g.region, co.region) as region, g.search_count, g.resource_count, g.status, g.assigned_to,
         p.full_name as assignee_name, g.created_at, g.updated_at,
         (select count(*)::int from public.source_watch_tasks t where t.gap_flag_id = g.id) as task_count
  from public.resource_gap_flags g
  left join public.categories cat on cat.id = g.category_id
  left join public.counties co on co.id = g.county_id
  left join public.profiles p on p.id = g.assigned_to`;

export async function listGapFlags(showClosed: boolean) {
  return asService((sql) =>
    sql.query<GapFlagRow>(
      `${GAP_SELECT}
       where ($1 or g.status not in ('resolved', 'dismissed'))
       order by case g.status when 'resolved' then 2 when 'dismissed' then 2 else 0 end,
                case g.severity when 'high' then 0 when 'medium' then 1 else 2 end, g.search_count desc`,
      [showClosed],
    ),
  );
}

export async function getGapFlag(id: string) {
  return asService(async (sql) => {
    const [flag] = await sql.query<GapFlagRow>(`${GAP_SELECT} where g.id = $1`, [id]);
    if (!flag) return null;
    const tasks = await sql.query<ResearchTaskRow>(
      `select t.id, t.title, t.details, t.status, null::text as county_name, null::text as category_name, t.assigned_to,
              ap.full_name as assignee_name, t.gap_flag_id, null::text as gap_title, t.created_at, null::text as created_by_name
       from public.source_watch_tasks t left join public.profiles ap on ap.id = t.assigned_to
       where t.gap_flag_id = $1 order by t.created_at desc`,
      [id],
    );
    return { flag, tasks };
  });
}

/** Published, verified listings per category and region (local = physical point or county service area). */
export async function getSupplyByRegion() {
  return asService(async (sql) => {
    const regions = (await sql.query<{ region: string }>("select distinct region from public.counties order by region")).map((r) => r.region);
    const rows = await sql.query<{ category: string; region: string; n: number }>(
      `with pub as (
         select l.id from public.listings l where l.publication_status = 'published' and l.verification_status = 'verified'
       ), served as (
         select lp.listing_id, c.region from public.listing_points lp join public.counties c on c.id = lp.county_id join pub on pub.id = lp.listing_id
         union
         select sa.listing_id, c.region from public.service_areas sa join public.counties c on c.id = sa.county_id join pub on pub.id = sa.listing_id
         where sa.scope = 'county'
         union
         select sa.listing_id, 'Statewide' from public.service_areas sa join pub on pub.id = sa.listing_id where sa.scope = 'statewide'
       )
       select cat.name as category, s.region, count(distinct s.listing_id)::int as n
       from served s join public.listing_categories lc on lc.listing_id = s.listing_id join public.categories cat on cat.id = lc.category_id
       group by cat.name, s.region`,
    );
    const categories = (await sql.query<{ name: string }>("select name from public.categories where is_active order by name")).map((c) => c.name);
    const grid = new Map<string, Record<string, number>>();
    for (const c of categories) grid.set(c, {});
    for (const r of rows) {
      const entry = grid.get(r.category) ?? {};
      entry[r.region] = r.n;
      grid.set(r.category, entry);
    }
    return { regions, categories, grid: Object.fromEntries(grid) as Record<string, Record<string, number>> };
  });
}
