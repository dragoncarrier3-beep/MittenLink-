import "server-only";
import type { SqlClient } from "@/lib/db";
import type { DuplicateMatch } from "./types";

/** Lowercased host without "www." (or null). */
export function domainOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export const phoneDigits = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : null;
};

/**
 * Finds existing listings that may describe the same resource, using
 * PostgreSQL trigram similarity on titles plus exact website-domain and
 * phone-digit matches. Deterministic SQL — never a language model.
 *
 * `ignoreDomain` should be the domain of the directory/source page the
 * candidate was found on (a shared directory domain is not a duplicate signal).
 */
export async function findDuplicateMatches(
  sql: SqlClient,
  input: { name: string; url: string | null; phone: string | null; ignoreDomain?: string | null; excludeListingId?: string | null },
  limit = 5,
): Promise<DuplicateMatch[]> {
  let domain = domainOf(input.url);
  if (domain && input.ignoreDomain && domain === input.ignoreDomain) domain = null;
  const digits = phoneDigits(input.phone);
  const rows = await sql.query<{
    id: string; kind: string; slug: string; title: string; publication_status: string; verification_status: string;
    city: string | null; county: string | null; website: string | null; phone: string | null; name_sim: number; same_domain: boolean; same_phone: boolean;
  }>(
    `with base as (
       select l.id, l.kind, l.slug, l.title, l.publication_status, l.verification_status, l.primary_city as city, co.name as county,
              coalesce(o.website, p.website, so.website, po.website) as website,
              coalesce(o.public_phone, s.contact_phone, p.contact_phone, so.public_phone, po.public_phone) as phone,
              extensions.similarity(lower(l.title), lower($1))::float8 as name_sim
       from public.listings l
       left join public.counties co on co.id = l.primary_county_id
       left join public.organizations o on o.id = l.id
       left join public.services s on s.id = l.id
       left join public.organizations so on so.id = s.organization_id
       left join public.programs p on p.id = l.id
       left join public.organizations po on po.id = p.organization_id
       where l.publication_status <> 'archived' and l.kind in ('organization', 'service', 'program')
         and ($4::uuid is null or l.id <> $4::uuid)
     ), scored as (
       select b.*,
              ($2::text is not null and b.website is not null
                and lower(substring(b.website from '^(?:https?://)?(?:www\\.)?([^/:?#]+)')) = $2) as same_domain,
              ($3::text is not null and b.phone is not null
                and right(regexp_replace(b.phone, '\\D', '', 'g'), 10) = $3) as same_phone
       from base b
     )
     select * from scored
     where name_sim >= 0.25 or same_domain or same_phone
     order by (name_sim * 90 + case when same_domain then 35 else 0 end + case when same_phone then 30 else 0 end) desc
     limit $5`,
    [input.name, domain, digits, input.excludeListingId ?? null, limit],
  );
  return rows.map((r) => ({
    listing_id: r.id,
    kind: r.kind,
    slug: r.slug,
    title: r.title,
    publication_status: r.publication_status,
    verification_status: r.verification_status,
    city: r.city,
    county: r.county,
    website: r.website,
    phone: r.phone,
    confidence: Math.min(99, Math.round(r.name_sim * 90 + (r.same_domain ? 35 : 0) + (r.same_phone ? 30 : 0))),
    signals: { name_similarity: Math.round(r.name_sim * 100) / 100, same_website_domain: r.same_domain, same_phone: r.same_phone },
  }));
}
