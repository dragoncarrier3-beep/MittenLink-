import { createPgliteDriver } from "../src/lib/db/drivers/pglite";
const pg = await createPgliteDriver();
const q = async (label: string, sql: string, params: unknown[] = [], role?: string, sub?: string) => {
  const rows = await pg.transaction(async (tx) => {
    if (role) { await tx.query(`set local role ${role}`); await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]); }
    return tx.query(sql, params);
  });
  console.log("\n## " + label); console.table(rows.slice(0, 12));
};
const S = `select l.title, s.kind, round(s.distance_miles::numeric,1) mi, s.match_scope, round(s.rank::numeric,3) rank, s.total_count::int total, s.local_count::int loc, s.statewide_count::int sw from search_listings(p_query=>$1, p_lat=>$2, p_lng=>$3, p_radius_miles=>$4, p_populations=>$5, p_county_id=>$6) s join listings l on l.id=s.id`;
await q("autism near ann arbor 25mi children", S, ["autism services", 42.2808, -83.743, 25, ["children"], null], "anon");
await q("typo ocupational therapy", S, ["ocupational therapy", null, null, null, null, null], "anon");
await q("respite near alpena", S, ["respite care", 45.0617, -83.4327, 25, null, null], "anon");
await q("county only Kent, no query", S, [null, null, null, null, null, 41], "anon");
await q("anon cannot see tasks", "select count(*)::int n from verification_tasks", [], "anon");
await q("anon cannot see internal notes", "select count(*)::int n from internal_notes", [], "anon");
await q("anon public listings", "select count(*)::int n from listings", [], "anon");
await q("pub verification view", "select count(*)::int n from public_verification_history", [], "anon");
await q("pub family view", "select count(*)::int n from public_family_experiences", [], "anon");
const [{ id: jordan }] = await pg.transaction((tx) => tx.query<{ id: string }>("select id from profiles where email='verifier@mittenlink.demo'"));
await q("verifier sees tasks", "select count(*)::int n from verification_tasks", [], "authenticated", jordan);
await q("verifier cannot update listings", "update listings set title='x' where kind='organization' returning id", [], "authenticated", jordan);
await q("gap indicators as anon", "select count(*)::int n from resource_gap_indicators", [], "anon");
await pg.close();
