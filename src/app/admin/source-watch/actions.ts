"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService, type SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { UserFacingError, parseForm, runAction, zCheckbox, zOptionalText, zOptionalUrl, zText, type ActionState } from "@/lib/server/action";
import { domainOf, findDuplicateMatches, generateSuggestions, UNAVAILABLE_MESSAGE, type DiscoverySuggestions } from "@/lib/integrations/discovery";

const ADMIN = ["admin", "super_admin"] as const;
const uuid = z.string().uuid("Something went wrong identifying this record. Please reload the page.");
const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || Number.isInteger(v), "Choose an option from the list.");
const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Choose an option from the list.");

function revalidateSourceWatch(candidateId?: string) {
  revalidatePath("/admin/source-watch");
  if (candidateId) revalidatePath(`/admin/source-watch/candidates/${candidateId}`);
  revalidatePath("/admin", "layout");
}

// ------------------------------------------------------------------ watched sources

const SourceSchema = z.object({
  id: optionalUuid,
  name: zText("Source name", 200),
  url: z.string().trim().min(1, "Web address is required.").refine((v) => /^https?:\/\/[^\s]+\.[^\s]+/.test(v), "Enter a full web address starting with https://"),
  source_type: z.enum(["government_page", "nonprofit_directory", "provider_website", "community_organization", "public_program_directory"], { error: "Choose a source type." }),
  coverage: zText("Geographic coverage", 200),
  county_id: optionalInt,
  is_statewide: zCheckbox(),
  check_frequency_days: z.coerce.number({ error: "Enter a number of days." }).int("Enter a whole number of days.").min(1, "Enter at least 1 day.").max(365, "Enter 365 days or fewer."),
  status: z.enum(["active", "paused", "needs_attention"], { error: "Choose a status." }),
  automated_checks_authorized: z.enum(["yes", "no"], { error: "Choose whether automated checks are authorized." }),
  notes: zOptionalText(2000),
});

export async function saveSourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(SourceSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const authorized = d.automated_checks_authorized === "yes";
    const id = await asService(async (sql) => {
      if (d.id) {
        const [prev] = await sql.query<Record<string, unknown>>("select * from public.source_watch_sources where id = $1", [d.id]);
        if (!prev) throw new UserFacingError("This source no longer exists.");
        await sql.query(
          `update public.source_watch_sources set name = $2, url = $3, source_type = $4, coverage = $5, county_id = $6, is_statewide = $7,
             check_frequency_days = $8, status = $9, automated_checks_authorized = $10, notes = $11 where id = $1`,
          [d.id, d.name, d.url, d.source_type, d.coverage, d.county_id, d.is_statewide, d.check_frequency_days, d.status, authorized, d.notes],
        );
        await audit(sql, {
          actorId: user.id, action: "source_watch.source_updated", entityType: "source_watch_source", entityId: d.id, entityLabel: d.name,
          previous: { status: prev.status, url: prev.url, automated_checks_authorized: prev.automated_checks_authorized },
          next: { status: d.status, url: d.url, automated_checks_authorized: authorized },
        });
        return d.id;
      }
      const [row] = await sql.query<{ id: string }>(
        `insert into public.source_watch_sources (name, url, source_type, coverage, county_id, is_statewide, check_frequency_days, status, automated_checks_authorized, notes, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
        [d.name, d.url, d.source_type, d.coverage, d.county_id, d.is_statewide, d.check_frequency_days, d.status, authorized, d.notes, user.id],
      );
      await audit(sql, { actorId: user.id, action: "source_watch.source_added", entityType: "source_watch_source", entityId: row.id, entityLabel: d.name, next: { url: d.url, status: d.status } });
      return row.id;
    }, user.id);
    revalidateSourceWatch();
    revalidatePath(`/admin/source-watch/sources/${id}`);
    return { status: "success", message: d.id ? "Source updated." : "Source added to Source Watch.", redirectTo: "/admin/source-watch?tab=sources" };
  });
}

export async function markSourceCheckedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const name = await asService(async (sql) => {
      const [row] = await sql.query<{ name: string }>("update public.source_watch_sources set last_checked_at = now() where id = $1 returning name", [id]);
      if (!row) throw new UserFacingError("This source no longer exists.");
      await audit(sql, { actorId: user.id, action: "source_watch.source_checked", entityType: "source_watch_source", entityId: id, entityLabel: row.name });
      return row.name;
    }, user.id);
    revalidateSourceWatch();
    return { status: "success", message: `${name} marked as checked today.` };
  });
}

export async function setSourceStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const status = z.enum(["active", "paused"]).parse(formData.get("status"));
    const name = await asService(async (sql) => {
      const [prev] = await sql.query<{ status: string; name: string }>("select status, name from public.source_watch_sources where id = $1", [id]);
      if (!prev) throw new UserFacingError("This source no longer exists.");
      await sql.query("update public.source_watch_sources set status = $2 where id = $1", [id, status]);
      await audit(sql, { actorId: user.id, action: status === "paused" ? "source_watch.source_paused" : "source_watch.source_resumed", entityType: "source_watch_source", entityId: id, entityLabel: prev.name, previous: { status: prev.status }, next: { status } });
      return prev.name;
    }, user.id);
    revalidateSourceWatch();
    return { status: "success", message: status === "paused" ? `${name} paused.` : `${name} resumed.` };
  });
}

// ------------------------------------------------------------------ candidates

const ManualCandidateSchema = z.object({
  source_id: optionalUuid,
  name: zText("Resource name", 200),
  url: zOptionalUrl(),
  excerpt: zOptionalText(4000),
  suggested_category_id: optionalInt,
  possible_city: zOptionalText(120),
  possible_county_id: optionalInt,
});

export async function addCandidateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(ManualCandidateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const id = await asService(async (sql) => {
      let sourceDomain: string | null = null;
      if (d.source_id) {
        const [s] = await sql.query<{ url: string }>("select url from public.source_watch_sources where id = $1", [d.source_id]);
        if (!s) throw new UserFacingError("The selected source no longer exists.", { source_id: "Choose a different source." });
        sourceDomain = domainOf(s.url);
      }
      // Duplicate confidence comes from SQL similarity against existing listings (no model involved).
      const phone = d.excerpt?.match(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/)?.[0] ?? null;
      const matches = await findDuplicateMatches(sql, { name: d.name, url: d.url, phone, ignoreDomain: sourceDomain });
      const top = matches[0];
      const [row] = await sql.query<{ id: string }>(
        `insert into public.source_watch_candidates (source_id, name, url, excerpt, suggested_category_id, possible_city, possible_county_id,
           duplicate_confidence, duplicate_listing_id, status, suggestions)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
        [
          d.source_id, d.name, d.url, d.excerpt, d.suggested_category_id, d.possible_city, d.possible_county_id,
          top?.confidence ?? 0, top && top.confidence >= 50 ? top.listing_id : null,
          "new", JSON.stringify({ duplicates: matches.map((m) => ({ listing_id: m.listing_id, confidence: m.confidence })) }),
        ],
      );
      await audit(sql, { actorId: user.id, action: "source_watch.candidate_added", entityType: "source_watch_candidate", entityId: row.id, entityLabel: d.name, metadata: { manual: true, source_id: d.source_id } });
      return row.id;
    }, user.id);
    revalidateSourceWatch(id);
    redirect(`/admin/source-watch/candidates/${id}?added=1`);
  });
}

const STATUS_MESSAGES: Record<string, string> = {
  reviewing: "Review started. The candidate is now marked Reviewing.",
  possible_duplicate: "Marked as a possible duplicate.",
  approved_for_import: "Approved for import. You can now import it as a draft record.",
  rejected: "Candidate rejected. It will not be imported.",
};

export async function setCandidateStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const status = z.enum(["reviewing", "possible_duplicate", "approved_for_import", "rejected"]).parse(formData.get("status"));
    await asService(async (sql) => {
      const [prev] = await sql.query<{ status: string; name: string }>("select status, name from public.source_watch_candidates where id = $1 for update", [id]);
      if (!prev) throw new UserFacingError("This candidate no longer exists.");
      if (prev.status === "imported") throw new UserFacingError("This candidate was already imported, so its status can no longer change.");
      await sql.query("update public.source_watch_candidates set status = $2, reviewed_by = $3, reviewed_at = now() where id = $1", [id, status, user.id]);
      await audit(sql, { actorId: user.id, action: `source_watch.${status}`, entityType: "source_watch_candidate", entityId: id, entityLabel: prev.name, previous: { status: prev.status }, next: { status } });
    }, user.id);
    revalidateSourceWatch(id);
    return { status: "success", message: STATUS_MESSAGES[status] };
  });
}

const ReviewFieldsSchema = z.object({
  id: uuid,
  suggested_category_id: optionalInt,
  possible_city: zOptionalText(120),
  possible_county_id: optionalInt,
});

export async function updateCandidateFieldsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(ReviewFieldsSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [prev] = await sql.query<{ name: string; status: string; suggested_category_id: number | null; possible_city: string | null; possible_county_id: number | null }>(
        "select name, status, suggested_category_id, possible_city, possible_county_id from public.source_watch_candidates where id = $1",
        [d.id],
      );
      if (!prev) throw new UserFacingError("This candidate no longer exists.");
      if (prev.status === "imported") throw new UserFacingError("This candidate was already imported. Edit the draft record instead.");
      await sql.query("update public.source_watch_candidates set suggested_category_id = $2, possible_city = $3, possible_county_id = $4 where id = $1", [d.id, d.suggested_category_id, d.possible_city, d.possible_county_id]);
      await audit(sql, {
        actorId: user.id, action: "source_watch.candidate_updated", entityType: "source_watch_candidate", entityId: d.id, entityLabel: prev.name,
        previous: { suggested_category_id: prev.suggested_category_id, possible_city: prev.possible_city, possible_county_id: prev.possible_county_id },
        next: { suggested_category_id: d.suggested_category_id, possible_city: d.possible_city, possible_county_id: d.possible_county_id },
      });
    }, user.id);
    revalidateSourceWatch(d.id);
    return { status: "success", message: "Review details saved." };
  });
}

export async function generateSuggestionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const outcome = await asService(async (sql) => {
      const [c] = await sql.query<{ name: string; url: string | null; excerpt: string | null; possible_city: string | null; county: string | null; source_name: string | null; source_url: string | null; status: string; duplicate_listing_id: string | null; imported_listing_id: string | null }>(
        `select c.name, c.url, c.excerpt, c.possible_city, co.name as county, s.name as source_name, s.url as source_url, c.status,
                c.duplicate_listing_id, c.imported_listing_id
         from public.source_watch_candidates c left join public.counties co on co.id = c.possible_county_id
         left join public.source_watch_sources s on s.id = c.source_id where c.id = $1`,
        [id],
      );
      if (!c) throw new UserFacingError("This candidate no longer exists.");
      const result = await generateSuggestions(
        sql,
        { name: c.name, url: c.url, excerpt: c.excerpt, possibleCity: c.possible_city, possibleCounty: c.county, sourceName: c.source_name },
        { ignoreDomain: domainOf(c.source_url), excludeListingId: c.imported_listing_id },
      );
      if (!result.ok) return null;
      const top = result.suggestions.duplicates[0];
      // Suggestions never change the review status or an admin's chosen duplicate link.
      await sql.query(
        `update public.source_watch_candidates set suggestions = $2, suggestion_engine = $3, duplicate_confidence = $4,
           duplicate_listing_id = coalesce(duplicate_listing_id, $5) where id = $1`,
        [id, JSON.stringify(result.suggestions), result.engine, top?.confidence ?? 0, top && top.confidence >= 50 ? top.listing_id : null],
      );
      await audit(sql, { actorId: user.id, action: "source_watch.suggestions_generated", entityType: "source_watch_candidate", entityId: id, entityLabel: c.name, metadata: { engine: result.engine, fell_back: result.fellBack } });
      return result;
    }, user.id);
    if (!outcome) return { status: "error", message: UNAVAILABLE_MESSAGE };
    revalidateSourceWatch(id);
    return {
      status: "success",
      message: outcome.kind === "ai" ? "AI suggestions generated. Please review them before making any decision." : "Automated (rules-based) suggestions generated. Please review them before making any decision.",
      warning: outcome.fellBack ? "The AI assistant was unavailable, so rules-based suggestions were used instead." : undefined,
    };
  });
}

export async function acceptSuggestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const id = uuid.parse(formData.get("id"));
    const field = z.enum(["category", "city", "county", "duplicate"]).parse(formData.get("field"));
    const message = await asService(async (sql) => {
      const [c] = await sql.query<{ name: string; status: string; suggestions: Partial<DiscoverySuggestions> | null }>(
        "select name, status, suggestions from public.source_watch_candidates where id = $1",
        [id],
      );
      if (!c) throw new UserFacingError("This candidate no longer exists.");
      if (c.status === "imported") throw new UserFacingError("This candidate was already imported.");
      const s = c.suggestions ?? {};
      let msg: string;
      let next: Record<string, unknown>;
      if (field === "category") {
        const [cat] = await sql.query<{ id: number; name: string }>("select id, name from public.categories where slug = $1", [s.category?.slug ?? ""]);
        if (!cat) throw new UserFacingError("There is no category suggestion to accept.");
        await sql.query("update public.source_watch_candidates set suggested_category_id = $2 where id = $1", [id, cat.id]);
        next = { suggested_category_id: cat.id };
        msg = `Category set to ${cat.name}.`;
      } else if (field === "city") {
        const city = s.organization?.city;
        if (!city) throw new UserFacingError("There is no city suggestion to accept.");
        await sql.query("update public.source_watch_candidates set possible_city = $2 where id = $1", [id, city]);
        next = { possible_city: city };
        msg = `Possible city set to ${city}.`;
      } else if (field === "county") {
        const [county] = await sql.query<{ id: number; name: string }>("select id, name from public.counties where lower(name) = lower($1)", [s.organization?.county ?? ""]);
        if (!county) throw new UserFacingError("There is no county suggestion to accept.");
        await sql.query("update public.source_watch_candidates set possible_county_id = $2 where id = $1", [id, county.id]);
        next = { possible_county_id: county.id };
        msg = `Possible county set to ${county.name} County.`;
      } else {
        const listingId = z.string().uuid().parse(formData.get("listingId"));
        const match = s.duplicates?.find((d) => d.listing_id === listingId);
        if (!match) throw new UserFacingError("That duplicate suggestion is no longer available.");
        await sql.query("update public.source_watch_candidates set duplicate_listing_id = $2, duplicate_confidence = $3 where id = $1", [id, listingId, match.confidence]);
        next = { duplicate_listing_id: listingId };
        msg = "Linked as the likely existing listing. Mark the candidate as a possible duplicate or reject it if they are the same.";
      }
      await audit(sql, { actorId: user.id, action: "source_watch.suggestion_accepted", entityType: "source_watch_candidate", entityId: id, entityLabel: c.name, next, metadata: { field } });
      return msg;
    }, user.id);
    revalidateSourceWatch(id);
    return { status: "success", message };
  });
}

async function uniqueSlug(sql: SqlClient, kind: string, title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "resource";
  const rows = await sql.query<{ slug: string }>("select slug from public.listings where kind = $1 and (slug = $2 or slug like $3)", [kind, base, `${base}-%`]);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

const ImportSchema = z.object({
  id: uuid,
  kind: z.enum(["organization", "program"], { error: "Choose a record type." }),
  title: zText("Record name", 200),
  category_id: optionalInt,
  county_id: optionalInt,
});

export async function importCandidateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(ImportSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const result = await asService(async (sql) => {
      const [c] = await sql.query<{ name: string; url: string | null; excerpt: string | null; status: string; possible_city: string | null; suggestions: Partial<DiscoverySuggestions> | null; source_name: string | null }>(
        `select c.name, c.url, c.excerpt, c.status, c.possible_city, c.suggestions, s.name as source_name
         from public.source_watch_candidates c left join public.source_watch_sources s on s.id = c.source_id where c.id = $1 for update of c`,
        [d.id],
      );
      if (!c) throw new UserFacingError("This candidate no longer exists.");
      if (c.status === "imported") throw new UserFacingError("This candidate has already been imported.");
      if (c.status !== "approved_for_import") throw new UserFacingError("Approve this candidate for import before importing it.");

      const s = c.suggestions ?? {};
      const summary = (s.summary ?? c.excerpt ?? "").slice(0, 300);
      const description = [c.excerpt, `Discovered through MittenLink Source Watch${c.source_name ? ` (${c.source_name})` : ""}. Awaiting verification.`].filter(Boolean).join("\n\n");
      const slug = await uniqueSlug(sql, d.kind, d.title);
      // Draft/pending record only — never public until a human verifies it.
      const [listing] = await sql.query<{ id: string }>(
        `insert into public.listings (kind, slug, title, summary, description, publication_status, verification_status, primary_city, primary_county_id, is_demo, created_by)
         values ($1, $2, $3, $4, $5, 'pending', 'pending_review', $6, $7, true, $8) returning id`,
        [d.kind, slug, d.title, summary, description, c.possible_city, d.county_id, user.id],
      );
      const phone = s.organization?.phone ?? null;
      const email = s.organization?.email ?? null;
      if (d.kind === "organization") {
        await sql.query("insert into public.organizations (id, website, public_phone, public_email) values ($1, $2, $3, $4)", [listing.id, c.url, phone, email]);
        const contacts: [string, string | null][] = [["website", c.url], ["phone", phone], ["email", email]];
        for (const [kind, value] of contacts) {
          if (!value) continue;
          await sql.query(
            `insert into public.organization_contacts (organization_id, kind, value, is_public, source_type, source_url, confidence, status)
             values ($1, $2, $3, false, 'source_watch', $4, 'low', 'unverified')`,
            [listing.id, kind, value, c.url],
          );
        }
      } else {
        await sql.query("insert into public.programs (id, website, contact_phone, contact_email) values ($1, $2, $3, $4)", [listing.id, c.url, phone, email]);
      }
      if (d.county_id) await sql.query("insert into public.service_areas (listing_id, scope, county_id) values ($1, 'county', $2)", [listing.id, d.county_id]);
      if (d.category_id) await sql.query("insert into public.listing_categories (listing_id, category_id, is_primary) values ($1, $2, true)", [listing.id, d.category_id]);
      if (s.populations?.length) {
        await sql.query(
          "insert into public.listing_populations (listing_id, population_id) select $1, id from public.populations where slug = any($2) on conflict do nothing",
          [listing.id, s.populations],
        );
      }
      await sql.query(
        `insert into public.verification_tasks (listing_id, reason, priority, status, details) values ($1, 'source_watch', 'normal', 'open', $2)`,
        [listing.id, `Imported from Source Watch candidate "${c.name}". Confirm details with the organization or an official source before publishing.`],
      );
      await sql.query("update public.source_watch_candidates set status = 'imported', imported_listing_id = $2, reviewed_by = $3, reviewed_at = now() where id = $1", [d.id, listing.id, user.id]);
      await audit(sql, {
        actorId: user.id, action: "source_watch.imported", entityType: "source_watch_candidate", entityId: d.id, entityLabel: c.name,
        previous: { status: c.status }, next: { status: "imported", imported_listing_id: listing.id, kind: d.kind, publication_status: "pending" },
      });
      return { listingId: listing.id };
    }, user.id);
    revalidateSourceWatch(d.id);
    revalidatePath("/admin/verification");
    revalidatePath("/admin/submissions");
    return { status: "success", message: "Imported as a pending draft record and added to the verification queue. It will not be public until a verifier reviews it.", data: result };
  });
}

// ------------------------------------------------------------------ research tasks

const TaskSchema = z.object({
  title: zText("Task title", 200),
  details: zOptionalText(2000),
  county_id: optionalInt,
  category_id: optionalInt,
  assigned_to: optionalUuid,
  gap_flag_id: optionalUuid,
});

export async function createResearchTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(TaskSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [row] = await sql.query<{ id: string }>(
        `insert into public.source_watch_tasks (title, details, county_id, category_id, assigned_to, gap_flag_id, status, created_by)
         values ($1, $2, $3, $4, $5, $6, 'open', $7) returning id`,
        [d.title, d.details, d.county_id, d.category_id, d.assigned_to, d.gap_flag_id, user.id],
      );
      await audit(sql, { actorId: user.id, action: "source_watch.task_created", entityType: "source_watch_task", entityId: row.id, entityLabel: d.title, next: { assigned_to: d.assigned_to } });
    }, user.id);
    revalidateSourceWatch();
    return { status: "success", message: "Research task created." };
  });
}

const TaskUpdateSchema = z.object({
  id: uuid,
  status: z.enum(["open", "in_progress", "done", "cancelled"], { error: "Choose a status." }),
  assigned_to: optionalUuid,
});

export async function updateResearchTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole(...ADMIN);
    const parsed = parseForm(TaskUpdateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    await asService(async (sql) => {
      const [prev] = await sql.query<{ title: string; status: string; assigned_to: string | null }>("select title, status, assigned_to from public.source_watch_tasks where id = $1", [d.id]);
      if (!prev) throw new UserFacingError("This task no longer exists.");
      await sql.query("update public.source_watch_tasks set status = $2, assigned_to = $3 where id = $1", [d.id, d.status, d.assigned_to]);
      await audit(sql, { actorId: user.id, action: "source_watch.task_updated", entityType: "source_watch_task", entityId: d.id, entityLabel: prev.title, previous: { status: prev.status, assigned_to: prev.assigned_to }, next: { status: d.status, assigned_to: d.assigned_to } });
    }, user.id);
    revalidateSourceWatch();
    revalidatePath("/admin/search-analytics");
    return { status: "success", message: "Task updated." };
  });
}
