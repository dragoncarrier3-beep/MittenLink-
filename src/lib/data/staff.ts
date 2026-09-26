import "server-only";
import { revalidatePath } from "next/cache";
import { asService, type SqlClient } from "@/lib/db";

/*
 * Read models for the Resource Verifier workspace and admin review queues.
 * Every function here uses asService (bypasses RLS) and must only be called
 * from pages/actions that already passed a staff or admin guard.
 */

export const PAGE_SIZE = 20;

/** Refresh staff workspaces (and their navigation counts) after a mutation. */
export function revalidateStaffViews(...extra: string[]) {
  revalidatePath("/verify", "layout");
  revalidatePath("/admin", "layout");
  for (const p of extra) revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Verification tasks
// ---------------------------------------------------------------------------

export interface TaskRow {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_kind: string;
  listing_slug: string;
  verification_status: string;
  last_verified_at: Date | null;
  county: string | null;
  reason: string;
  priority: string;
  status: string;
  due_at: Date | string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: Date;
  details: string | null;
  change_request_id: string | null;
  correction_id: string | null;
  completed_at: Date | null;
  resolution: string | null;
  completed_by_name: string | null;
  total: number;
}

const TASK_SELECT = `
  select vt.id, vt.listing_id, l.title as listing_title, l.kind as listing_kind, l.slug as listing_slug,
    l.verification_status, l.last_verified_at, c.name as county, vt.reason, vt.priority, vt.status, vt.due_at,
    vt.assigned_to, ap.full_name as assignee_name, vt.created_at, vt.details, vt.change_request_id, vt.correction_id,
    vt.completed_at, vt.resolution,
    (select p.full_name from public.verification_history vh join public.profiles p on p.id = vh.verifier_id
      where vh.task_id = vt.id order by vh.created_at desc limit 1) as completed_by_name,
    (count(*) over ())::int as total
  from public.verification_tasks vt
  join public.listings l on l.id = vt.listing_id
  left join public.counties c on c.id = l.primary_county_id
  left join public.profiles ap on ap.id = vt.assigned_to`;

export const PRIORITY_RANK_SQL = `case vt.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`;

export interface TaskFilter {
  statuses: string[];
  /** A user id, "unassigned", or undefined for anyone. */
  assignee?: string;
  reasons?: string[];
  priorities?: string[];
  /** Tasks whose latest history entry was written by this user (completed view). */
  completedBy?: string;
  order?: "priority" | "escalated_first" | "completed";
  limit?: number;
  offset?: number;
}

export async function listTasks(f: TaskFilter): Promise<TaskRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  add("vt.status = any(?)", f.statuses);
  if (f.assignee === "unassigned") where.push("vt.assigned_to is null");
  else if (f.assignee) add("vt.assigned_to = ?", f.assignee);
  if (f.reasons?.length) add("vt.reason = any(?)", f.reasons);
  if (f.priorities?.length) add("vt.priority = any(?)", f.priorities);
  if (f.completedBy) {
    params.push(f.completedBy);
    const n = `$${params.length}`;
    where.push(
      `(exists (select 1 from public.verification_history vh where vh.task_id = vt.id and vh.verifier_id = ${n})
        or (vt.assigned_to = ${n} and not exists (select 1 from public.verification_history vh2 where vh2.task_id = vt.id)))`,
    );
  }
  const order =
    f.order === "completed"
      ? "vt.completed_at desc nulls last, vt.updated_at desc"
      : f.order === "escalated_first"
        ? `(vt.status = 'escalated') desc, ${PRIORITY_RANK_SQL}, vt.due_at asc nulls last, vt.created_at`
        : `${PRIORITY_RANK_SQL}, vt.due_at asc nulls last, vt.created_at`;
  params.push(f.limit ?? 100, f.offset ?? 0);
  return asService((sql) =>
    sql.query<TaskRow>(`${TASK_SELECT} where ${where.join(" and ")} order by ${order} limit $${params.length - 1} offset $${params.length}`, params),
  );
}

export const QUEUE_FILTERS: Record<string, { label: string; reasons?: string[]; priorities?: string[] }> = {
  all: { label: "All" },
  new: { label: "New", reasons: ["new_submission"] },
  due: { label: "Due for Review", reasons: ["due_for_review"] },
  provider: { label: "Provider Update", reasons: ["provider_update"] },
  correction: { label: "Community Correction", reasons: ["community_correction"] },
  source: { label: "Source Watch", reasons: ["source_watch"] },
  high: { label: "High Priority", priorities: ["high", "urgent"] },
};

/** Counts for each queue filter over a set of tasks (mine or unassigned). */
export async function queueFilterCounts(scope: { assignee: string | "unassigned" }) {
  const cond = scope.assignee === "unassigned" ? "assigned_to is null" : "assigned_to = $1";
  const params = scope.assignee === "unassigned" ? [] : [scope.assignee];
  const [row] = await asService((sql) =>
    sql.query<Record<string, number>>(
      `select count(*)::int as "all",
         count(*) filter (where reason = 'new_submission')::int as "new",
         count(*) filter (where reason = 'due_for_review')::int as "due",
         count(*) filter (where reason = 'provider_update')::int as "provider",
         count(*) filter (where reason = 'community_correction')::int as "correction",
         count(*) filter (where reason = 'source_watch')::int as "source",
         count(*) filter (where priority in ('high', 'urgent'))::int as "high"
       from public.verification_tasks where status in ('open', 'in_progress') and ${cond}`,
      params,
    ),
  );
  return row ?? {};
}

export interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

/** Active verifiers and administrators (for assignment dropdowns). */
export async function listStaffUsers(): Promise<StaffUser[]> {
  return asService((sql) =>
    sql.query<StaffUser>(
      `select p.id, p.full_name, p.email, array_agg(ur.role_key order by ur.role_key) as roles
       from public.profiles p join public.user_roles ur on ur.user_id = p.id
       where p.is_active and ur.role_key in ('verifier', 'admin', 'super_admin')
       group by p.id order by p.full_name`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Task detail
// ---------------------------------------------------------------------------

export interface TaskDetail {
  task: {
    id: string; listing_id: string; reason: string; priority: string; status: string; assigned_to: string | null; assignee_name: string | null;
    change_request_id: string | null; correction_id: string | null; details: string | null; resolution: string | null; due_at: Date | string | null;
    created_at: Date; completed_at: Date | null;
  };
  listing: {
    id: string; kind: string; slug: string; title: string; summary: string; description: string; publication_status: string; verification_status: string;
    last_verified_at: Date | null; next_review_at: Date | string | null; virtual_available: boolean; primary_city: string | null; county: string | null;
    created_at: Date; created_by_name: string | null; created_by_email: string | null;
  };
  typed: Record<string, unknown> | null;
  organization: {
    id: string; title: string; slug: string; org_type: string; website: string | null; public_email: string | null; public_phone: string | null;
    accessibility_info: string | null; claimed_at: Date | null; listing_tier: string; verification_status: string;
  } | null;
  locations: {
    id: string; name: string; street: string; street2: string | null; city: string; zip: string; county: string | null; phone: string | null; email: string | null;
    status: string; is_primary: boolean; wheelchair_accessible: boolean | null; appointment_required: boolean; hours: { day: string; open: string; close: string }[];
  }[];
  categories: string[];
  populations: string[];
  languages: string[];
  serviceAreas: string[];
  contacts: {
    id: string; kind: string; label: string | null; value: string; is_public: boolean; source_type: string; source_url: string | null; discovered_at: Date;
    last_verified_at: Date | null; verified_by_name: string | null; confidence: string; status: string; location_name: string | null;
  }[];
  changeRequest: {
    id: string; target_type: string; target_id: string | null; action: string; summary: string; proposed: Record<string, unknown>; current_snapshot: Record<string, unknown>;
    sources: { label?: string; url?: string | null }[]; status: string; submitted_by_name: string | null; submitted_by_email: string | null; created_at: Date;
    review_message: string | null; target_label: string | null;
  } | null;
  correction: {
    id: string; issue_type: string; details: string; status: string; created_at: Date; submitter_name: string | null; submitter_email: string | null;
  } | null;
  history: {
    id: string; action: string; previous_status: string | null; new_status: string; method: string | null; verifier_name: string | null; public_summary: string | null;
    internal_notes: string | null; created_at: Date; sources: { source_type: string; url: string | null; description: string | null }[];
  }[];
  managers: { user_id: string; full_name: string; email: string; member_role: string; job_title: string | null }[];
  openTasksForListing: number;
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  return asService(async (sql) => {
    const [task] = await sql.query<TaskDetail["task"]>(
      `select vt.id, vt.listing_id, vt.reason, vt.priority, vt.status, vt.assigned_to, p.full_name as assignee_name, vt.change_request_id, vt.correction_id,
         vt.details, vt.resolution, vt.due_at, vt.created_at, vt.completed_at
       from public.verification_tasks vt left join public.profiles p on p.id = vt.assigned_to where vt.id = $1`,
      [taskId],
    );
    if (!task) return null;
    const [listing] = await sql.query<TaskDetail["listing"]>(
      `select l.id, l.kind, l.slug, l.title, l.summary, l.description, l.publication_status, l.verification_status, l.last_verified_at, l.next_review_at,
         l.virtual_available, l.primary_city, c.name as county, l.created_at, cp.full_name as created_by_name, cp.email as created_by_email
       from public.listings l left join public.counties c on c.id = l.primary_county_id left join public.profiles cp on cp.id = l.created_by
       where l.id = $1`,
      [task.listing_id],
    );
    if (!listing) return null;
    const typed = await typedFields(sql, listing.kind, listing.id);
    const [orgRow] = await sql.query<{ org_id: string | null }>("select app.listing_organization($1) as org_id", [listing.id]);
    const orgId = orgRow?.org_id ?? null;
    const organization = orgId
      ? (
          await sql.query<NonNullable<TaskDetail["organization"]>>(
            `select l.id, l.title, l.slug, o.org_type, o.website, o.public_email, o.public_phone, o.accessibility_info, o.claimed_at, o.listing_tier, l.verification_status
             from public.organizations o join public.listings l on l.id = o.id where o.id = $1`,
            [orgId],
          )
        )[0] ?? null
      : null;

    const locations = orgId
      ? listing.kind === "service"
        ? await sql.query<TaskDetail["locations"][number]>(
            `select ol.id, ol.name, ol.street, ol.street2, ol.city, ol.zip, c.name as county, ol.phone, ol.email, ol.status, ol.is_primary, ol.wheelchair_accessible,
               ol.appointment_required, ol.hours
             from public.service_locations sl join public.organization_locations ol on ol.id = sl.location_id left join public.counties c on c.id = ol.county_id
             where sl.service_id = $1 order by ol.is_primary desc, ol.sort_order, ol.name`,
            [listing.id],
          )
        : listing.kind === "organization"
          ? await sql.query<TaskDetail["locations"][number]>(
              `select ol.id, ol.name, ol.street, ol.street2, ol.city, ol.zip, c.name as county, ol.phone, ol.email, ol.status, ol.is_primary, ol.wheelchair_accessible,
                 ol.appointment_required, ol.hours
               from public.organization_locations ol left join public.counties c on c.id = ol.county_id
               where ol.organization_id = $1 order by ol.is_primary desc, ol.sort_order, ol.name`,
              [orgId],
            )
          : []
      : [];

    const names = async (q: string) => (await sql.query<{ name: string }>(q, [listing.id])).map((r) => r.name);
    const categories = await names("select c.name from public.listing_categories lc join public.categories c on c.id = lc.category_id where lc.listing_id = $1 order by lc.is_primary desc, c.name");
    const populations = await names("select p.name from public.listing_populations lp join public.populations p on p.id = lp.population_id where lp.listing_id = $1 order by p.sort_order, p.name");
    const languages = await names("select la.name from public.listing_languages ll join public.languages la on la.code = ll.language_code where ll.listing_id = $1 order by la.sort_order, la.name");
    const serviceAreas = await names(
      `select case sa.scope when 'statewide' then 'Statewide' when 'county' then c.name || ' County' else 'Within ' || sa.radius_miles::text || ' miles' end as name
       from public.service_areas sa left join public.counties c on c.id = sa.county_id where sa.listing_id = $1 order by sa.scope desc, c.name`,
    );

    const contacts = orgId
      ? await sql.query<TaskDetail["contacts"][number]>(
          `select oc.id, oc.kind, oc.label, oc.value, oc.is_public, oc.source_type, oc.source_url, oc.discovered_at, oc.last_verified_at,
             p.full_name as verified_by_name, oc.confidence, oc.status, ol.name as location_name
           from public.organization_contacts oc left join public.profiles p on p.id = oc.verified_by
           left join public.organization_locations ol on ol.id = oc.location_id
           where oc.organization_id = $1 order by oc.kind, ol.name nulls first, oc.created_at`,
          [orgId],
        )
      : [];

    let changeRequest: TaskDetail["changeRequest"] = null;
    if (task.change_request_id) {
      const [cr] = await sql.query<NonNullable<TaskDetail["changeRequest"]>>(
        `select cr.id, cr.target_type, cr.target_id, cr.action, cr.summary, cr.proposed, cr.current_snapshot, cr.sources, cr.status, cr.created_at, cr.review_message,
           p.full_name as submitted_by_name, p.email as submitted_by_email,
           case when cr.target_type = 'location' then (select ol.name from public.organization_locations ol where ol.id = cr.target_id)
                else (select tl.title from public.listings tl where tl.id = cr.target_id) end as target_label
         from public.provider_change_requests cr left join public.profiles p on p.id = cr.submitted_by where cr.id = $1`,
        [task.change_request_id],
      );
      changeRequest = cr ?? null;
    }

    let correction: TaskDetail["correction"] = null;
    if (task.correction_id) {
      const [cc] = await sql.query<NonNullable<TaskDetail["correction"]>>(
        `select cc.id, cc.issue_type, cc.details, cc.status, cc.created_at, p.full_name as submitter_name, coalesce(cc.submitter_email, p.email) as submitter_email
         from public.community_corrections cc left join public.profiles p on p.id = cc.submitter_user_id where cc.id = $1`,
        [task.correction_id],
      );
      correction = cc ?? null;
    }

    const history = await sql.query<TaskDetail["history"][number]>(
      `select vh.id, vh.action, vh.previous_status, vh.new_status, vh.method, p.full_name as verifier_name, vh.public_summary, vh.internal_notes, vh.created_at,
         coalesce((select json_agg(json_build_object('source_type', vs.source_type, 'url', vs.url, 'description', vs.description) order by vs.checked_at)
                   from public.verification_sources vs where vs.history_id = vh.id), '[]'::json) as sources
       from public.verification_history vh left join public.profiles p on p.id = vh.verifier_id
       where vh.listing_id = $1 order by vh.created_at desc limit 30`,
      [listing.id],
    );

    const managers = orgId
      ? await sql.query<TaskDetail["managers"][number]>(
          `select m.user_id, p.full_name, p.email, m.member_role, p.job_title from public.provider_members m join public.profiles p on p.id = m.user_id
           where m.organization_id = $1 and m.status = 'active' order by m.member_role, p.full_name`,
          [orgId],
        )
      : [];

    const [{ n }] = await sql.query<{ n: number }>(
      "select count(*)::int as n from public.verification_tasks where listing_id = $1 and status in ('open', 'in_progress', 'escalated') and id <> $2",
      [listing.id, task.id],
    );

    return { task, listing, typed, organization, locations, categories, populations, languages, serviceAreas, contacts, changeRequest, correction, history, managers, openTasksForListing: n };
  });
}

async function typedFields(sql: SqlClient, kind: string, id: string): Promise<Record<string, unknown> | null> {
  const q: Record<string, string> = {
    service: `select age_min, age_max, eligibility, is_free, referral_required, waitlist_status, in_person, home_based, contact_phone, contact_email, insurance_notes, payment_notes
              from public.services where id = $1`,
    program: `select eligibility, cost_text, is_free, application_instructions, start_date, end_date, website, contact_email, contact_phone from public.programs where id = $1`,
    resource: `select resource_type, url, source_name, source_url, reading_minutes from public.resources where id = $1`,
    event: `select organizer_name, event_type, starts_at, ends_at, venue_name, street, city, zip, is_in_person, registration_url, cost_text, is_free, accommodations, contact_email, contact_phone
            from public.events where id = $1`,
  };
  if (!q[kind]) return null;
  const [row] = await sql.query<Record<string, unknown>>(q[kind], [id]);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Registrable-ish domain from a URL ("https://www.example.org/x" -> "example.org"). */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Whether a work email's domain matches the organization's website domain. */
export function emailMatchesWebsite(email: string, website: string | null | undefined): boolean {
  const site = domainOf(website);
  const at = email.lastIndexOf("@");
  if (!site || at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`);
}
