/**
 * Database CLI.
 *
 *   npm run db:reset     Delete the local PGlite database, re-apply migrations, re-seed demo data.
 *   npm run db:migrate   Apply pending migrations (PGlite locally, or DATABASE_URL with DB_DRIVER=postgres).
 *   npm run db:seed      Seed demo data into an empty database.
 *
 * Stop the dev server before running reset: PGlite is single-process.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { runMigrations, isSeeded } from "../src/lib/db/migrate";
import { seedDatabase } from "../src/lib/db/seed";
import type { DatabaseDriver } from "../src/lib/db/types";

async function loadEnv() {
  try {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
  } catch {
    /* optional */
  }
}

async function main() {
  await loadEnv();
  const cmd = process.argv[2] ?? "migrate";
  const usePostgres = process.env.DB_DRIVER === "postgres" || (!!process.env.DATABASE_URL && process.env.DB_DRIVER !== "pglite");

  if (cmd === "reset" && usePostgres) {
    throw new Error("db:reset only supports the local PGlite database. For Supabase use `supabase db reset`.");
  }
  if (cmd === "reset") {
    const dir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
    await rm(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  }

  let driver: DatabaseDriver;
  if (usePostgres) {
    const { createPostgresDriver } = await import("../src/lib/db/drivers/postgres");
    driver = createPostgresDriver();
    const includeCompat = process.env.DB_INCLUDE_COMPAT === "true"; // plain PostgreSQL (not Supabase)
    const ran = await runMigrations(driver, { includeCompat });
    console.log(ran.length ? `Applied: ${ran.join(", ")}` : "No pending migrations.");
  } else {
    const { createPgliteDriver } = await import("../src/lib/db/drivers/pglite");
    const pg = await createPgliteDriver();
    driver = pg;
    const started = Date.now();
    const ran = await runMigrations(pg, { includeCompat: true });
    console.log(ran.length ? `Applied: ${ran.join(", ")} (${Date.now() - started} ms)` : "No pending migrations.");
  }

  if (cmd === "reset" || cmd === "seed") {
    const seeded = await driver.transaction((sql) => isSeeded(sql));
    if (seeded) {
      console.log("Database already contains data; skipping seed.");
    } else {
      const started = Date.now();
      let createAuthUser;
      if (process.env.AUTH_PROVIDER === "supabase") {
        const { createSupabaseAuthUser } = await import("../src/lib/auth/supabase-admin");
        createAuthUser = createSupabaseAuthUser;
      }
      await seedDatabase(driver, { createAuthUser });
      console.log(`Seeded in ${Date.now() - started} ms`);
    }
  }
  await driver.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
