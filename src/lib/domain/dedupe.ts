import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";

/*
 * Potential duplicate detection for organizations.
 *
 * Compares every published or pending organization pairwise in SQL and
 * records a duplicate_suggestions row for pairs scoring at least
 * MIN_CONFIDENCE. Suggestions are ONLY suggestions: nothing is merged
 * automatically — an administrator reviews each one.
 *
 * Signals (all computed in SQL):
 *   - name similarity   pg_trgm similarity() of lower-cased, punctuation-free names (0–1)
 *   - website domain    host without scheme / "www." / path
 *   - phone             last 10 digits of the public phone
 *   - street address    normalized street (common suffixes abbreviated) + ZIP, any location
 *   - ZIP               any shared location ZIP
 *   - email             lower-cased public email
 *
 * Confidence (0–100) = weighted sum, capped at 99 (never "certain"):
 *   name similarity × 40   (e.g. 0.82 → 33)
 *   same website domain    18
 *   same phone             15
 *   same street address    15
 *   same email             10
 *   same ZIP only           5  (only when the street address does not match)
 * Example: "Michigan Ability Center" vs "Michigan Ability Ctr." shares domain,
 * phone, address and email with name similarity ≈ 0.82 → 33 + 58 = 91%.
 */

export const DEDUPE_WEIGHTS = { name: 40, domain: 18, phone: 15, address: 15, email: 10, zipOnly: 5 } as const;
export const MIN_CONFIDENCE = 40;

export interface DuplicateSignals {
  name_similarity: number;
  same_website_domain: boolean;
  same_phone: boolean;
  same_address: boolean;
  same_zip: boolean;
  same_email: boolean;
}

export function scoreSignals(s: DuplicateSignals): number {
  const w = DEDUPE_WEIGHTS;
  let score = s.name_similarity * w.name;
  if (s.same_website_domain) score += w.domain;
  if (s.same_phone) score += w.phone;
  if (s.same_address) score += w.address;
  else if (s.same_zip) score += w.zipOnly;
  if (s.same_email) score += w.email;
  return Math.max(0, Math.min(99, Math.round(score)));
}

/** Normalized street expression (SQL) for organization_locations alias `ol`. */
const STREET_NORM = [
  ["\\mstreet\\M", "st"],
  ["\\mroad\\M", "rd"],
  ["\\mavenue\\M", "ave"],
  ["\\mdrive\\M", "dr"],
  ["\\mboulevard\\M", "blvd"],
  ["\\mhighway\\M", "hwy"],
  ["\\msuite\\M", "ste"],
  ["\\mnorth\\M", "n"],
  ["\\msouth\\M", "s"],
  ["\\meast\\M", "e"],
  ["\\mwest\\M", "w"],
].reduce((expr, [from, to]) => `regexp_replace(${expr}, '${from}', '${to}', 'g')`, "regexp_replace(lower(ol.street), '[^a-z0-9 ]', '', 'g')");

interface PairRow extends DuplicateSignals {
  a_id: string;
  b_id: string;
  a_title: string;
  b_title: string;
}

export interface ScanResult {
  organizationsCompared: number;
  pairsEvaluated: number;
  created: number;
  skippedExisting: number;
}

/** Runs the duplicate scan inside the caller's service transaction (admin only). */
export async function runDuplicateScan(sql: SqlClient, actorId: string): Promise<ScanResult> {
  const [{ n }] = await sql.query<{ n: number }>(
    `select count(*)::int as n from listings l join organizations o on o.id = l.id
     where l.publication_status in ('published', 'pending') and l.verification_status <> 'archived'`,
  );
  const pairs = await sql.query<PairRow>(`
    with orgs as (
      select l.id, l.title,
        btrim(regexp_replace(regexp_replace(lower(l.title), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) as name_norm,
        nullif(regexp_replace(regexp_replace(lower(btrim(coalesce(o.website, ''))), '^[a-z]+://(www\\.)?', ''), '[/?#:].*$', ''), '') as domain,
        nullif(right(regexp_replace(coalesce(o.public_phone, ''), '[^0-9]', '', 'g'), 10), '') as phone,
        nullif(lower(btrim(coalesce(o.public_email, ''))), '') as email,
        (select array_agg(distinct regexp_replace(${STREET_NORM}, '\\s+', ' ', 'g') || '|' || ol.zip)
           from organization_locations ol where ol.organization_id = l.id and ol.status <> 'closed') as addresses,
        (select array_agg(distinct ol.zip) from organization_locations ol where ol.organization_id = l.id and ol.status <> 'closed') as zips
      from listings l join organizations o on o.id = l.id
      where l.publication_status in ('published', 'pending') and l.verification_status <> 'archived'
    )
    select a.id as a_id, b.id as b_id, a.title as a_title, b.title as b_title,
      round(extensions.similarity(a.name_norm, b.name_norm)::numeric, 2)::float8 as name_similarity,
      coalesce(a.domain = b.domain, false) as same_website_domain,
      coalesce(length(a.phone) >= 7 and a.phone = b.phone, false) as same_phone,
      coalesce(a.email = b.email, false) as same_email,
      coalesce(a.addresses && b.addresses, false) as same_address,
      coalesce(a.zips && b.zips, false) as same_zip
    from orgs a join orgs b on a.id < b.id
    where extensions.similarity(a.name_norm, b.name_norm) >= 0.3
       or a.domain = b.domain or a.phone = b.phone or a.email = b.email or a.addresses && b.addresses
  `);

  let created = 0;
  let skippedExisting = 0;
  for (const p of pairs) {
    const signals: DuplicateSignals = {
      name_similarity: Number(p.name_similarity),
      same_website_domain: p.same_website_domain,
      same_phone: p.same_phone,
      same_address: p.same_address,
      same_zip: p.same_zip,
      same_email: p.same_email,
    };
    const confidence = scoreSignals(signals);
    if (confidence < MIN_CONFIDENCE) continue;
    // Skip pairs already suggested or decided, in either order.
    const [existing] = await sql.query(
      "select 1 from duplicate_suggestions where (listing_a = $1 and listing_b = $2) or (listing_a = $2 and listing_b = $1) limit 1",
      [p.a_id, p.b_id],
    );
    if (existing) {
      skippedExisting++;
      continue;
    }
    await sql.query(
      "insert into duplicate_suggestions (listing_a, listing_b, confidence, signals, status) values ($1, $2, $3, $4, 'open') on conflict do nothing",
      [p.a_id, p.b_id, confidence, JSON.stringify(signals)],
    );
    created++;
  }

  await audit(sql, {
    actorId,
    action: "duplicate.scan",
    entityType: "duplicate_suggestion",
    entityLabel: `Duplicate scan: ${created} new suggestion${created === 1 ? "" : "s"}`,
    metadata: { organizations_compared: n, pairs_evaluated: pairs.length, created, skipped_existing: skippedExisting, min_confidence: MIN_CONFIDENCE },
  });
  return { organizationsCompared: n, pairsEvaluated: pairs.length, created, skippedExisting };
}
