"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { UserFacingError, parseForm, runAction, zOptionalText, zText, type ActionState } from "@/lib/server/action";

const ADMIN = ["admin", "super_admin"] as const;
const uuid = z.string().uuid();
const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || uuid.safeParse(v).success, "Choose an option from the list.");

function revalidateAnalytics(flagId?: string) {
  revalidatePath("/admin/search-analytics");
  if (flagId) revalidatePath(`/admin/search-analytics/gaps/${flagId}`);
  revalidatePath("/admin/source-watch");
}

const ACRONYMS = new Set(["asl", "aba", "iep", "ssi", "ssdi", "adhd", "tbi", "aac", "ot", "pt", "cil"]);
const titleCase = (s: string) => {
  const words = s.split(" ").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const out = words.join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/** Turns an unsuccessful-search aggregate into a resource-gap indicator for staff follow-up. */
export async function flagSearchAsGapAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const title = await asService(async (sql) => {
      const [fs] = await sql.query<{ normalized_query: string; county_id: number | null; county_name: string | null; region: string | null; search_count: number; last_result_count: number; status: string }>(
        `select fs.normalized_query, fs.county_id, c.name as county_name, c.region, fs.search_count, fs.last_result_count, fs.status
         from public.failed_searches fs left join public.counties c on c.id = fs.county_id where fs.id = $1 for update of fs`,
        [id],
      );
      if (!fs) throw new UserFacingError("This search record no longer exists.");
      const q = fs.normalized_query;
      // Best-matching category for the query (trigram similarity on the category name or slug).
      const [cat] = await sql.query<{ id: number; name: string }>(
        `select id, name from public.categories
         where is_active and greatest(extensions.similarity(lower(name), $1), extensions.similarity(replace(slug, '-', ' '), $1),
               extensions.word_similarity($1, lower(name))) >= 0.35
         order by greatest(extensions.similarity(lower(name), $1), extensions.similarity(replace(slug, '-', ' '), $1), extensions.word_similarity($1, lower(name))) desc
         limit 1`,
        [q],
      );
      // Current supply: published listings serving the county (location, county service area, or primary county)
      // that match the category or contain the query text.
      const [{ n }] = await sql.query<{ n: number }>(
        `select count(distinct l.id)::int as n from public.listings l
         where l.publication_status = 'published'
           and ($1::smallint is null
                or l.primary_county_id = $1
                or exists (select 1 from public.service_areas sa where sa.listing_id = l.id and sa.scope = 'county' and sa.county_id = $1)
                or exists (select 1 from public.listing_points lp where lp.listing_id = l.id and lp.county_id = $1))
           and (($2::int is not null and exists (select 1 from public.listing_categories lc where lc.listing_id = l.id and lc.category_id = $2))
                or l.search_text like '%' || $3 || '%')`,
        [fs.county_id, cat?.id ?? null, q.toLowerCase()],
      );
      const where = fs.county_name ? `${fs.county_name} County` : "Michigan (no location given)";
      const level = fs.search_count >= 20 && fs.last_result_count === 0 ? "high" : fs.search_count >= 8 ? "medium" : "low";
      const indicator = n === 0 ? "zero_supply" : n <= 2 ? "low_supply" : "unmet_demand";
      const flagTitle =
        n === 0 ? `${titleCase(q)} — 0 resources in ${where}` : `${titleCase(q)} — ${fs.search_count} unsuccessful searches, ${n} ${n === 1 ? "resource" : "resources"} in ${where}`;
      const description = `${fs.search_count} unsuccessful ${fs.search_count === 1 ? "search" : "searches"} for "${q}" in ${where} (most recent returned ${fs.last_result_count} ${fs.last_result_count === 1 ? "result" : "results"}). MittenLink currently lists ${n} published ${n === 1 ? "record" : "records"} there matching this need.`;
      const [row] = await sql.query<{ id: string }>(
        `insert into public.resource_gap_flags (title, description, indicator_type, severity, category_id, county_id, region, search_count, resource_count, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10) returning id`,
        [flagTitle, description, indicator, level, cat?.id ?? null, fs.county_id, fs.region, fs.search_count, n, user.id],
      );
      await sql.query("update public.failed_searches set status = 'reviewed' where id = $1", [id]);
      await audit(sql, { actorId: user.id, action: "gap_flag.created", entityType: "resource_gap_flag", entityId: row.id, entityLabel: flagTitle, metadata: { failed_search_id: id, resource_count: n } });
      return flagTitle;
    }, user.id);
    revalidateAnalytics();
    return { status: "success", message: `Flagged as a resource gap: ${title}` };
  });
}

export async function dismissFailedSearchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    await asService(async (sql) => {
      const [row] = await sql.query<{ normalized_query: string }>("update public.failed_searches set status = 'dismissed' where id = $1 returning normalized_query", [id]);
      if (!row) throw new UserFacingError("This search record no longer exists.");
      await audit(sql, { actorId: user.id, action: "failed_search.dismissed", entityType: "failed_search", entityId: id, entityLabel: row.normalized_query });
    }, user.id);
    revalidateAnalytics();
    return { status: "success", message: "Search marked as not a gap." };
  });
}

const GapTaskSchema = z.object({
  flag_id: uuid,
  title: zText("Task title", 200),
  details: zOptionalText(2000),
  assigned_to: optionalUuid,
});

export async function createGapTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(GapTaskSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [flag] = await sql.query<{ title: string; status: string; county_id: number | null; category_id: number | null }>(
        "select title, status, county_id, category_id from public.resource_gap_flags where id = $1",
        [d.flag_id],
      );
      if (!flag) throw new UserFacingError("This gap indicator no longer exists.");
      const [task] = await sql.query<{ id: string }>(
        `insert into public.source_watch_tasks (title, details, county_id, category_id, gap_flag_id, assigned_to, status, created_by)
         values ($1, $2, $3, $4, $5, $6, 'open', $7) returning id`,
        [d.title, d.details, flag.county_id, flag.category_id, d.flag_id, d.assigned_to, user.id],
      );
      await sql.query("update public.resource_gap_flags set status = 'source_watch_task', assigned_to = coalesce($2, assigned_to) where id = $1", [d.flag_id, d.assigned_to]);
      await audit(sql, { actorId: user.id, action: "gap_flag.source_watch_task_created", entityType: "resource_gap_flag", entityId: d.flag_id, entityLabel: flag.title, previous: { status: flag.status }, next: { status: "source_watch_task", task_id: task.id } });
    }, user.id);
    revalidateAnalytics(d.flag_id);
    return { status: "success", message: "Source Watch research task created and linked to this indicator." };
  });
}

const AssignSchema = z.object({ flag_id: uuid, assigned_to: z.string({ error: "Choose a staff member." }).uuid("Choose a staff member.") });

export async function assignGapResearchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(AssignSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const name = await asService(async (sql) => {
      const [staff] = await sql.query<{ full_name: string }>(
        `select p.full_name from public.profiles p where p.id = $1 and p.is_active
           and exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role_key in ('verifier', 'admin', 'super_admin'))`,
        [d.assigned_to],
      );
      if (!staff) throw new UserFacingError("Choose an active staff member.", { assigned_to: "Choose an active staff member." });
      const [flag] = await sql.query<{ title: string; status: string; assigned_to: string | null }>("select title, status, assigned_to from public.resource_gap_flags where id = $1", [d.flag_id]);
      if (!flag) throw new UserFacingError("This gap indicator no longer exists.");
      await sql.query("update public.resource_gap_flags set assigned_to = $2, status = 'researching' where id = $1", [d.flag_id, d.assigned_to]);
      await audit(sql, { actorId: user.id, action: "gap_flag.assigned", entityType: "resource_gap_flag", entityId: d.flag_id, entityLabel: flag.title, previous: { status: flag.status, assigned_to: flag.assigned_to }, next: { status: "researching", assigned_to: d.assigned_to } });
      return staff.full_name;
    }, user.id);
    revalidateAnalytics(d.flag_id);
    return { status: "success", message: `Research assigned to ${name}.` };
  });
}

export async function setGapStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("flag_id"));
    const status = z.enum(["resolved", "dismissed", "open"]).parse(formData.get("status"));
    await asService(async (sql) => {
      const [flag] = await sql.query<{ title: string; status: string }>("select title, status from public.resource_gap_flags where id = $1", [id]);
      if (!flag) throw new UserFacingError("This gap indicator no longer exists.");
      await sql.query("update public.resource_gap_flags set status = $2 where id = $1", [id, status]);
      await audit(sql, { actorId: user.id, action: `gap_flag.${status === "open" ? "reopened" : status}`, entityType: "resource_gap_flag", entityId: id, entityLabel: flag.title, previous: { status: flag.status }, next: { status } });
    }, user.id);
    revalidateAnalytics(id);
    return { status: "success", message: status === "resolved" ? "Indicator marked resolved." : status === "dismissed" ? "Indicator dismissed." : "Indicator reopened." };
  });
}
