"use server";

import { revalidatePath } from "next/cache";
import { asService, type SqlClient } from "@/lib/db";
import { AuthorizationError, asCurrentUser, assertOrganizationAccess, assertSignedIn } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/provider/active-org";
import { FIELD_LABELS, submitChangeRequest, type TargetType } from "@/lib/domain/change-requests";
import { audit } from "@/lib/server/audit";
import { runAction, UserFacingError, formValues } from "@/lib/server/action";
import type { ActionState } from "@/lib/server/action-types";
import { DAYS, multiKey } from "@/components/provider/constants";
import { detroitLocalToIso } from "./_lib/time";

const SUCCESS = "Your update was submitted for review. The public listing will change after a MittenLink verifier approves it.";
const OPEN = ["pending_review", "more_info_required"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MULTI_FIELDS = ["categories", "populations", "languages", "payment_options", "location_ids"];

// ------------------------------------------------------------------ form parsing helpers
const str = (fd: FormData, name: string): string | null => {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};
const bool = (fd: FormData, name: string) => fd.get(name) === "on" || fd.get(name) === "true";
const tri = (fd: FormData, name: string): boolean | null => {
  const v = fd.get(name);
  return v === "yes" ? true : v === "no" ? false : null;
};
const list = (fd: FormData, name: string) => [...new Set(fd.getAll(name).filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()))];

function int(fd: FormData, name: string, errors: Record<string, string>, label: string, min = 0, max = 120): number | null {
  const v = str(fd, name);
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors[name] = `${label} must be a whole number from ${min} to ${max}.`;
    return null;
  }
  return n;
}

function requireText(value: string | null, name: string, label: string, errors: Record<string, string>, min = 2) {
  if (!value) errors[name] = `${label} is required.`;
  else if (value.length < min) errors[name] = `${label} must be at least ${min} characters.`;
}

function checkEmail(value: string | null, name: string, errors: Record<string, string>) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[name] = "Enter a valid email address, like name@example.org.";
}
function checkUrl(value: string | null, name: string, errors: Record<string, string>) {
  if (value && !/^https?:\/\/[^\s]+\.[^\s]+/.test(value)) errors[name] = "Enter a full web address starting with https://";
}
function checkPhone(value: string | null, name: string, errors: Record<string, string>) {
  if (value && !/^[0-9()+\-.\s]{7,20}$/.test(value)) errors[name] = "Enter a valid phone number, like (517) 555-0100.";
}

function sourcesFrom(fd: FormData, errors: Record<string, string>) {
  const label = str(fd, "source_label");
  const url = str(fd, "source_url");
  checkUrl(url, "source_url", errors);
  if (url && !label) errors.source_label = "Add a short label for the source, like “Our Services page”.";
  return label ? [{ label: label.slice(0, 200), url: url ? url.slice(0, 500) : null }] : [];
}

/** Error state that also restores multi-value checkbox groups. */
function withMultiValues(state: ActionState, fd: FormData): ActionState {
  if (state.status !== "error") return state;
  const values = { ...(state.values ?? formValues(fd)) };
  for (const name of MULTI_FIELDS) {
    if (fd.has(name) || fd.has(`${name}__present`)) values[multiKey(name)] = JSON.stringify(list(fd, name));
  }
  return { ...state, values };
}

function fail(errors: Record<string, string>) {
  if (Object.keys(errors).length) throw new UserFacingError("Please correct the highlighted fields and try again.", errors);
}

// ------------------------------------------------------------------ shared submission
async function activeOrg() {
  const user = await assertSignedIn();
  const org = await getActiveOrganization(user);
  if (!org) throw new AuthorizationError("Choose an organization you manage before submitting updates.");
  await assertOrganizationAccess(org.id);
  return { user, org };
}

const TABLE_FOR: Record<TargetType, string> = {
  organization: "organizations",
  location: "organization_locations",
  service: "services",
  program: "programs",
  event: "events",
};

const KIND_WORD: Record<TargetType, string> = { organization: "organization profile", location: "location", service: "service", program: "program", event: "event" };

async function targetName(sql: SqlClient, type: TargetType, id: string) {
  if (type === "location") {
    const [row] = await sql.query<{ name: string }>("select name from public.organization_locations where id = $1", [id]);
    return row?.name ?? null;
  }
  const [row] = await sql.query<{ title: string }>("select title from public.listings where id = $1", [id]);
  return row?.title ?? null;
}

async function submitProviderChange(
  fd: FormData,
  type: TargetType,
  build: (errors: Record<string, string>, ctx: { tier: string }) => Record<string, unknown>,
): Promise<ActionState> {
  const { user, org } = await activeOrg();
  const rawTarget = type === "organization" ? org.id : str(fd, "targetId");
  const targetId = rawTarget && UUID.test(rawTarget) ? rawTarget : null;
  if (rawTarget && !targetId) throw new UserFacingError("This record could not be found. Please reload the page and try again.");
  const replaces = str(fd, "replaces");
  if (replaces && !UUID.test(replaces)) throw new UserFacingError("The update you are revising could not be found. Please reload the page.");
  const note = str(fd, "note");

  const errors: Record<string, string> = {};
  const [tierRow] = await asService((sql) => sql.query<{ listing_tier: string }>("select listing_tier from public.organizations where id = $1", [org.id]));
  const proposed = build(errors, { tier: tierRow?.listing_tier ?? "free" });
  const sources = sourcesFrom(fd, errors);
  if (note && note.length > 250) errors.note = "Keep the note to 250 characters or fewer.";
  fail(errors);

  await asService(async (sql) => {
    // Target must belong to the active organization (submitChangeRequest re-checks).
    if (targetId && type !== "organization") {
      const [row] = await sql.query<{ organization_id: string | null }>(`select organization_id from public.${TABLE_FOR[type]} where id = $1`, [targetId]);
      if (!row || row.organization_id !== org.id) throw new UserFacingError("This record does not belong to the organization you are managing.");
    }

    // Revising an open request replaces it (withdraws the old one in the same transaction).
    if (replaces) {
      const [old] = await sql.query<{ id: string; status: string; target_type: string; target_id: string | null }>(
        "select id, status, target_type, target_id from public.provider_change_requests where id = $1 and organization_id = $2 for update",
        [replaces, org.id],
      );
      if (!old || old.target_type !== type || (old.target_id ?? null) !== (targetId ?? null)) {
        throw new UserFacingError("The update you are revising could not be found. Please reload the page.");
      }
      if (!OPEN.includes(old.status)) throw new UserFacingError("That update has already been reviewed. Reload the page to see the current published information.");
      await sql.query("update public.provider_change_requests set status = 'withdrawn' where id = $1", [old.id]);
      await sql.query(
        "update public.verification_tasks set status = 'cancelled', resolution = 'Replaced by a revised provider update.', completed_at = now() where change_request_id = $1 and status in ('open', 'in_progress', 'escalated')",
        [old.id],
      );
    }

    // One open update per record keeps review simple for verifiers.
    if (targetId) {
      const [dupe] = await sql.query<{ id: string }>(
        "select id from public.provider_change_requests where organization_id = $1 and target_type = $2 and target_id = $3 and status in ('pending_review', 'more_info_required') limit 1",
        [org.id, type, targetId],
      );
      if (dupe) {
        throw new UserFacingError("An update to this record is already waiting for review. Reload the page to revise that pending update, or withdraw it first.");
      }
    }

    const name = targetId ? await targetName(sql, type, targetId) : String(proposed.title ?? proposed.name ?? "");
    const baseSummary = targetId ? `Updated ${KIND_WORD[type]}: ${name ?? ""}` : `New ${KIND_WORD[type]}: ${name}`;
    const summary = (note ? `${baseSummary} — ${note}` : baseSummary).slice(0, 300);
    const result = await submitChangeRequest(sql, {
      organizationId: org.id,
      targetType: type,
      targetId,
      proposed: proposed as never,
      summary,
      sources,
      submittedBy: user.id,
    });
    if (!note && targetId) {
      const fields = Object.keys(result.changes).map((k) => FIELD_LABELS[k] ?? k);
      const detailed = `${baseSummary} (${fields.slice(0, 6).join(", ")}${fields.length > 6 ? ", …" : ""})`.slice(0, 300);
      await sql.query("update public.provider_change_requests set summary = $2 where id = $1", [result.id, detailed]);
    }
  }, user.id);

  revalidatePath("/provider", "layout");
  return { status: "success", message: SUCCESS };
}

// ------------------------------------------------------------------ organization
export async function submitOrganizationChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const state = await runAction(fd, () =>
    submitProviderChange(fd, "organization", (errors, { tier }) => {
      const title = str(fd, "title");
      requireText(title, "title", "Organization name", errors);
      const website = str(fd, "website");
      const email = str(fd, "public_email");
      const phone = str(fd, "public_phone");
      checkUrl(website, "website", errors);
      checkEmail(email, "public_email", errors);
      checkPhone(phone, "public_phone", errors);
      const summary = str(fd, "summary");
      if (summary && summary.length > 300) errors.summary = "Short description must be 300 characters or fewer.";
      const orgType = str(fd, "org_type");
      const proposed: Record<string, unknown> = {
        title: title ?? undefined,
        summary,
        description: str(fd, "description"),
        website,
        public_email: email,
        public_phone: phone,
        accessibility_info: str(fd, "accessibility_info"),
        org_type: orgType ?? undefined,
        categories: list(fd, "categories"),
        populations: list(fd, "populations"),
        languages: list(fd, "languages"),
      };
      // Expanded description is an Enhanced listing feature; ignored for free listings.
      if (tier === "enhanced" && fd.has("expanded_description")) proposed.expanded_description = str(fd, "expanded_description");
      return proposed;
    }),
  );
  return withMultiValues(state, fd);
}

// ------------------------------------------------------------------ location
export async function submitLocationChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const state = await runAction(fd, () =>
    submitProviderChange(fd, "location", (errors) => {
      const name = str(fd, "name");
      const street = str(fd, "street");
      const city = str(fd, "city");
      const zip = str(fd, "zip");
      requireText(name, "name", "Location name", errors);
      requireText(street, "street", "Street address", errors, 3);
      requireText(city, "city", "City", errors);
      if (!zip) errors.zip = "ZIP code is required.";
      else if (!/^\d{5}$/.test(zip)) errors.zip = "Enter a 5-digit ZIP code.";
      const phone = str(fd, "phone");
      const email = str(fd, "email");
      checkPhone(phone, "phone", errors);
      checkEmail(email, "email", errors);

      const hours: { day: string; open: string; close: string }[] = [];
      const hourProblems: string[] = [];
      for (const d of DAYS) {
        if (bool(fd, `hours_${d.key}_closed`)) continue;
        const open = str(fd, `hours_${d.key}_open`);
        const close = str(fd, `hours_${d.key}_close`);
        if (!open && !close) {
          hourProblems.push(`${d.label}: enter opening and closing times, or check “Closed”.`);
          continue;
        }
        if (!open || !close || !/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) {
          hourProblems.push(`${d.label}: enter both an opening and a closing time.`);
          continue;
        }
        if (close <= open) {
          hourProblems.push(`${d.label}: closing time must be after opening time.`);
          continue;
        }
        hours.push({ day: d.key, open, close });
      }
      if (hourProblems.length) errors.hours = hourProblems.join(" ");
      const status = str(fd, "status");
      return {
        name: name ?? undefined,
        street: street ?? undefined,
        street2: str(fd, "street2"),
        city: city ?? undefined,
        zip: zip ?? undefined,
        phone,
        email,
        hours,
        hours_note: str(fd, "hours_note"),
        wheelchair_accessible: tri(fd, "wheelchair_accessible"),
        accessible_parking: tri(fd, "accessible_parking"),
        transit_info: str(fd, "transit_info"),
        appointment_required: bool(fd, "appointment_required"),
        virtual_services: bool(fd, "virtual_services"),
        status: status && ["open", "temporarily_closed", "closed"].includes(status) ? status : "open",
      };
    }),
  );
  return withMultiValues(state, fd);
}

// ------------------------------------------------------------------ service
export async function submitServiceChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const state = await runAction(fd, () =>
    submitProviderChange(fd, "service", (errors) => {
      const title = str(fd, "title");
      const summary = str(fd, "summary");
      requireText(title, "title", "Service name", errors);
      requireText(summary, "summary", "Short description", errors, 10);
      if (summary && summary.length > 300) errors.summary = "Short description must be 300 characters or fewer.";
      const ageMin = int(fd, "age_min", errors, "Minimum age");
      const ageMax = int(fd, "age_max", errors, "Maximum age");
      if (ageMin !== null && ageMax !== null && ageMin > ageMax) errors.age_max = "Maximum age must be the same as or higher than the minimum age.";
      const phone = str(fd, "contact_phone");
      const email = str(fd, "contact_email");
      checkPhone(phone, "contact_phone", errors);
      checkEmail(email, "contact_email", errors);
      const inPerson = bool(fd, "in_person");
      const virtual = bool(fd, "virtual_available");
      const home = bool(fd, "home_based");
      if (!inPerson && !virtual && !home) errors.in_person = "Choose at least one way this service is delivered.";
      const waitlist = str(fd, "waitlist_status");
      return {
        title: title ?? undefined,
        summary,
        description: str(fd, "description"),
        eligibility: str(fd, "eligibility"),
        age_min: ageMin,
        age_max: ageMax,
        in_person: inPerson,
        virtual_available: virtual,
        home_based: home,
        waitlist_status: waitlist && ["accepting", "short_wait", "waitlist", "not_accepting"].includes(waitlist) ? waitlist : "accepting",
        is_free: bool(fd, "is_free"),
        referral_required: bool(fd, "referral_required"),
        payment_options: list(fd, "payment_options"),
        insurance_notes: str(fd, "insurance_notes"),
        payment_notes: str(fd, "payment_notes"),
        contact_phone: phone,
        contact_email: email,
        categories: list(fd, "categories"),
        populations: list(fd, "populations"),
        languages: list(fd, "languages"),
        location_ids: list(fd, "location_ids").filter((id) => UUID.test(id)),
      };
    }),
  );
  return withMultiValues(state, fd);
}

// ------------------------------------------------------------------ program
export async function submitProgramChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const state = await runAction(fd, () =>
    submitProviderChange(fd, "program", (errors) => {
      const title = str(fd, "title");
      const summary = str(fd, "summary");
      requireText(title, "title", "Program name", errors);
      requireText(summary, "summary", "Short description", errors, 10);
      if (summary && summary.length > 300) errors.summary = "Short description must be 300 characters or fewer.";
      const start = str(fd, "start_date");
      const end = str(fd, "end_date");
      if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) errors.start_date = "Enter a valid start date.";
      if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) errors.end_date = "Enter a valid end date.";
      if (start && end && end < start) errors.end_date = "End date must be on or after the start date.";
      const website = str(fd, "website");
      const email = str(fd, "contact_email");
      const phone = str(fd, "contact_phone");
      checkUrl(website, "website", errors);
      checkEmail(email, "contact_email", errors);
      checkPhone(phone, "contact_phone", errors);
      return {
        title: title ?? undefined,
        summary,
        description: str(fd, "description"),
        eligibility: str(fd, "eligibility"),
        cost_text: str(fd, "cost_text"),
        is_free: bool(fd, "is_free"),
        application_instructions: str(fd, "application_instructions"),
        start_date: start,
        end_date: end,
        website,
        contact_email: email,
        contact_phone: phone,
        virtual_available: bool(fd, "virtual_available"),
        categories: list(fd, "categories"),
        populations: list(fd, "populations"),
      };
    }),
  );
  return withMultiValues(state, fd);
}

// ------------------------------------------------------------------ event
export async function submitEventChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const state = await runAction(fd, () =>
    submitProviderChange(fd, "event", (errors) => {
      const title = str(fd, "title");
      const summary = str(fd, "summary");
      requireText(title, "title", "Event name", errors);
      requireText(summary, "summary", "Short description", errors, 10);
      if (summary && summary.length > 300) errors.summary = "Short description must be 300 characters or fewer.";
      const startDate = str(fd, "start_date") ?? "";
      const startTime = str(fd, "start_time") ?? "";
      const endDate = str(fd, "end_date") ?? startDate;
      const endTime = str(fd, "end_time") ?? "";
      const startsAt = detroitLocalToIso(startDate, startTime);
      const endsAt = detroitLocalToIso(endDate, endTime);
      if (!startDate) errors.start_date = "Start date is required.";
      else if (!startTime) errors.start_time = "Start time is required.";
      else if (!startsAt) errors.start_date = "Enter a valid start date and time.";
      if (!endTime) errors.end_time = "End time is required.";
      else if (!endsAt) errors.end_date = "Enter a valid end date and time.";
      if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.end_time = "The event must end after it starts.";
      const zip = str(fd, "zip");
      if (zip && !/^\d{5}$/.test(zip)) errors.zip = "Enter a 5-digit ZIP code.";
      const reg = str(fd, "registration_url");
      const email = str(fd, "contact_email");
      const phone = str(fd, "contact_phone");
      checkUrl(reg, "registration_url", errors);
      checkEmail(email, "contact_email", errors);
      checkPhone(phone, "contact_phone", errors);
      const inPerson = bool(fd, "is_in_person");
      const virtual = bool(fd, "virtual_available");
      if (!inPerson && !virtual) errors.is_in_person = "Choose in person, online, or both.";
      const eventType = str(fd, "event_type");
      return {
        title: title ?? undefined,
        summary,
        description: str(fd, "description"),
        event_type: eventType ?? undefined,
        starts_at: startsAt ?? undefined,
        ends_at: endsAt ?? undefined,
        venue_name: str(fd, "venue_name"),
        street: str(fd, "street"),
        city: str(fd, "city"),
        zip,
        is_in_person: inPerson,
        virtual_available: virtual,
        registration_url: reg,
        cost_text: str(fd, "cost_text"),
        is_free: bool(fd, "is_free"),
        accommodations: str(fd, "accommodations"),
        contact_email: email,
        contact_phone: phone,
        categories: list(fd, "categories"),
        populations: list(fd, "populations"),
      };
    }),
  );
  return withMultiValues(state, fd);
}

// ------------------------------------------------------------------ withdraw
export async function withdrawChangeRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(null, async () => {
    const { user, org } = await activeOrg();
    const id = str(fd, "changeRequestId");
    if (!id || !UUID.test(id)) throw new UserFacingError("This update could not be found. Please reload the page.");

    // RLS policy "change requests provider withdraw": only the submitter, only while open.
    const updated = await asCurrentUser((sql) =>
      sql.query<{ id: string; summary: string }>(
        "update public.provider_change_requests set status = 'withdrawn' where id = $1 and organization_id = $2 returning id, summary",
        [id, org.id],
      ),
    );
    if (!updated.length) {
      throw new UserFacingError("This update can't be withdrawn. It may already have been reviewed, or it was submitted by another team member.");
    }
    await asService(async (sql) => {
      await sql.query(
        "update public.verification_tasks set status = 'cancelled', resolution = 'Withdrawn by provider.', completed_at = now() where change_request_id = $1 and status in ('open', 'in_progress', 'escalated')",
        [id],
      );
      await audit(sql, {
        actorId: user.id,
        action: "provider_update.withdrawn",
        entityType: "provider_change_request",
        entityId: id,
        entityLabel: updated[0].summary,
        next: { status: "withdrawn" },
      });
    }, user.id);
    revalidatePath("/provider", "layout");
    return { status: "success", message: "Your pending update was withdrawn. The public listing has not changed." };
  });
}
