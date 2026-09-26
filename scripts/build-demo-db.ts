/**
 * Builds a pre-seeded database snapshot (demo-db/snapshot.tar.gz) at build time.
 *
 * Serverless hosts (e.g. Vercel) have no persistent disk, so the demo loads
 * this snapshot into an in-memory PostgreSQL (PGlite) on cold start instead of
 * migrating and seeding on every request. Skipped when DATABASE_URL is set
 * (a real Postgres/Supabase database is used instead).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPgliteDriver } from "../src/lib/db/drivers/pglite";
import { runMigrations } from "../src/lib/db/migrate";
import { seedDatabase } from "../src/lib/db/seed";

async function main() {
  if (process.env.DATABASE_URL && process.env.DB_DRIVER !== "pglite") {
    console.log("[demo-db] DATABASE_URL is set — skipping demo snapshot.");
    return;
  }
  process.env.DEMO_ACCOUNT_PASSWORD ||= "MittenLink-Demo-2026!";
  const started = Date.now();
  const driver = await createPgliteDriver("memory://");
  await runMigrations(driver, { includeCompat: true });
  await seedDatabase(driver, { log: (m) => console.log(`[demo-db] ${m}`) });
  const blob = await driver.raw.dumpDataDir("gzip");
  const out = path.join(process.cwd(), "demo-db", "snapshot.tar.gz");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(await blob.arrayBuffer()));
  await driver.close();
  console.log(`[demo-db] wrote ${out} (${Math.round(blob.size / 1024)} KB) in ${Date.now() - started} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
