import "server-only";
import type { DatabaseDriver, DbActor, SqlClient } from "./types";

export type { SqlClient, DbActor, Row } from "./types";

type Driver = DatabaseDriver;

const globalForDb = globalThis as unknown as { __mittenlinkDb?: Promise<Driver> };

export function driverName(): "pglite" | "postgres" {
  const configured = process.env.DB_DRIVER;
  if (configured === "postgres" || configured === "pglite") return configured;
  return process.env.DATABASE_URL ? "postgres" : "pglite";
}

async function init(): Promise<Driver> {
  const { runMigrations, isSeeded } = await import("./migrate");
  if (driverName() === "postgres") {
    const { createPostgresDriver } = await import("./drivers/postgres");
    const driver = createPostgresDriver();
    // Supabase migrations are normally applied with `supabase db push`.
    if (process.env.DB_AUTO_MIGRATE === "true") {
      await runMigrations(driver, { includeCompat: false });
    }
    return driver;
  }

  const { createPgliteDriver } = await import("./drivers/pglite");
  const snapshot = await loadSnapshot();
  const driver = await createPgliteDriver(undefined, { snapshot });
  await runMigrations(driver, { includeCompat: true });
  const seeded = await driver.transaction((sql) => isSeeded(sql));
  if (!seeded && process.env.DEMO_AUTO_SEED !== "false") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase(driver);
  }
  return driver;
}

/**
 * Serverless hosts (Vercel) have no persistent disk: load the pre-seeded
 * snapshot built by scripts/build-demo-db.ts into memory instead.
 */
async function loadSnapshot(): Promise<Blob | undefined> {
  const wanted = process.env.DB_SNAPSHOT === "true" || (!!process.env.VERCEL && process.env.DB_SNAPSHOT !== "false");
  if (!wanted) return undefined;
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const buf = await readFile(path.join(process.cwd(), "demo-db", "snapshot.tar.gz"));
    return new Blob([new Uint8Array(buf)]);
  } catch (err) {
    console.warn("[db] demo snapshot not found; falling back to migrate + seed in memory", err);
    process.env.PGLITE_DATA_DIR = "memory://";
    return undefined;
  }
}

export function getDriver(): Promise<Driver> {
  if (!globalForDb.__mittenlinkDb) {
    globalForDb.__mittenlinkDb = init().catch((err) => {
      globalForDb.__mittenlinkDb = undefined;
      throw err;
    });
  }
  return globalForDb.__mittenlinkDb;
}

/**
 * Run queries as a specific actor with Row Level Security enforced.
 * Anonymous visitors run as `anon`; signed-in users as `authenticated`
 * with their user id exposed to policies through auth.uid().
 */
export async function withActor<T>(actor: DbActor, fn: (sql: SqlClient) => Promise<T>): Promise<T> {
  const driver = await getDriver();
  return driver.transaction(async (sql) => {
    const role = actor.userId ? "authenticated" : "anon";
    const claims = JSON.stringify(actor.userId ? { sub: actor.userId, role } : { role });
    await sql.query(`set local role ${role}`);
    await sql.query(
      `select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', $3, true)`,
      [claims, actor.userId ?? "", role],
    );
    return fn(sql);
  });
}

/** Public, anonymous read access (RLS enforced). */
export function asPublic<T>(fn: (sql: SqlClient) => Promise<T>) {
  return withActor({ userId: null }, fn);
}

/**
 * Privileged server-side access that bypasses RLS. Only call this AFTER an
 * explicit authorization check (see lib/auth/guards.ts) for multi-table
 * workflows such as claim approval, verification, publishing, and billing.
 * `actorId` is recorded for audit/trigger context.
 */
export async function asService<T>(fn: (sql: SqlClient) => Promise<T>, actorId?: string | null): Promise<T> {
  const driver = await getDriver();
  return driver.transaction(async (sql) => {
    if (actorId) {
      await sql.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actorId]);
    }
    return fn(sql);
  });
}
