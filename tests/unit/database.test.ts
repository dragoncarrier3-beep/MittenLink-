/**
 * Database-level tests against a fresh in-memory PostgreSQL (PGlite) with the
 * real migrations and seed data. Proves search behavior and that Row Level
 * Security enforces permissions independently of the application code.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDriver } from "@/lib/db/drivers/pglite";
import { runMigrations } from "@/lib/db/migrate";
import { seedDatabase } from "@/lib/db/seed";
import type { DatabaseDriver, SqlClient } from "@/lib/db/types";

let db: DatabaseDriver;

async function as<T>(role: "anon" | "authenticated", userId: string | null, fn: (sql: SqlClient) => Promise<T>) {
  return db.transaction(async (sql) => {
    await sql.query(`set local role ${role}`);
    await sql.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return fn(sql);
  });
}
const userId = async (email: string) =>
  (await db.query<{ id: string }>("select id from public.profiles where email = $1", [email]))[0].id;

const search = (sql: SqlClient, args: Record<string, unknown>) => {
  const keys = Object.keys(args);
  return sql.query<{ title: string; kind: string; match_scope: string; local_count: number; statewide_count: number; distance_miles: number | null }>(
    `select l.title, s.kind, s.match_scope, s.local_count::int, s.statewide_count::int, s.distance_miles
     from public.search_listings(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) s join public.listings l on l.id = s.id`,
    keys.map((k) => args[k]),
  );
};

beforeAll(async () => {
  process.env.DEMO_ACCOUNT_PASSWORD ??= "test-password-123";
  db = await createPgliteDriver("memory://");
  await runMigrations(db, { includeCompat: true });
  await seedDatabase(db, { log: () => {} });
});
afterAll(async () => db?.close());

describe("seed data", () => {
  it("meets the demo minimums", async () => {
    const [c] = await db.query<Record<string, number>>(`select
      (select count(*)::int from organizations) orgs, (select count(*)::int from organization_locations) locs,
      (select count(*)::int from services) services, (select count(*)::int from programs) programs,
      (select count(*)::int from resources) resources, (select count(*)::int from events) events,
      (select count(*)::int from provider_claims) claims, (select count(*)::int from verification_tasks) tasks,
      (select count(*)::int from source_watch_candidates) candidates, (select count(*)::int from outreach_contacts) outreach,
      (select count(*)::int from family_experience_reports) reports, (select count(*)::int from failed_searches) failed`);
    expect(c.orgs).toBeGreaterThanOrEqual(18);
    expect(c.locs).toBeGreaterThanOrEqual(28);
    expect(c.services).toBeGreaterThanOrEqual(40);
    expect(c.programs).toBeGreaterThanOrEqual(8);
    expect(c.resources).toBeGreaterThanOrEqual(10);
    expect(c.events).toBeGreaterThanOrEqual(8);
    expect(c.claims).toBeGreaterThanOrEqual(6);
    expect(c.tasks).toBeGreaterThanOrEqual(10);
    expect(c.candidates).toBeGreaterThanOrEqual(8);
    expect(c.outreach).toBeGreaterThanOrEqual(8);
    expect(c.reports).toBeGreaterThanOrEqual(6);
    expect(c.failed).toBeGreaterThanOrEqual(12);
  });
});

describe("search", () => {
  it("finds autism services near Ann Arbor for children within 25 miles", async () => {
    const rows = await as("anon", null, (sql) =>
      search(sql, { p_query: "Autism services", p_lat: 42.2808, p_lng: -83.743, p_radius_miles: 25, p_populations: ["children"] }),
    );
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.map((r) => r.title)).toContain("Great Lakes Autism & Family Center");
    expect(rows[0].match_scope).toBe("nearby");
  });
  it("tolerates typos", async () => {
    const rows = await as("anon", null, (sql) => search(sql, { p_query: "ocupational therapy" }));
    expect(rows.some((r) => /Occupational Therapy/.test(r.title))).toBe(true);
  });
  it("keeps statewide resources for local searches with no local match", async () => {
    const rows = await as("anon", null, (sql) => search(sql, { p_query: "respite care", p_lat: 45.0617, p_lng: -83.4327, p_radius_miles: 25 }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].local_count).toBe(0);
    expect(rows.every((r) => r.match_scope === "statewide")).toBe(true);
  });
  it("combines filters", async () => {
    const rows = await as("anon", null, (sql) => search(sql, { p_categories: ["transportation"], p_free_only: true, p_kinds: ["service"] }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === "service")).toBe(true);
  });
});

describe("row level security", () => {
  it("hides internal workflow tables from the public", async () => {
    const counts = await as("anon", null, (sql) =>
      sql.query<{ t: number; n: number; h: number; a: number }>(
        "select (select count(*)::int from verification_tasks) t, (select count(*)::int from internal_notes) n, (select count(*)::int from verification_history) h, (select count(*)::int from audit_logs) a",
      ),
    );
    expect(counts[0]).toEqual({ t: 0, n: 0, h: 0, a: 0 });
  });
  it("public verification view never exposes internal notes", async () => {
    const cols = await as("anon", null, (sql) => sql.query<Record<string, unknown>>("select * from public_verification_history limit 1"));
    expect(Object.keys(cols[0])).not.toContain("internal_notes");
  });
  it("providers cannot edit directory tables directly", async () => {
    const emily = await userId("provider@mittenlink.demo");
    const updated = await as("authenticated", emily, (sql) => sql.query("update listings set title = 'Hacked' where kind = 'organization' returning id"));
    expect(updated).toHaveLength(0);
  });
  it("users cannot grant themselves roles", async () => {
    const alex = await userId("community@mittenlink.demo");
    await expect(as("authenticated", alex, (sql) => sql.query("insert into user_roles (user_id, role_key) values ($1, 'admin')", [alex]))).rejects.toThrow();
  });
  it("payment status cannot be modified from the browser", async () => {
    const emily = await userId("provider@mittenlink.demo");
    await expect(as("authenticated", emily, (sql) => sql.query("update subscriptions set status = 'active'"))).rejects.toThrow();
  });
  it("audit log is append-only even for the privileged connection", async () => {
    await expect(db.query("delete from audit_logs")).rejects.toThrow(/append-only/);
  });
  it("verifiers can read the verification queue", async () => {
    const jordan = await userId("verifier@mittenlink.demo");
    const rows = await as("authenticated", jordan, (sql) => sql.query<{ n: number }>("select count(*)::int n from verification_tasks"));
    expect(rows[0].n).toBeGreaterThan(0);
  });
});
