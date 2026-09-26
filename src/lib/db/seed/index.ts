/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { DatabaseDriver, SqlClient } from "../types";
import {
  CATEGORIES, COUNTIES, DISABILITY_CATEGORIES, LANGUAGES, PAYMENT_OPTIONS, PLACES, POPULATIONS, ROLES, SETTINGS, SYNONYMS,
} from "./reference";
import { ORGANIZATIONS, type Area, type OrgSeed, type VStatus } from "./organizations";
import { EVENTS, PROGRAMS, RESOURCES } from "./content";

/**
 * Seeds a fresh database with realistic, clearly-flagged demonstration data.
 * All dates are relative to "now" so the demo always looks current.
 */

const DAY = 86_400_000;
const now = () => Date.now();
const daysAgo = (d: number) => new Date(now() - d * DAY).toISOString();
const daysFromNow = (d: number) => new Date(now() + d * DAY).toISOString();
const dateOnly = (iso: string) => iso.slice(0, 10);
const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;

// Deterministic PRNG so repeated seeds look the same.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedOptions {
  /** Creates an auth user and returns its id. Defaults to inserting into auth.users (local mode). */
  createAuthUser?: (email: string, password: string, fullName: string) => Promise<string>;
  log?: (msg: string) => void;
}

type Json = Record<string, unknown> | unknown[];

async function insert(sql: SqlClient, table: string, row: Record<string, unknown>, returning = "id"): Promise<any> {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  const params = cols.map((c) => {
    const v = row[c];
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) return JSON.stringify(v);
    return v;
  });
  const text = `insert into ${table} (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols
    .map((_, i) => `$${i + 1}`)
    .join(", ")})${returning ? ` returning ${returning}` : ""}`;
  const rows = await sql.query<any>(text, params);
  return returning ? rows[0]?.[returning.split(",")[0].trim()] : undefined;
}

const HOURS: Record<string, { day: string; open: string; close: string }[]> = {
  standard: ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, open: "09:00", close: "17:00" })),
  extended: [
    ...["mon", "tue", "wed", "thu"].map((day) => ({ day, open: "08:30", close: "19:00" })),
    { day: "fri", open: "08:30", close: "17:00" },
  ],
  limited: ["tue", "thu"].map((day) => ({ day, open: "10:00", close: "15:00" })),
  saturday: [
    ...["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, open: "09:00", close: "17:00" })),
    { day: "sat", open: "09:00", close: "13:00" },
  ],
};

export const DEMO_USERS = [
  { key: "sarah", email: "admin@mittenlink.demo", name: "Sarah Mitchell", title: "Director of Platform Operations", roles: ["super_admin", "admin"], primary: true },
  { key: "jordan", email: "verifier@mittenlink.demo", name: "Jordan Lee", title: "Resource Verifier", roles: ["verifier"], primary: true },
  { key: "emily", email: "provider@mittenlink.demo", name: "Emily Carter", title: "Communications Manager", roles: ["provider", "community_member"], primary: true },
  { key: "alex", email: "community@mittenlink.demo", name: "Alex Morgan", title: null, roles: ["community_member"], primary: true },
  { key: "marcus", email: "marcus.bell@mittenlink.demo", name: "Marcus Bell", title: "Community Resources Administrator", roles: ["admin"] },
  { key: "priya", email: "priya.shah@mittenlink.demo", name: "Priya Shah", title: "Resource Verifier", roles: ["verifier"] },
  { key: "david", email: "david.reynolds@example-demo.org", name: "David Reynolds", title: "Program Director", roles: ["community_member"] },
  { key: "rachel", email: "rachel.nguyen@example-demo.org", name: "Rachel Nguyen", title: "Executive Director", roles: ["provider", "community_member"] },
  { key: "hannah", email: "hannah.olsen@example-demo.org", name: "Hannah Olsen", title: "Operations Coordinator", roles: ["provider", "community_member"] },
  { key: "chris", email: "chris.alvarez@example-demo.org", name: "Chris Alvarez", title: "Program Manager", roles: ["provider", "community_member"] },
  { key: "dana", email: "dana.whitfield@example-demo.org", name: "Dana Whitfield", title: "Founder & Artistic Director", roles: ["provider", "community_member"] },
  { key: "tom", email: "tom.becker@example-demo.org", name: "Tom Becker", title: "Director of Services", roles: ["community_member"] },
  { key: "angela", email: "angela.brooks@example-demo.org", name: "Angela Brooks", title: "Employment Services Manager", roles: ["community_member"] },
  { key: "kevin", email: "kevin.price@example-demo.org", name: "Kevin Price", title: "Volunteer", roles: ["community_member"] },
] as const;

export async function seedDatabase(driver: DatabaseDriver, opts: SeedOptions = {}) {
  const log = opts.log ?? ((m: string) => console.log(`[seed] ${m}`));
  const password = process.env.DEMO_ACCOUNT_PASSWORD || (process.env.DEMO_MODE !== "false" ? "MittenLink-Demo-2026!" : undefined);
  if (!password) {
    throw new Error("DEMO_ACCOUNT_PASSWORD must be set to seed demo accounts (see .env.example).");
  }
  const hash = bcrypt.hashSync(password, 10);

  // Auth users are created outside the data transaction (Supabase Admin API is external).
  const userIds: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    if (opts.createAuthUser) {
      userIds[u.key] = await opts.createAuthUser(u.email, password, u.name);
    } else {
      userIds[u.key] = await driver.transaction(async (sql) => {
        const existing = await sql.query<{ id: string }>("select id from auth.users where lower(email) = lower($1)", [u.email]);
        if (existing[0]) return existing[0].id;
        return insert(sql, "auth.users", {
          email: u.email, encrypted_password: hash, raw_user_meta_data: { full_name: u.name }, email_confirmed_at: new Date().toISOString(),
        });
      });
    }
  }

  await driver.transaction(async (sql) => {
    await sql.query("select set_config('app.bulk_load', 'on', true)");
    const rand = mulberry32(20260926);
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

    // ------------------------------------------------------------ reference
    log("reference data");
    for (const [key, name, description, rank] of ROLES) await insert(sql, "public.roles", { key, name, description, rank }, "");
    const countyId: Record<string, number> = {};
    let cid = 1;
    for (const [name, fips, region, lat, lng] of COUNTIES) {
      countyId[name] = cid;
      await insert(sql, "public.counties", {
        id: cid++, name, slug: name.toLowerCase().replace(/\./g, "").replace(/\s+/g, "-"), fips: `26${fips}`, region, centroid: point(lat, lng),
      }, "");
    }
    for (const [city, county, lat, lng, zips] of PLACES) {
      await insert(sql, "public.places", { kind: "city", name: city, zip: zips[0], county_id: countyId[county], geog: point(lat, lng) }, "");
      for (const zip of zips) {
        await insert(sql, "public.places", { kind: "zip", name: city, zip, county_id: countyId[county], geog: point(lat, lng) }, "");
      }
    }
    const categoryId: Record<string, number> = {};
    let sort = 10;
    for (const [slug, name, description, icon, , featured] of CATEGORIES) {
      categoryId[slug] = await insert(sql, "public.categories", { slug, name, description, icon, sort_order: sort, is_featured: featured });
      sort += 10;
    }
    for (const [slug, , , , parent] of CATEGORIES) {
      if (parent) await sql.query("update public.categories set parent_id = $1 where slug = $2", [categoryId[parent], slug]);
    }
    const populationId: Record<string, number> = {};
    for (const [i, [slug, name]] of POPULATIONS.entries()) populationId[slug] = await insert(sql, "public.populations", { slug, name, sort_order: i });
    const disabilityId: Record<string, number> = {};
    for (const [i, [slug, name]] of DISABILITY_CATEGORIES.entries()) disabilityId[slug] = await insert(sql, "public.disability_categories", { slug, name, sort_order: i });
    for (const [i, [code, name]] of LANGUAGES.entries()) await insert(sql, "public.languages", { code, name, sort_order: i }, "");
    const paymentId: Record<string, number> = {};
    for (const [i, [slug, name, is_insurance]] of PAYMENT_OPTIONS.entries()) paymentId[slug] = await insert(sql, "public.payment_options", { slug, name, is_insurance, sort_order: i });
    for (const [term, alternatives] of SYNONYMS) await insert(sql, "public.search_synonyms", { term, alternatives }, "");
    for (const [key, value, description] of SETTINGS) await insert(sql, "public.platform_settings", { key, value: JSON.stringify(value), description }, "");

    // ------------------------------------------------------------ users
    log("demo accounts");
    const U = userIds;
    for (const u of DEMO_USERS) {
      await insert(sql, "public.profiles", { id: U[u.key], email: u.email, full_name: u.name, job_title: u.title, is_demo: true }, "");
      for (const role of u.roles) {
        await insert(sql, "public.user_roles", { user_id: U[u.key], role_key: role, granted_by: u.key === "sarah" ? null : U.sarah, granted_at: daysAgo(200) }, "");
      }
    }

    // ------------------------------------------------------------ directory
    log("organizations, locations, services");
    const listingId: Record<string, string> = {}; // key: `${kind}:${slug}`
    const orgBySlug: Record<string, OrgSeed> = {};
    const locationIds: Record<string, Record<string, string>> = {};

    const addAreas = async (lid: string, areas: Area[]) => {
      for (const a of areas) {
        if (a === "statewide") await insert(sql, "public.service_areas", { listing_id: lid, scope: "statewide" }, "");
        else if ("county" in a) await insert(sql, "public.service_areas", { listing_id: lid, scope: "county", county_id: countyId[a.county] }, "");
      }
    };
    const addTaxonomy = async (lid: string, t: { categories?: string[]; populations?: string[]; disabilities?: string[]; languages?: string[] }) => {
      for (const [i, c] of (t.categories ?? []).entries()) {
        if (!categoryId[c]) throw new Error(`Unknown category ${c}`);
        await insert(sql, "public.listing_categories", { listing_id: lid, category_id: categoryId[c], is_primary: i === 0 }, "");
      }
      for (const p of t.populations ?? []) await insert(sql, "public.listing_populations", { listing_id: lid, population_id: populationId[p] }, "");
      for (const d of t.disabilities ?? []) await insert(sql, "public.listing_disability_categories", { listing_id: lid, disability_category_id: disabilityId[d] }, "");
      for (const l of t.languages ?? []) await insert(sql, "public.listing_languages", { listing_id: lid, language_code: l }, "");
    };
    const verificationFields = (status: VStatus, verifiedDaysAgo?: number, nextReviewInDays?: number) => ({
      verification_status: status,
      last_verified_at: verifiedDaysAgo !== undefined ? daysAgo(verifiedDaysAgo) : null,
      next_review_at: nextReviewInDays !== undefined ? dateOnly(daysFromNow(nextReviewInDays)) : verifiedDaysAgo !== undefined ? dateOnly(daysFromNow(180 - verifiedDaysAgo)) : null,
    });

    for (const o of ORGANIZATIONS) {
      orgBySlug[o.slug] = o;
      const created = daysAgo(400 + Math.floor(rand() * 300));
      const lid = await insert(sql, "public.listings", {
        kind: "organization", slug: o.slug, title: o.title, summary: o.summary, description: o.description,
        publication_status: o.publication ?? "published", ...verificationFields(o.status, o.verifiedDaysAgo, o.nextReviewInDays),
        virtual_available: o.services.some((s) => s.virtual) || o.locations.length === 0, is_demo: true, created_at: created, created_by: U.marcus,
      });
      listingId[`organization:${o.slug}`] = lid;
      await insert(sql, "public.organizations", {
        id: lid, org_type: o.type, website: o.website, public_email: o.email, public_phone: o.phone, accessibility_info: o.accessibility || null,
        expanded_description: o.expanded ?? null, founded_year: o.founded ?? null, listing_tier: "free",
      }, "");
      await addTaxonomy(lid, o);
      await addAreas(lid, o.areas);

      locationIds[o.slug] = {};
      for (const [i, loc] of o.locations.entries()) {
        const locId = await insert(sql, "public.organization_locations", {
          organization_id: lid, name: loc.name, street: loc.street, city: loc.city, zip: loc.zip, county_id: countyId[loc.county],
          geog: point(loc.lat, loc.lng), phone: loc.phone ?? o.phone, email: loc.email ?? o.email, hours: JSON.stringify(HOURS[loc.hours ?? "standard"]),
          hours_note: loc.appointment ? "Appointments recommended." : null,
          wheelchair_accessible: loc.wheelchair ?? null, accessible_parking: loc.parking ?? null, transit_info: loc.transit ?? null,
          appointment_required: loc.appointment ?? false, virtual_services: loc.virtual ?? false, is_primary: loc.primary ?? i === 0, sort_order: i,
          service_area_note: loc.serviceAreaNote ?? null,
        });
        locationIds[o.slug][loc.key] = locId;
      }

      // Contact provenance
      const verifiedAt = o.verifiedDaysAgo !== undefined ? daysAgo(o.verifiedDaysAgo) : null;
      const provenance: [string, string, string, string][] = [
        ["phone", "Main phone", o.phone, "official_website"],
        ["email", "Public email", o.email, "official_website"],
        ["website", "Website", o.website, "manual_research"],
      ];
      for (const [kind, label, value, source] of provenance) {
        await insert(sql, "public.organization_contacts", {
          organization_id: lid, kind, label, value, source_type: o.status === "verified" && kind === "phone" ? "phone_confirmation" : source,
          source_url: o.website, discovered_at: daysAgo(420), last_verified_at: verifiedAt, verified_by: verifiedAt ? pick([U.jordan, U.priya]) : null,
          confidence: o.status === "verified" ? "high" : o.status === "needs_update" ? "low" : "medium",
          status: o.status === "needs_update" && kind === "phone" ? "outdated" : o.status === "verified" ? "active" : "unverified",
        }, "");
      }

      for (const s of o.services) {
        const sStatus = s.status ?? o.status;
        const sid = await insert(sql, "public.listings", {
          kind: "service", slug: s.slug, title: s.title, summary: s.summary, description: s.description,
          publication_status: o.publication ?? "published",
          ...verificationFields(sStatus, sStatus === "verified" ? o.verifiedDaysAgo : o.status === "needs_update" ? o.verifiedDaysAgo : undefined, o.nextReviewInDays),
          virtual_available: s.virtual ?? false, is_demo: true, created_at: created, created_by: U.marcus,
        });
        listingId[`service:${s.slug}`] = sid;
        await insert(sql, "public.services", {
          id: sid, organization_id: lid, age_min: s.ages?.[0] ?? null, age_max: s.ages?.[1] ?? null, eligibility: s.eligibility ?? null,
          insurance_notes: s.insuranceNotes ?? null, is_free: s.free ?? false, referral_required: s.referral ?? false,
          waitlist_status: s.waitlist ?? "accepting", in_person: s.inPerson ?? o.locations.length > 0, home_based: s.homeBased ?? false,
          contact_phone: o.phone, contact_email: o.email, is_featured: s.featured ?? false,
        }, "");
        const locKeys = s.locations ?? o.locations.map((l) => l.key);
        for (const k of locKeys) await insert(sql, "public.service_locations", { service_id: sid, location_id: locationIds[o.slug][k] }, "");
        for (const p of s.payments ?? []) await insert(sql, "public.service_payment_options", { service_id: sid, payment_option_id: paymentId[p] }, "");
        await addTaxonomy(sid, s);
        await addAreas(sid, s.areas ?? o.areas);
      }
    }

    log("programs, resources, events");
    for (const p of PROGRAMS) {
      const pid = await insert(sql, "public.listings", {
        kind: "program", slug: p.slug, title: p.title, summary: p.summary, description: p.description,
        ...verificationFields(p.status, p.verifiedDaysAgo), virtual_available: p.virtual ?? false, is_demo: true, created_at: daysAgo(120), created_by: U.marcus,
      });
      listingId[`program:${p.slug}`] = pid;
      await insert(sql, "public.programs", {
        id: pid, organization_id: p.org ? listingId[`organization:${p.org}`] : null, eligibility: p.eligibility, cost_text: p.cost, is_free: p.free,
        application_instructions: p.apply, start_date: p.startInDays !== undefined ? dateOnly(daysFromNow(p.startInDays)) : null,
        end_date: p.endInDays !== undefined ? dateOnly(daysFromNow(p.endInDays)) : null, website: p.website ?? null, contact_email: p.email ?? null, contact_phone: p.phone ?? null,
      }, "");
      await addTaxonomy(pid, p);
      await addAreas(pid, p.areas);
    }
    for (const r of RESOURCES) {
      const rid = await insert(sql, "public.listings", {
        kind: "resource", slug: r.slug, title: r.title, summary: r.summary, description: r.body.split("\n\n")[0],
        ...verificationFields(r.status, r.verifiedDaysAgo), virtual_available: true, is_demo: true, created_at: daysAgo(150), created_by: U.sarah,
      });
      listingId[`resource:${r.slug}`] = rid;
      await insert(sql, "public.resources", {
        id: rid, resource_type: r.type, url: r.url ?? null, organization_id: r.org ? listingId[`organization:${r.org}`] : null,
        source_name: r.sourceName, source_url: r.sourceUrl ?? null, body: r.body, reading_minutes: r.minutes,
      }, "");
      await addTaxonomy(rid, r);
      await addAreas(rid, r.areas);
    }
    for (const e of EVENTS) {
      const eid = await insert(sql, "public.listings", {
        kind: "event", slug: e.slug, title: e.title, summary: e.summary, description: e.description,
        ...verificationFields(e.status, e.verifiedDaysAgo, 30), virtual_available: e.virtual, is_demo: true, created_at: daysAgo(40), created_by: U.marcus,
      });
      listingId[`event:${e.slug}`] = eid;
      const start = new Date(now() + e.startInDays * DAY);
      // Anchor to a local (Michigan) wall-clock hour: America/Detroit is UTC-4 (EDT) / UTC-5 (EST).
      start.setUTCHours(e.startHour + 4, (e.startHour % 1) * 60, 0, 0);
      const end = new Date(start.getTime() + e.durationHours * 3_600_000);
      await insert(sql, "public.events", {
        id: eid, organization_id: e.org ? listingId[`organization:${e.org}`] : null, organizer_name: e.organizer, event_type: e.type,
        starts_at: start.toISOString(), ends_at: end.toISOString(), venue_name: e.venue ?? null, street: e.street ?? null, city: e.city ?? null, zip: e.zip ?? null,
        county_id: e.county ? countyId[e.county] : null, geog: e.lat && e.lng ? point(e.lat, e.lng) : null, is_in_person: e.inPerson,
        registration_url: e.registrationUrl ?? null, cost_text: e.cost, is_free: e.free, accommodations: e.accommodations, contact_email: e.email ?? null, contact_phone: e.phone ?? null,
      }, "");
      await addTaxonomy(eid, e);
      if (!e.inPerson) await addAreas(eid, ["statewide"]);
      else if (e.county) await addAreas(eid, [{ county: e.county }]);
    }

    await sql.query("select set_config('app.bulk_load', 'off', true)");
    const refreshed = await sql.query<{ n: number }>("select app.refresh_all_listings() as n");
    log(`search documents refreshed for ${refreshed[0]?.n} listings`);

    const L = (kind: string, slug: string) => {
      const id = listingId[`${kind}:${slug}`];
      if (!id) throw new Error(`Seed reference not found: ${kind}:${slug}`);
      return id;
    };
    const ORG = (slug: string) => L("organization", slug);

    // ------------------------------------------------------------ claims & members
    log("claims, members, billing");
    const claimIds: Record<string, string> = {};
    const claims: [string, string, string, string, string, string, string, number, string?][] = [
      // key, org, user, relationship, title, email, status, submittedDaysAgo, message
      ["nmfsc", "northern-michigan-family-support-collaborative", "david", "staff", "Program Director", "d.reynolds@example-demo.org", "under_review", 3],
      ["glil", "great-lakes-independent-living-network", "emily", "staff", "Communications Manager", "e.carter@greatlakesiln.example", "approved", 210],
      ["wmafc", "west-michigan-autism-family-center", "rachel", "executive", "Executive Director", "r.nguyen@wmautismfamily.example", "approved", 190],
      ["upar", "upper-peninsula-ability-resource-center", "hannah", "staff", "Operations Coordinator", "h.olsen@upability.example", "approved", 160],
      ["kara", "kalamazoo-accessible-recreation-alliance", "chris", "staff", "Program Manager", "c.alvarez@kzooaccessrec.example", "approved", 120],
      ["daac", "detroit-adaptive-arts-collective", "dana", "owner", "Founder & Artistic Director", "dana@detroitadaptivearts.example", "approved", 95],
      ["lsls", "lakeshore-supported-living-services", "tom", "executive", "Director of Services", "t.becker@lakeshoresupportedliving.example", "submitted", 1],
      ["fien", "flint-inclusive-employment-network", "angela", "staff", "Employment Services Manager", "angela.brooks@gmail-demo.example", "more_info_required", 9,
        "Thank you for your claim. Because the email address you provided is not on the organization's domain, please upload or link to a document showing your role (for example, a staff directory page or a letter on letterhead)."],
      ["mactr", "michigan-ability-ctr", "kevin", "authorized_representative", "Volunteer", "kevin.price@example-demo.org", "rejected", 30,
        "This record is a suspected duplicate of Michigan Ability Center and is being reviewed for merging. Please contact the organization's leadership to submit a claim for the primary record."],
    ];
    for (const [key, org, user, relationship, title, email, status, submitted, message] of claims) {
      const reviewed = ["approved", "rejected", "more_info_required"].includes(status);
      claimIds[key] = await insert(sql, "public.provider_claims", {
        organization_id: ORG(org), claimant_user_id: U[user], relationship, claimant_name: DEMO_USERS.find((u) => u.key === user)!.name,
        claimant_title: title, work_email: email, work_phone: orgBySlug[org].phone,
        verification_details:
          key === "nmfsc"
            ? "I have served as Program Director since 2019 and oversee our family navigation and respite programs. Our executive director, Linda Park, can confirm my role at the main office number. My name is listed on the Staff page of our website."
            : `I am the ${title} and manage our public communications. My role can be confirmed through our main office.`,
        evidence_url: key === "nmfsc" ? "https://northernfamilysupport.example/about/staff" : null,
        status, message_to_claimant: message ?? null, reviewed_by: reviewed ? U.sarah : null, reviewed_at: reviewed ? daysAgo(Math.max(0, submitted - 2)) : null,
        submitted_at: daysAgo(submitted), created_at: daysAgo(submitted + 0.1),
      });
      if (status === "approved") {
        await insert(sql, "public.provider_members", {
          organization_id: ORG(org), user_id: U[user], member_role: relationship === "owner" || relationship === "executive" ? "owner" : "manager",
          granted_via_claim_id: claimIds[key], granted_by: U.sarah, created_at: daysAgo(submitted - 2),
        }, "");
        await sql.query("update public.organizations set claimed_at = $1 where id = $2", [daysAgo(submitted - 2), ORG(org)]);
      }
    }
    // Draft claim by the community demo account (not visible to admins until submitted)
    await insert(sql, "public.provider_claims", {
      organization_id: ORG("thumb-area-independent-living-center"), claimant_user_id: U.alex, relationship: "staff", claimant_name: "Alex Morgan",
      claimant_title: "Volunteer Coordinator", work_email: "alex.morgan@thumbindependence.example", verification_details: "Draft — not yet submitted.", status: "draft", created_at: daysAgo(2),
    }, "");

    const plan = { price: 2900 };
    const subs: [string, string, string, number][] = [
      ["great-lakes-independent-living-network", "active", "emily", 150],
      ["west-michigan-autism-family-center", "active", "rachel", 120],
      ["kalamazoo-accessible-recreation-alliance", "trialing", "chris", 4],
      ["detroit-adaptive-arts-collective", "past_due", "dana", 64],
      ["macomb-family-autism-partners", "cancelled", "sarah", 240],
    ];
    for (const [org, status, user, startedDaysAgo] of subs) {
      const subId = await insert(sql, "public.subscriptions", {
        organization_id: ORG(org), plan: "enhanced", status, billing_provider: "demo", provider_customer_id: `demo_cus_${org.slice(0, 12)}`,
        provider_subscription_id: `demo_sub_${randomUUID().slice(0, 8)}`, price_cents: plan.price,
        current_period_end: status === "cancelled" ? daysAgo(30) : status === "trialing" ? daysFromNow(10) : status === "past_due" ? daysAgo(3) : daysFromNow(18),
        cancel_at_period_end: false, livemode: false, created_by: U[user], created_at: daysAgo(startedDaysAgo),
      });
      const events: [string, string, number][] =
        status === "active" ? [["checkout.completed", "Demo checkout completed — no payment processed.", startedDaysAgo], ["invoice.paid", "Demo renewal recorded — no payment processed.", 12]]
          : status === "trialing" ? [["trial.started", "14-day demo trial started.", startedDaysAgo]]
            : status === "past_due" ? [["checkout.completed", "Demo checkout completed — no payment processed.", startedDaysAgo], ["invoice.payment_failed", "Demo renewal marked past due (simulated).", 3]]
              : [["checkout.completed", "Demo checkout completed — no payment processed.", startedDaysAgo], ["subscription.cancelled", "Subscription cancelled by provider.", 30]];
      for (const [event_type, summary, d] of events) {
        await insert(sql, "public.billing_events", { subscription_id: subId, organization_id: ORG(org), billing_provider: "demo", event_type, summary, livemode: false, created_at: daysAgo(d) }, "");
      }
      if (status !== "cancelled") await sql.query("update public.organizations set listing_tier = 'enhanced' where id = $1", [ORG(org)]);
    }

    // ------------------------------------------------------------ verification history
    log("verification history, tasks, change requests");
    const methods = ["phone_confirmation", "official_website", "provider_confirmation", "email_confirmation"] as const;
    const publicSummaries: Record<string, string> = {
      phone_confirmation: "Contact information and hours confirmed with the organization by phone.",
      official_website: "Information reviewed against the organization's official website.",
      provider_confirmation: "Information confirmed by an authorized representative of the organization.",
      email_confirmation: "Information confirmed with the organization by email.",
      government_source: "Information checked against a public government source.",
      manual_research: "Information reviewed by MittenLink staff using public sources.",
    };
    const allListings = await sql.query<{ id: string; kind: string; slug: string; title: string; verification_status: string; last_verified_at: Date | null }>(
      "select id, kind, slug, title, verification_status, last_verified_at from public.listings",
    );
    for (const l of allListings) {
      const verifier = pick([U.jordan, U.priya]);
      if (l.verification_status === "verified" && l.last_verified_at) {
        const at = new Date(l.last_verified_at).toISOString();
        const older = new Date(new Date(at).getTime() - 185 * DAY).toISOString();
        if (l.kind === "organization") {
          await insert(sql, "public.verification_history", {
            listing_id: l.id, previous_status: "unverified", new_status: "verified", action: "verified", method: "official_website", verifier_id: U.priya,
            public_summary: publicSummaries.official_website, internal_notes: "Initial listing review.", created_at: older,
          }, "");
        }
        const method = l.kind === "resource" ? "manual_research" : pick(methods);
        const hid = await insert(sql, "public.verification_history", {
          listing_id: l.id, previous_status: "verified", new_status: "verified", action: "verified", method, verifier_id: verifier,
          public_summary: publicSummaries[method],
          internal_notes: l.kind === "organization" ? `Confirmed address, phone, and hours. Spoke with front desk staff. No changes needed.` : "Reviewed with organization record.",
          created_at: at,
        });
        if (l.kind === "organization") {
          await insert(sql, "public.verification_sources", { history_id: hid, source_type: method === "phone_confirmation" ? "phone_confirmation" : "official_website", description: method === "phone_confirmation" ? "Called main line" : "Reviewed Contact and Services pages", url: null, checked_at: at }, "");
          await insert(sql, "public.verification_sources", { history_id: hid, source_type: "official_website", description: "Official website", url: orgBySlug[l.slug]?.website ?? null, checked_at: at }, "");
        }
      } else if (l.verification_status === "needs_update") {
        await insert(sql, "public.verification_history", {
          listing_id: l.id, previous_status: "verified", new_status: "needs_update", action: "update_requested", method: "phone_confirmation", verifier_id: U.jordan,
          public_summary: "Some information may be out of date. MittenLink has asked the organization to confirm current details.",
          internal_notes: "Main phone number disconnected (two attempts). Website not updated since last year. Emailed public address; no reply yet.",
          created_at: daysAgo(12),
        }, "");
      } else if (l.verification_status === "pending_review") {
        await insert(sql, "public.verification_history", {
          listing_id: l.id, previous_status: null, new_status: "pending_review", action: "status_change", verifier_id: null,
          public_summary: "This record was recently submitted and is waiting for MittenLink review.", internal_notes: "Created from submission.", created_at: daysAgo(6),
        }, "");
      }
    }

    // Community corrections
    const corrFlint = await insert(sql, "public.community_corrections", {
      listing_id: ORG("flint-inclusive-employment-network"), issue_type: "phone", details: "I called the main number twice this week and got a message that it is disconnected. Their Facebook page lists a new number.",
      submitter_user_id: U.alex, status: "in_review", created_at: daysAgo(6),
    });
    const corrWheel = await insert(sql, "public.community_corrections", {
      listing_id: L("service", "mcac-wheelchair-repair-clinic"), issue_type: "hours", details: "The repair clinic is now held on the second Saturday of each month, not weekdays.",
      submitter_email: null, status: "new", created_at: daysAgo(2),
    });
    await insert(sql, "public.community_corrections", {
      listing_id: ORG("lakeshore-supported-living-services"), issue_type: "website", details: "Website link does not load.", status: "new", created_at: daysAgo(4),
    }, "");

    // Change requests
    const upBenefits = L("service", "upar-benefits-counseling");
    const crUp = await insert(sql, "public.provider_change_requests", {
      organization_id: ORG("upper-peninsula-ability-resource-center"), listing_id: upBenefits, target_type: "service", target_id: upBenefits, action: "update",
      summary: "Updated phone line and added Saturday phone appointments for Benefits Counseling",
      proposed: { summary: "Help understanding SSI, SSDI, Medicaid, and Medicare, and how work affects benefits. Saturday morning phone appointments now available.", contact_phone: "(906) 555-0140" },
      current_snapshot: { summary: "Help understanding SSI, SSDI, Medicaid, and Medicare, and how work affects benefits.", contact_phone: "(906) 555-0133" },
      sources: [{ label: "Updated Benefits Counseling page", url: "https://upability.example/benefits" }],
      status: "pending_review", submitted_by: U.hannah, created_at: daysAgo(2),
    });
    const glilLoc = locationIds["great-lakes-independent-living-network"]["lan"];
    await insert(sql, "public.provider_change_requests", {
      organization_id: ORG("great-lakes-independent-living-network"), listing_id: ORG("great-lakes-independent-living-network"), target_type: "location", target_id: glilLoc,
      action: "update", summary: "Lansing Office now requires appointments",
      proposed: { appointment_required: true }, current_snapshot: { appointment_required: false }, sources: [], status: "approved", submitted_by: U.emily,
      reviewer_id: U.jordan, review_message: "Thanks — confirmed with your Lansing office and published.", reviewed_at: daysAgo(19), created_at: daysAgo(21),
    }, "");
    const wmOrg = ORG("west-michigan-autism-family-center");
    await insert(sql, "public.provider_change_requests", {
      organization_id: wmOrg, listing_id: wmOrg, target_type: "organization", target_id: wmOrg, action: "update",
      summary: "Updated accessibility information",
      proposed: { accessibility_info: "Sensory-friendly waiting rooms, quiet spaces, visual schedules, and noise-reducing headphones available to borrow. Step-free entrances at both locations." },
      current_snapshot: { accessibility_info: orgBySlug["west-michigan-autism-family-center"].accessibility },
      sources: [], status: "more_info_required", submitted_by: U.rachel, reviewer_id: U.jordan,
      review_message: "Could you confirm whether noise-reducing headphones are available at both the Grand Rapids and Holland locations?", reviewed_at: daysAgo(3), created_at: daysAgo(5),
    }, "");

    // Verification tasks
    const tasks: { listing: string; reason: string; priority: string; status?: string; assignee?: string | null; cr?: string; corr?: string; details?: string; created: number; due?: number }[] = [
      { listing: ORG("west-michigan-autism-family-center"), reason: "due_for_review", priority: "high", assignee: "jordan", details: "Six-month review due. Enhanced listing — confirm expanded description and featured services.", created: 4, due: 2 },
      { listing: ORG("northern-michigan-family-support-collaborative"), reason: "new_submission", priority: "normal", assignee: "jordan", details: "New organization submission. A claim from the Program Director is also under review.", created: 6, due: 8 },
      { listing: ORG("flint-inclusive-employment-network"), reason: "community_correction", priority: "high", assignee: "jordan", corr: corrFlint, details: "Community member reports main phone number disconnected.", created: 6, due: 1 },
      { listing: upBenefits, reason: "provider_update", priority: "normal", assignee: "jordan", cr: crUp, details: "Provider submitted updated phone number and Saturday availability.", created: 2, due: 5 },
      { listing: ORG("lakeshore-supported-living-services"), reason: "due_for_review", priority: "normal", assignee: "priya", details: "Record has never been verified. Website reported not loading.", created: 10, due: 4 },
      { listing: ORG("michigan-ability-ctr"), reason: "manual", priority: "low", status: "escalated", assignee: null, details: "Likely duplicate of Michigan Ability Center (91% match). Escalated to admin for merge decision.", created: 15 },
      { listing: ORG("saginaw-valley-deaf-hard-of-hearing-services"), reason: "due_for_review", priority: "normal", assignee: "jordan", details: "Scheduled six-month review.", created: 3, due: 9 },
      { listing: ORG("great-lakes-independent-living-network"), reason: "due_for_review", priority: "normal", assignee: "jordan", details: "Scheduled review for multi-location organization (4 locations).", created: 1, due: 12 },
      { listing: L("event", "metro-detroit-disability-resource-fair"), reason: "new_submission", priority: "normal", assignee: null, details: "New event submitted by Motor City Ability Center.", created: 2, due: 5 },
      { listing: L("program", "mdbc-statewide-respite-voucher-pilot"), reason: "source_watch", priority: "high", assignee: "priya", details: "Discovered through Source Watch; addresses documented respite gap in Northern Michigan.", created: 8, due: 3 },
      { listing: L("service", "mcac-wheelchair-repair-clinic"), reason: "community_correction", priority: "normal", assignee: "jordan", corr: corrWheel, details: "Community member reports new clinic schedule.", created: 2, due: 7 },
      { listing: ORG("macomb-family-autism-partners"), reason: "due_for_review", priority: "low", assignee: null, details: "Enhanced subscription cancelled; confirm listing content reverted to free tier.", created: 12, due: 30 },
      { listing: L("resource", "transition-to-adulthood-checklist"), reason: "new_submission", priority: "low", assignee: "priya", details: "New guide drafted by MittenLink staff. Needs editorial and accessibility review.", created: 5, due: 14 },
    ];
    const taskIds: string[] = [];
    for (const t of tasks) {
      taskIds.push(await insert(sql, "public.verification_tasks", {
        listing_id: t.listing, reason: t.reason, priority: t.priority, status: t.status ?? "open", assigned_to: t.assignee ? U[t.assignee] : null,
        change_request_id: t.cr ?? null, correction_id: t.corr ?? null, details: t.details, due_at: t.due !== undefined ? dateOnly(daysFromNow(t.due)) : null, created_at: daysAgo(t.created),
      }));
    }
    // A completed task for history
    await insert(sql, "public.verification_tasks", {
      listing_id: ORG("great-lakes-independent-living-network"), reason: "provider_update", priority: "normal", status: "completed", assigned_to: U.jordan,
      details: "Lansing office appointment requirement.", resolution: "Approved and published.", created_at: daysAgo(21), completed_at: daysAgo(19),
    }, "");
    await insert(sql, "public.verification_history", {
      listing_id: ORG("great-lakes-independent-living-network"), previous_status: "verified", new_status: "verified", action: "change_approved", method: "provider_confirmation",
      verifier_id: U.jordan, public_summary: "An update from the organization was reviewed and published.", internal_notes: "Called Lansing office to confirm appointment policy.", created_at: daysAgo(19),
    }, "");

    // ------------------------------------------------------------ family experience reports
    log("family reports, source watch, outreach");
    const reports: [string, string | null, string, string, string, string, string | null, string, boolean, string, number, string?][] = [
      ["great-lakes-independent-living-network", "glil-peer-mentoring", "Peer mentoring", "very_positive", "excellent", "excellent", "The office was easy to get into with my wheelchair and staff made sure the meeting room was set up before I arrived.",
        "Our peer mentor helped my brother learn the bus routes to his new job. She was patient, honest about her own experience, and checked in every week. We felt respected the whole time.", true, "approved", 40],
      ["great-lakes-independent-living-network", "glil-assistive-technology", "Assistive technology lending", "positive", "good", "good", null,
        "Being able to borrow a device for a month before buying it saved us a lot of money. There was a short wait for an appointment, but the specialist was very knowledgeable.", true, "approved", 25],
      ["motor-city-ability-center", "mcac-transportation-navigation", "Transportation navigation", "mixed", "good", "fair", null,
        "The navigator was very helpful once we connected, but it took about three weeks and several calls to get the first appointment.", true, "approved", 18],
      ["west-michigan-autism-family-center", "wmafc-autism-family-support", "Family navigation", "very_positive", "excellent", "excellent", "The quiet waiting room made a big difference for our daughter.",
        "Our family navigator explained everything in plain language and helped us understand what to ask the school. We left every meeting with clear next steps.", true, "approved", 33],
      ["west-michigan-autism-family-center", "wmafc-pediatric-occupational-therapy", "Occupational therapy", "positive", "good", "excellent", null,
        "Therapists are warm and creative. The waitlist was long (about four months) but they called us regularly with updates.", true, "submitted", 1],
      ["kalamazoo-accessible-recreation-alliance", "kara-adaptive-sports", "Adaptive sports", "very_positive", "excellent", "good", "Equipment was ready and adjusted before the session.",
        "My son joined the wheelchair basketball league and has made real friends. Coaches are encouraging and the scholarship process was simple.", true, "under_review", 3],
      ["flint-inclusive-employment-network", null, "Supported employment", "negative", "fair", "poor", null,
        "Hard to reach anyone this year. We were promised a call back that never came.", false, "needs_clarification", 8,
        "Thank you for sharing. Could you tell us approximately which month you tried to contact them? This helps our verification team."],
      ["eastside-wellness-disability-counseling", "ewdc-counseling", "Counseling", "positive", "excellent", "good", null,
        "[Removed by moderator — contained another person's name and private health details.]", true, "rejected", 20,
        "Your report included private health information about another person, so it could not be published. You are welcome to submit a new report without those details."],
    ];
    for (const [i, [org, service, type, cat, access, comm, accessNotes, comments, publish, status, d, msg]] of reports.entries()) {
      const approved = status === "approved";
      await insert(sql, "public.family_experience_reports", {
        organization_id: ORG(org), service_id: service ? L("service", service) : null, submitted_by: i === 5 ? U.alex : i === 2 ? U.alex : null,
        approx_service_month: dateOnly(daysAgo(d + 30)).slice(0, 8) + "01", service_type: type, experience_category: cat, accessibility_rating: access,
        accessibility_notes: accessNotes, communication_rating: comm, comments, publish_anonymously: publish, status,
        moderator_id: ["approved", "rejected", "needs_clarification"].includes(status) ? U.marcus : null, moderation_message: msg ?? null,
        moderated_at: ["approved", "rejected", "needs_clarification"].includes(status) ? daysAgo(Math.max(0, d - 1)) : null,
        published_at: approved ? daysAgo(Math.max(0, d - 1)) : null, created_at: daysAgo(d),
      }, "");
    }

    // ------------------------------------------------------------ source watch
    const sources: [string, string, string, string, string | null, boolean, number, string, boolean, string][] = [
      ["Michigan Statewide Nonprofit Directory (demo feed)", "https://nonprofit-directory.example/michigan", "nonprofit_directory", "Statewide", null, true, 3, "active", true, "Partner-provided CSV feed; automated checks authorized under data-sharing agreement."],
      ["Alpena County Community Resources Page (demo)", "https://alpenacounty.example/community-resources", "government_page", "Alpena County", "Alpena", false, 11, "active", false, "Checked manually each month. No automated retrieval."],
      ["Kent County Parks — Adaptive Programs (demo)", "https://kentparks.example/adaptive", "government_page", "Kent County", "Kent", false, 16, "active", false, ""],
      ["Upper Peninsula Caregiver Coalition Newsletter (demo)", "https://upcaregivers.example/newsletter", "community_organization", "Upper Peninsula", "Marquette", false, 9, "active", false, "Monthly email newsletter forwarded by coalition staff."],
      ["Southeast Michigan Transit Accessibility Updates (demo)", "https://semtransit.example/accessibility", "public_program_directory", "Wayne, Oakland, and Macomb counties", "Wayne", false, 40, "needs_attention", false, "Page moved; update URL."],
      ["Thumb Area Community Calendar (demo)", "https://thumbcalendar.example", "community_organization", "Huron, Tuscola, and Sanilac counties", "Huron", false, 75, "paused", false, "Paused during calendar redesign."],
    ];
    const sourceIds: string[] = [];
    for (const [name, url, type, coverage, county, statewide, checked, status, authorized, notes] of sources) {
      sourceIds.push(await insert(sql, "public.source_watch_sources", {
        name, url, source_type: type, coverage, county_id: county ? countyId[county] : null, is_statewide: statewide, last_checked_at: daysAgo(checked), status,
        automated_checks_authorized: authorized, notes: notes || null, created_by: U.sarah, created_at: daysAgo(200),
      }));
    }
    const cand = (o: {
      source: number; name: string; url: string; category: string; city: string | null; county: string; excerpt: string; dup: number; dupListing?: string | null;
      status: string; days: number; populations: string[]; imported?: string | null; phone?: string; summary: string; reviewed?: boolean;
    }) => insert(sql, "public.source_watch_candidates", {
      source_id: sourceIds[o.source], name: o.name, url: o.url, suggested_category_id: categoryId[o.category], possible_city: o.city, possible_county_id: countyId[o.county],
      excerpt: o.excerpt, duplicate_confidence: o.dup, duplicate_listing_id: o.dupListing ?? null, status: o.status, discovered_at: daysAgo(o.days),
      reviewed_by: o.reviewed ? U.sarah : null, reviewed_at: o.reviewed ? daysAgo(Math.max(0, o.days - 1)) : null, imported_listing_id: o.imported ?? null,
      suggestion_engine: "rules-demo",
      suggestions: {
        category: { slug: o.category, confidence: 0.82 },
        populations: o.populations,
        summary: o.summary,
        organization: { phone: o.phone ?? null, city: o.city, county: o.county },
        duplicates: o.dupListing ? [{ listing_id: o.dupListing, confidence: o.dup }] : [],
      },
    });
    await cand({ source: 1, name: "Accessible Transportation Program — Alpena", url: "https://alpenacounty.example/community-resources#accessible-transport", category: "transportation", city: "Alpena", county: "Alpena",
      excerpt: "The county senior center coordinates wheelchair-accessible rides to medical appointments for residents age 60+ and adults with disabilities. Call 48 hours ahead.", dup: 18, status: "new", days: 2,
      populations: ["older-adults", "adults"], phone: "(989) 555-0120", summary: "Coordinated wheelchair-accessible medical rides for older adults and adults with disabilities in Alpena County." });
    await cand({ source: 2, name: "West Michigan Adaptive Recreation Initiative", url: "https://kentparks.example/adaptive/initiative", category: "recreation", city: "Grand Rapids", county: "Kent",
      excerpt: "Adaptive kayaking, hand-cycling, and inclusive nature programs offered in partnership with local nonprofits.", dup: 72, dupListing: ORG("west-michigan-autism-family-center"), status: "reviewing", days: 5,
      populations: ["children", "teens", "adults"], summary: "Adaptive outdoor recreation programs (kayaking, hand-cycling) in Kent County parks.", reviewed: true });
    await cand({ source: 3, name: "UP Caregiver Support Network", url: "https://upcaregivers.example/network", category: "caregiver-support", city: "Marquette", county: "Marquette",
      excerpt: "Monthly caregiver support meetings in Marquette and Escanaba and online, coordinated with the regional ability resource center.", dup: 89, dupListing: L("service", "upar-caregiver-support-network"), status: "possible_duplicate", days: 7,
      populations: ["caregivers", "families"], summary: "Caregiver support groups in Marquette, Escanaba, and online.", reviewed: true });
    await cand({ source: 1, name: "Alpena Area Respite Cooperative", url: "https://nonprofit-directory.example/michigan/alpena-respite-coop", category: "respite-care", city: "Alpena", county: "Alpena",
      excerpt: "A parent-run cooperative that trains and shares respite providers among member families in Alpena and Presque Isle counties.", dup: 9, status: "new", days: 1,
      populations: ["caregivers", "families", "children"], summary: "Parent-run respite cooperative serving Alpena and Presque Isle counties." });
    await cand({ source: 0, name: "Grand Traverse Deaf Community Center", url: "https://nonprofit-directory.example/michigan/gt-deaf-community", category: "deaf-hard-of-hearing", city: "Traverse City", county: "Grand Traverse",
      excerpt: "Community center offering ASL social events, advocacy, and interpreter referrals for Northwest Michigan.", dup: 12, status: "new", days: 3,
      populations: ["adults", "families"], summary: "ASL community events, advocacy, and interpreter referrals in Northwest Michigan." });
    await cand({ source: 0, name: "Muskegon Adaptive Paddling Program", url: "https://nonprofit-directory.example/michigan/muskegon-adaptive-paddling", category: "recreation", city: "Muskegon", county: "Muskegon",
      excerpt: "Summer adaptive kayaking and paddleboarding with adaptive seating and launch equipment at Muskegon Lake.", dup: 22, status: "approved_for_import", days: 12,
      populations: ["teens", "adults"], summary: "Summer adaptive kayaking and paddleboarding at Muskegon Lake.", reviewed: true });
    await cand({ source: 4, name: "Detroit Wheelchair Transit Advocates", url: "https://semtransit.example/advocates-blog", category: "transportation", city: "Detroit", county: "Wayne",
      excerpt: "A volunteer blog sharing rider experiences and elevator outage reports.", dup: 35, status: "rejected", days: 20,
      populations: ["adults"], summary: "Volunteer blog about transit accessibility (not a service provider).", reviewed: true });
    await cand({ source: 0, name: "Saginaw Valley Interpreter Services", url: "https://nonprofit-directory.example/michigan/sv-interpreters", category: "deaf-hard-of-hearing", city: "Saginaw", county: "Saginaw",
      excerpt: "Interpreter referral for medical and legal appointments in the Great Lakes Bay Region.", dup: 81, dupListing: ORG("saginaw-valley-deaf-hard-of-hearing-services"), status: "possible_duplicate", days: 9,
      populations: ["adults", "families"], summary: "ASL interpreter referral in the Great Lakes Bay Region." });
    await cand({ source: 0, name: "Accessible Trails Discovery Initiative", url: "https://accessibletrails.example", category: "recreation", city: null, county: "Ingham",
      excerpt: "Volunteers document trail accessibility across Michigan parks and publish free reports.", dup: 5, status: "imported", days: 45, imported: L("program", "michigan-accessible-trails-initiative"),
      populations: ["adults", "families", "older-adults"], summary: "Statewide volunteer trail accessibility reports.", reviewed: true });

    // ------------------------------------------------------------ duplicates
    await insert(sql, "public.duplicate_suggestions", {
      listing_a: ORG("michigan-ability-center"), listing_b: ORG("michigan-ability-ctr"), confidence: 91,
      signals: { name_similarity: 0.82, same_website_domain: true, same_phone: true, same_email: true, same_address: true, same_zip: true }, status: "open", created_at: daysAgo(15),
    }, "");
    await insert(sql, "public.duplicate_suggestions", {
      listing_a: ORG("great-lakes-autism-family-center"), listing_b: ORG("west-michigan-autism-family-center"), confidence: 46,
      signals: { name_similarity: 0.71, same_website_domain: false, same_phone: false, same_email: false, same_address: false, same_zip: false }, status: "open", created_at: daysAgo(9),
    }, "");
    await insert(sql, "public.duplicate_suggestions", {
      listing_a: ORG("capital-area-accessibility-network"), listing_b: ORG("great-lakes-independent-living-network"), confidence: 38,
      signals: { name_similarity: 0.31, same_website_domain: false, same_phone: false, shared_city: "Lansing" }, status: "kept_separate", resolved_by: U.sarah, resolved_at: daysAgo(50), created_at: daysAgo(52),
    }, "");

    // ------------------------------------------------------------ outreach
    const outreach: [string, string, string, string, string, string, number | null, number | null, string, string][] = [
      ["lakeshore-supported-living-services", "Tom Becker", "Director of Services", "t.becker@lakeshoresupportedliving.example", "(231) 555-0187", "claim_invited", 3, 7, "marcus", "Invited to claim listing; claim submitted yesterday."],
      ["macomb-family-autism-partners", "Nadia Haddad", "Board Chair", "nadia@macombautismpartners.example", "(586) 555-0174", "outreach_sent", 9, 5, "marcus", "Sent listing overview and claim instructions."],
      ["saginaw-valley-deaf-hard-of-hearing-services", "Paul Kowalski", "Executive Director", "pkowalski@svdhh.example", "(989) 555-0125", "responded", 5, 14, "sarah", "Interested in claiming; asked for ASL video explaining MittenLink."],
      ["jackson-area-transportation-access-project", "Linda Moore", "Operations Manager", "lmoore@jacksonrides.example", "(517) 555-0136", "follow_up_needed", 16, -1, "marcus", "Left voicemail; follow up by email."],
      ["southwest-michigan-vision-resource-center", "Grace Kim", "Program Director", "gkim@swmivision.example", "(269) 555-0115", "not_contacted", null, 3, "marcus", "Priority: high-traffic listing without a claimed manager."],
      ["great-lakes-independent-living-network", "Emily Carter", "Communications Manager", "e.carter@greatlakesiln.example", "(734) 555-0182", "claimed", 210, null, "sarah", "Claimed and upgraded to Enhanced."],
      ["sunrise-coast-senior-disability-services", "Front Desk", "Reception", "info@sunrisecoastservices.example", "(989) 555-0103", "unable_to_reach", 22, 20, "marcus", "Three attempts by phone and email."],
      ["river-raisin-disability-advocacy-center", "Jamal Carter", "Director", "jcarter@riverraisinadvocacy.example", "(734) 555-0191", "declined", 30, null, "sarah", "Prefers MittenLink staff maintain the listing for now."],
      ["thumb-area-independent-living-center", "Beth Sommers", "Executive Director", "bsommers@thumbindependence.example", "(989) 555-0114", "follow_up_needed", 12, 0, "marcus", "Asked to reconnect after board meeting."],
      ["mid-michigan-housing-accessibility-coalition", "Rosa Martinez", "Housing Program Manager", "rmartinez@midmihousingaccess.example", "(989) 555-0168", "outreach_sent", 6, 8, "marcus", "Emailed claim invitation."],
      ["northern-michigan-family-support-collaborative", "David Reynolds", "Program Director", "d.reynolds@example-demo.org", "(231) 555-0158", "claim_invited", 10, 2, "sarah", "Claim submitted; under review."],
    ];
    for (const [org, name, role, email, phone, status, last, next, staff, notes] of outreach) {
      const oc = await insert(sql, "public.outreach_contacts", {
        organization_id: ORG(org), contact_name: name, contact_role: role, email, phone, status, last_contacted_at: last !== null ? daysAgo(last) : null,
        next_follow_up_at: next !== null ? dateOnly(daysFromNow(next)) : null, assigned_to: U[staff], notes, created_at: daysAgo((last ?? 5) + 10),
      });
      if (last !== null) {
        await insert(sql, "public.outreach_interactions", { outreach_contact_id: oc, channel: status === "unable_to_reach" ? "phone" : "email", summary: notes, status_after: status, created_by: U[staff], occurred_at: daysAgo(last) }, "");
        if (last > 8) await insert(sql, "public.outreach_interactions", { outreach_contact_id: oc, channel: "email", summary: "Initial introduction to MittenLink and listing review request.", status_after: "outreach_sent", created_by: U[staff], occurred_at: daysAgo(last + 7) }, "");
      }
    }

    // ------------------------------------------------------------ analytics
    log("search analytics, gaps, notifications, audit");
    const failed: [string, string | null, number, number][] = [
      ["respite care", "Alpena", 27, 0], ["wheelchair transportation", "Alpena", 14, 0], ["adult autism services", "Marquette", 19, 1],
      ["respite care", "Presque Isle", 9, 0], ["respite", "Alcona", 6, 0], ["deaf services", "Grand Traverse", 11, 0],
      ["ocupational therapy", "Marquette", 5, 0], ["adaptive swimming", "Muskegon", 8, 0], ["autism dentist", "Kent", 12, 1],
      ["housing vouchers", "Alpena", 4, 0], ["asl interpreter", "Houghton", 7, 0], ["sensory friendly haircut", "Oakland", 6, 1],
      ["brain injury support", "Saginaw", 5, 0], ["job coach", "Chippewa", 10, 0], ["accessible playground", "Bay", 3, 1],
    ];
    for (const [q, county, count, results] of failed) {
      await insert(sql, "public.failed_searches", {
        normalized_query: q, county_id: county ? countyId[county] : null, search_count: count, last_result_count: results,
        first_seen_at: daysAgo(60 + Math.floor(rand() * 20)), last_seen_at: daysAgo(Math.floor(rand() * 5)),
      }, "");
      for (let i = 0; i < Math.min(count, 6); i++) {
        await insert(sql, "public.search_logs", {
          normalized_query: q, location_label: county ? `${county} County` : null, county_id: county ? countyId[county] : null, radius_miles: 25,
          filters: {}, result_count: results, outcome: results === 0 ? "zero" : "low", created_at: daysAgo(rand() * 60),
        }, "");
      }
    }
    const okQueries: [string, string][] = [["autism services", "Washtenaw"], ["employment", "Wayne"], ["occupational therapy", "Kent"], ["transportation", "Jackson"], ["assistive technology", "Ingham"], ["caregiver support", "Bay"], ["benefits", "Oakland"], ["recreation", "Kalamazoo"]];
    for (let i = 0; i < 60; i++) {
      const [q, county] = pick(okQueries);
      await insert(sql, "public.search_logs", {
        normalized_query: q, location_label: `${county} County`, county_id: countyId[county], radius_miles: 25, filters: {}, result_count: 3 + Math.floor(rand() * 12), outcome: "ok", created_at: daysAgo(rand() * 60),
      }, "");
    }
    const gaps: [string, string, string, string, string | null, string | null, string | null, number, number, string, string | null][] = [
      ["Wheelchair transportation — 0 resources in Alpena County", "14 searches for wheelchair or accessible transportation in Alpena County in the last 60 days returned no local results.", "zero_supply", "high", "transportation", "Alpena", "Northern Michigan", 14, 0, "open", null],
      ["Adult autism services — high search demand, 1 provider in Marquette County", "19 searches for adult autism services in Marquette County; only one listed service, which has a waitlist.", "low_supply", "high", "autism-services", "Marquette", "Upper Peninsula", 19, 1, "researching", "jordan"],
      ["Respite care — 42 unsuccessful searches in Northern Michigan", "Unsuccessful respite searches in Alpena (27), Presque Isle (9), and Alcona (6) counties. Only statewide options were available.", "unmet_demand", "high", "respite-care", null, "Northern Michigan", 42, 0, "source_watch_task", "jordan"],
      ["Deaf & hard of hearing services — 0 providers in Grand Traverse County", "11 searches returned no local Deaf services. A Source Watch candidate may address this gap.", "zero_supply", "medium", "deaf-hard-of-hearing", "Grand Traverse", "Northern Michigan", 11, 0, "open", null],
      ["Job coaching — no providers in the Eastern Upper Peninsula", "10 searches for job coaching in Chippewa County returned no results.", "low_supply", "medium", "employment", "Chippewa", "Upper Peninsula", 10, 0, "open", null],
    ];
    let respiteGap = "";
    for (const [title, description, type, severity, cat, county, region, searches, resources, status, assignee] of gaps) {
      const gid = await insert(sql, "public.resource_gap_flags", {
        title, description, indicator_type: type, severity, category_id: cat ? categoryId[cat] : null, county_id: county ? countyId[county] : null, region,
        search_count: searches, resource_count: resources, status, assigned_to: assignee ? U[assignee] : null, created_by: U.sarah, created_at: daysAgo(14),
      });
      if (title.startsWith("Respite")) respiteGap = gid;
    }
    await insert(sql, "public.source_watch_tasks", {
      title: "Research respite providers in Alpena, Alcona, and Presque Isle counties", details: "Check county community resource pages, area agency on aging listings, and parent networks. Candidate: Alpena Area Respite Cooperative.",
      county_id: countyId["Alpena"], category_id: categoryId["respite-care"], gap_flag_id: respiteGap, assigned_to: U.jordan, status: "in_progress", created_by: U.sarah, created_at: daysAgo(10),
    }, "");

    const viewed = ["great-lakes-independent-living-network", "west-michigan-autism-family-center", "kalamazoo-accessible-recreation-alliance", "detroit-adaptive-arts-collective", "motor-city-ability-center", "upper-peninsula-ability-resource-center"];
    for (const [i, org] of viewed.entries()) {
      const n = 120 - i * 15;
      for (let k = 0; k < n; k++) {
        await insert(sql, "public.analytics_events", { event_name: "provider_viewed", listing_id: ORG(org), properties: { source: pick(["search", "search", "direct", "category"]) }, created_at: daysAgo(rand() * 30) }, "");
      }
    }
    for (let k = 0; k < 40; k++) {
      await insert(sql, "public.analytics_events", { event_name: "search_performed", properties: { has_location: rand() > 0.3 }, created_at: daysAgo(rand() * 30) }, "");
    }

    // ------------------------------------------------------------ notifications
    const notes: [string, string, string, string | null, string, number, boolean][] = [
      ["emily", "claim_approved", "Your provider claim has been approved.", "You can now manage Great Lakes Independent Living Network from your Provider Dashboard.", "/provider", 208, true],
      ["emily", "subscription_active", "Your Enhanced listing subscription is active.", "Enhanced features are now enabled for Great Lakes Independent Living Network. This is a demonstration subscription; no payment was processed.", "/provider/plan", 150, true],
      ["emily", "change_approved", "Your organization update was approved.", "The Lansing Office appointment requirement is now published.", "/provider/verification", 19, false],
      ["emily", "verification_due", "Great Lakes Independent Living Network is due for verification.", "Please review your listing so our verification team can confirm it is current.", "/provider/organization", 1, false],
      ["rachel", "change_more_info", "Your organization update requires additional information.", "A verifier asked a question about your accessibility update.", "/provider/verification", 3, false],
      ["hannah", "change_submitted", "Your update was submitted for review.", "Benefits Counseling changes are pending review.", "/provider/verification", 2, false],
      ["dana", "subscription_past_due", "Your Enhanced subscription is past due.", "Update your billing details to keep Enhanced features. Verification status is not affected.", "/provider/plan", 3, false],
      ["david", "claim_under_review", "Your provider claim is under review.", "An administrator is reviewing your claim for Northern Michigan Family Support Collaborative.", "/account/claims", 2, false],
      ["angela", "claim_more_info", "More information is needed for your provider claim.", "Please review the message from MittenLink and update your claim.", "/account/claims", 7, false],
      ["jordan", "task_assigned", "High-priority task assigned: Flint Inclusive Employment Network", "Community correction — phone number reported disconnected.", "/verify", 6, false],
      ["jordan", "source_watch_candidate", "A new Source Watch candidate is ready for review.", "Alpena Area Respite Cooperative was discovered in the Michigan Statewide Nonprofit Directory feed.", "/admin/source-watch", 1, false],
      ["jordan", "task_assigned", "Provider update ready for review", "Upper Peninsula Ability Resource Center submitted changes to Benefits Counseling.", "/verify", 2, false],
      ["sarah", "claim_submitted", "New provider claim: Lakeshore Supported Living Services", "Tom Becker (Director of Services) submitted a claim.", "/admin/claims", 1, false],
      ["sarah", "claim_submitted", "New provider claim: Northern Michigan Family Support Collaborative", "David Reynolds (Program Director) submitted a claim.", "/admin/claims", 3, true],
      ["sarah", "source_watch_candidate", "A new Source Watch candidate is ready for review.", "Accessible Transportation Program — Alpena was found on a watched source.", "/admin/source-watch", 2, false],
      ["sarah", "escalation", "Verification task escalated to administrators", "Michigan Ability Ctr. — possible duplicate needs a merge decision.", "/admin/duplicates", 15, false],
      ["alex", "report_under_review", "Your family experience report is under review.", "Thank you for sharing your experience with Kalamazoo Accessible Recreation Alliance.", "/account/reports", 3, false],
      ["alex", "correction_received", "Thanks for your correction.", "A verifier is reviewing your report about Flint Inclusive Employment Network.", "/account/reports", 6, true],
    ];
    for (const [user, kind, title, body, link, d, read] of notes) {
      await insert(sql, "public.notifications", { user_id: U[user], kind, title, body, link_url: link, read_at: read ? daysAgo(Math.max(0, d - 1)) : null, created_at: daysAgo(d) }, "");
    }

    // ------------------------------------------------------------ internal notes
    await insert(sql, "public.internal_notes", { entity_type: "listing", entity_id: ORG("flint-inclusive-employment-network"), body: "Two community members reported the main phone disconnected. Facebook page lists (810) 555-0161 — unconfirmed.", author_id: U.jordan, created_at: daysAgo(5) }, "");
    await insert(sql, "public.internal_notes", { entity_type: "claim", entity_id: claimIds.nmfsc, body: "Work email domain differs from website domain (example-demo.org vs northernfamilysupport.example). Staff page lists David Reynolds as Program Director. Left voicemail for Executive Director to confirm.", author_id: U.sarah, created_at: daysAgo(2) }, "");
    await insert(sql, "public.internal_notes", { entity_type: "listing", entity_id: ORG("west-michigan-autism-family-center"), body: "Enhanced listing. Confirm featured services during six-month review.", author_id: U.jordan, created_at: daysAgo(4) }, "");

    // ------------------------------------------------------------ audit history
    const audit: [string | null, string, string, string | null, string, Json | null, Json | null, number][] = [
      ["sarah", "provider.created", "organization", ORG("northern-michigan-family-support-collaborative"), "Northern Michigan Family Support Collaborative", null, { verification_status: "pending_review" }, 6],
      ["david", "claim.submitted", "provider_claim", claimIds.nmfsc, "Northern Michigan Family Support Collaborative", null, { status: "submitted" }, 3],
      ["sarah", "claim.status_changed", "provider_claim", claimIds.nmfsc, "Northern Michigan Family Support Collaborative", { status: "submitted" }, { status: "under_review" }, 2],
      ["sarah", "claim.approved", "provider_claim", claimIds.glil, "Great Lakes Independent Living Network", { status: "under_review" }, { status: "approved" }, 208],
      ["sarah", "claim.rejected", "provider_claim", claimIds.mactr, "Michigan Ability Ctr.", { status: "under_review" }, { status: "rejected" }, 28],
      ["sarah", "claim.more_info_requested", "provider_claim", claimIds.fien, "Flint Inclusive Employment Network", { status: "under_review" }, { status: "more_info_required" }, 7],
      ["emily", "billing.plan_changed", "organization", ORG("great-lakes-independent-living-network"), "Great Lakes Independent Living Network", { listing_tier: "free" }, { listing_tier: "enhanced", provider: "demo" }, 150],
      ["jordan", "verification.changed", "listing", ORG("flint-inclusive-employment-network"), "Flint Inclusive Employment Network", { verification_status: "verified" }, { verification_status: "needs_update" }, 12],
      ["jordan", "provider_update.published", "provider_change_request", ORG("great-lakes-independent-living-network"), "Great Lakes Independent Living Network — Lansing Office", { appointment_required: false }, { appointment_required: true }, 19],
      ["marcus", "family_report.moderated", "family_experience_report", null, "Motor City Ability Center", { status: "under_review" }, { status: "approved" }, 17],
      ["marcus", "family_report.moderated", "family_experience_report", null, "Eastside Wellness & Disability Counseling", { status: "under_review" }, { status: "rejected" }, 19],
      ["sarah", "source_watch.imported", "source_watch_candidate", null, "Accessible Trails Discovery Initiative", { status: "approved_for_import" }, { status: "imported" }, 44],
      ["sarah", "role.changed", "user_role", U.priya, "Priya Shah", { roles: ["community_member"] }, { roles: ["verifier"] }, 200],
      ["sarah", "duplicate.kept_separate", "duplicate_suggestion", null, "Capital Area Accessibility Network / Great Lakes Independent Living Network", { status: "open" }, { status: "kept_separate" }, 50],
      ["sarah", "settings.updated", "platform_setting", "enhanced_plan", "Enhanced plan", { price_cents: 2500 }, { price_cents: 2900 }, 90],
      ["dana", "billing.status_changed", "organization", ORG("detroit-adaptive-arts-collective"), "Detroit Adaptive Arts Collective", { status: "active" }, { status: "past_due" }, 3],
    ];
    for (const [actor, action, entity_type, entity_id, label, prev, next, d] of audit) {
      const actorProfile = actor ? DEMO_USERS.find((u) => u.key === actor) : null;
      await insert(sql, "public.audit_logs", {
        actor_id: actor ? U[actor] : null, actor_label: actorProfile?.name ?? "System", action, entity_type, entity_id, entity_label: label,
        previous_state: prev ? JSON.stringify(prev) : null, new_state: next ? JSON.stringify(next) : null, metadata: { seeded: true }, created_at: daysAgo(d),
      }, "");
    }
    void taskIds;
    log("done");
  });
}
