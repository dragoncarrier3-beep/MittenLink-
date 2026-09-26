import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { UserFacingError } from "@/lib/server/action";

/*
 * Merging duplicate organization records. Always an explicit administrator
 * decision (never automatic). Runs in one service transaction:
 *
 *   1. Snapshot the merged record (listing, organization, locations, contacts,
 *      taxonomy, service areas) into listing_merges for the record.
 *   2. Move everything that hangs off the merged organization to the survivor:
 *      locations, services, programs, events, resources, contacts (skipping exact
 *      duplicates), media, categories / populations / disability categories /
 *      languages (deduplicated), service areas (deduplicated), saved resources,
 *      family reports, provider claims, provider members (access is preserved),
 *      pending change requests, outreach contacts, open community corrections,
 *      Source Watch duplicate links, and open verification tasks.
 *      Open tasks that existed only to decide the duplicate ("manual" reason)
 *      are completed with a "merged" resolution. Completed tasks and
 *      verification history stay with the archived record as its history.
 *   3. Fill empty survivor contact fields (website, email, phone,
 *      accessibility) from the merged record; survivor values always win.
 *   4. Archive the merged listing (publication + verification "archived"),
 *      close other open suggestions that involve it, refresh search documents,
 *      and write verification history + an audit entry ("resource.merged").
 *
 * Billing is never touched here: subscriptions are written only by billing code.
 */

export interface MergeInput {
  survivorId: string;
  mergedId: string;
  actorId: string;
  suggestionId?: string | null;
}

export interface MergeResult {
  survivorTitle: string;
  mergedTitle: string;
  moved: Record<string, number>;
}

async function count(sql: SqlClient, text: string, params: unknown[]) {
  const rows = await sql.query<{ n: number }>(`with moved as (${text} returning 1) select count(*)::int as n from moved`, params);
  return rows[0]?.n ?? 0;
}

export async function mergeOrganizations(sql: SqlClient, input: MergeInput): Promise<MergeResult> {
  const { survivorId: A, mergedId: B, actorId } = input;
  if (A === B) throw new UserFacingError("Choose two different records to merge.");

  const records = await sql.query<{ id: string; kind: string; title: string; publication_status: string; verification_status: string }>(
    "select id, kind, title, publication_status, verification_status from listings where id = any($1) order by id for update",
    [[A, B]],
  );
  const survivor = records.find((r) => r.id === A);
  const merged = records.find((r) => r.id === B);
  if (!survivor || !merged) throw new UserFacingError("One of these records no longer exists.");
  if (survivor.kind !== "organization" || merged.kind !== "organization") throw new UserFacingError("Only provider (organization) records can be merged here.");
  if (survivor.publication_status === "archived" || merged.publication_status === "archived") {
    throw new UserFacingError("One of these records is already archived, so it cannot be merged.");
  }

  // 1. Snapshot
  const [snap] = await sql.query<{ snapshot: unknown }>(
    `select jsonb_build_object(
       'listing', (select to_jsonb(l) - 'search_vector' - 'search_text' from listings l where l.id = $1),
       'organization', (select to_jsonb(o) from organizations o where o.id = $1),
       'locations', coalesce((select jsonb_agg(to_jsonb(ol) - 'geog') from organization_locations ol where ol.organization_id = $1), '[]'::jsonb),
       'contacts', coalesce((select jsonb_agg(to_jsonb(oc)) from organization_contacts oc where oc.organization_id = $1), '[]'::jsonb),
       'services', coalesce((select jsonb_agg(s.id) from services s where s.organization_id = $1), '[]'::jsonb),
       'categories', coalesce((select jsonb_agg(category_id) from listing_categories where listing_id = $1), '[]'::jsonb),
       'populations', coalesce((select jsonb_agg(population_id) from listing_populations where listing_id = $1), '[]'::jsonb),
       'languages', coalesce((select jsonb_agg(language_code) from listing_languages where listing_id = $1), '[]'::jsonb),
       'service_areas', coalesce((select jsonb_agg(to_jsonb(sa) - 'center') from service_areas sa where sa.listing_id = $1), '[]'::jsonb)
     ) as snapshot`,
    [B],
  );

  const moved: Record<string, number> = {};

  // 2. Move related records
  const survivorHasPrimary = (await sql.query("select 1 from organization_locations where organization_id = $1 and is_primary limit 1", [A])).length > 0;
  moved.locations = await count(
    sql,
    "update organization_locations set organization_id = $1, is_primary = case when $3 then false else is_primary end where organization_id = $2",
    [A, B, survivorHasPrimary],
  );
  moved.services = await count(sql, "update services set organization_id = $1 where organization_id = $2", [A, B]);
  moved.programs = await count(sql, "update programs set organization_id = $1 where organization_id = $2", [A, B]);
  moved.events = await count(sql, "update events set organization_id = $1 where organization_id = $2", [A, B]);
  moved.resources = await count(sql, "update resources set organization_id = $1 where organization_id = $2", [A, B]);

  // Contacts: skip exact duplicates (same kind + normalized value) already on the survivor.
  await sql.query(
    `delete from organization_contacts b where b.organization_id = $2 and exists (
       select 1 from organization_contacts a where a.organization_id = $1 and a.kind = b.kind and (
         lower(btrim(a.value)) = lower(btrim(b.value))
         or (a.kind in ('phone', 'fax') and regexp_replace(a.value, '[^0-9]', '', 'g') = regexp_replace(b.value, '[^0-9]', '', 'g'))
         or (a.kind = 'website' and regexp_replace(lower(a.value), '^[a-z]+://(www\\.)?|/+$', '', 'g') = regexp_replace(lower(b.value), '^[a-z]+://(www\\.)?|/+$', '', 'g'))))`,
    [A, B],
  );
  moved.contacts = await count(sql, "update organization_contacts set organization_id = $1 where organization_id = $2", [A, B]);
  moved.media = await count(sql, "update organization_media set organization_id = $1 where organization_id = $2", [A, B]);

  moved.categories = await count(sql, "insert into listing_categories (listing_id, category_id, is_primary) select $1, category_id, false from listing_categories where listing_id = $2 on conflict do nothing", [A, B]);
  moved.populations = await count(sql, "insert into listing_populations (listing_id, population_id) select $1, population_id from listing_populations where listing_id = $2 on conflict do nothing", [A, B]);
  moved.disability_categories = await count(
    sql,
    "insert into listing_disability_categories (listing_id, disability_category_id) select $1, disability_category_id from listing_disability_categories where listing_id = $2 on conflict do nothing",
    [A, B],
  );
  moved.languages = await count(sql, "insert into listing_languages (listing_id, language_code) select $1, language_code from listing_languages where listing_id = $2 on conflict do nothing", [A, B]);
  moved.service_areas = await count(
    sql,
    `insert into service_areas (listing_id, scope, county_id, center, radius_miles)
     select $1, b.scope, b.county_id, b.center, b.radius_miles from service_areas b
     where b.listing_id = $2 and not exists (
       select 1 from service_areas a where a.listing_id = $1 and a.scope = b.scope
         and (b.scope = 'statewide' or (b.scope = 'county' and a.county_id = b.county_id)
              or (b.scope = 'radius' and a.radius_miles = b.radius_miles and extensions.st_dwithin(a.center, b.center, 100))))`,
    [A, B],
  );

  moved.saved_resources = await count(sql, "insert into saved_resources (user_id, listing_id, created_at) select user_id, $1, created_at from saved_resources where listing_id = $2 on conflict do nothing", [A, B]);
  await sql.query("delete from saved_resources where listing_id = $1", [B]);

  moved.family_reports = await count(sql, "update family_experience_reports set organization_id = $1 where organization_id = $2", [A, B]);
  moved.claims = await count(sql, "update provider_claims set organization_id = $1 where organization_id = $2", [A, B]);
  moved.provider_members = await count(
    sql,
    `insert into provider_members (organization_id, user_id, member_role, status, granted_via_claim_id, granted_by)
     select $1, user_id, member_role, 'active', granted_via_claim_id, $3 from provider_members where organization_id = $2 and status = 'active'
     on conflict (organization_id, user_id) do update set status = 'active'`,
    [A, B, actorId],
  );
  await sql.query("update provider_members set status = 'revoked' where organization_id = $1", [B]);
  moved.change_requests = await count(
    sql,
    `update provider_change_requests set organization_id = $1,
       listing_id = case when listing_id = $2 then $1 else listing_id end,
       target_id = case when target_type = 'organization' and target_id = $2 then $1 else target_id end
     where organization_id = $2 and status in ('pending_review', 'more_info_required')`,
    [A, B],
  );
  moved.outreach_contacts = await count(sql, "update outreach_contacts set organization_id = $1 where organization_id = $2", [A, B]);
  moved.corrections = await count(sql, "update community_corrections set listing_id = $1 where listing_id = $2 and status in ('new', 'in_review')", [A, B]);
  await sql.query("update source_watch_candidates set duplicate_listing_id = $1 where duplicate_listing_id = $2", [A, B]);

  const resolution = `Resolved by merging into ${survivor.title}.`;
  await sql.query(
    `update verification_tasks set status = 'completed', completed_at = now(), resolution = $2
     where listing_id = $1 and reason = 'manual' and status in ('open', 'in_progress', 'escalated')`,
    [B, resolution],
  );
  moved.verification_tasks = await count(sql, "update verification_tasks set listing_id = $1 where listing_id = $2 and status in ('open', 'in_progress', 'escalated')", [A, B]);

  // 3. Fill empty survivor fields (survivor values always win).
  await sql.query(
    `update organizations a set
       website = coalesce(nullif(a.website, ''), b.website),
       public_email = coalesce(nullif(a.public_email, ''), b.public_email),
       public_phone = coalesce(nullif(a.public_phone, ''), b.public_phone),
       accessibility_info = coalesce(nullif(a.accessibility_info, ''), nullif(b.accessibility_info, '')),
       claimed_at = coalesce(a.claimed_at, b.claimed_at)
     from organizations b where a.id = $1 and b.id = $2`,
    [A, B],
  );

  // 4. Archive the merged listing and record the decision.
  await sql.query("update listings set publication_status = 'archived', verification_status = 'archived' where id = $1", [B]);
  await sql.query(
    `insert into verification_history (listing_id, previous_status, new_status, action, verifier_id, internal_notes)
     values ($1, $2, 'archived', 'status_change', $3, $4)`,
    [B, merged.verification_status, actorId, `Merged into ${survivor.title} (${A}).`],
  );
  if (input.suggestionId) {
    await sql.query("update duplicate_suggestions set status = 'merged', resolved_by = $2, resolved_at = now() where id = $1", [input.suggestionId, actorId]);
  }
  // Other open suggestions that involve the archived record no longer apply.
  await sql.query(
    `update duplicate_suggestions set status = 'ignored', resolved_by = $2, resolved_at = now()
     where status = 'open' and (listing_a = $1 or listing_b = $1) and ($3::uuid is null or id <> $3::uuid)`,
    [B, actorId, input.suggestionId ?? null],
  );
  await sql.query(
    "insert into listing_merges (surviving_listing_id, merged_listing_id, merged_snapshot, merged_by) values ($1, $2, $3, $4)",
    [A, B, JSON.stringify(snap?.snapshot ?? {}), actorId],
  );

  // Refresh search documents for both records and the survivor's services.
  await sql.query("select app.refresh_listing_search($1)", [A]);
  await sql.query("select app.refresh_listing_search($1)", [B]);
  await sql.query("select app.refresh_listing_search(s.id) from services s where s.organization_id = $1", [A]);

  await audit(sql, {
    actorId,
    action: "resource.merged",
    entityType: "listing",
    entityId: A,
    entityLabel: `${merged.title} → ${survivor.title}`,
    previous: { merged_listing: { id: B, title: merged.title, publication_status: merged.publication_status, verification_status: merged.verification_status } },
    next: { surviving_listing: { id: A, title: survivor.title }, merged_listing_status: "archived" },
    metadata: { moved, suggestion_id: input.suggestionId ?? null },
  });

  return { survivorTitle: survivor.title, mergedTitle: merged.title, moved };
}
