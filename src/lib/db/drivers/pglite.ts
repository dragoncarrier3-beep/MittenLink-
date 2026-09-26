import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { postgis } from "@electric-sql/pglite-postgis";
import type { DatabaseDriver, SqlClient } from "../types";

/**
 * Embedded PostgreSQL (WASM) for local development and self-contained demos.
 * Same SQL, same PostGIS/pg_trgm, same RLS as the Supabase deployment.
 * Single-process only: do not point two running processes at one data dir.
 */
export async function createPgliteDriver(dataDir?: string, opts: { snapshot?: Blob } = {}): Promise<DatabaseDriver & { raw: PGlite }> {
  const dir = opts.snapshot ? "memory://" : dataDir ?? process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory://") await mkdir(dir, { recursive: true });
  const db = await PGlite.create({
    dataDir: dir,
    loadDataDir: opts.snapshot,
    extensions: { postgis, pg_trgm, unaccent },
  });
  await db.exec("set search_path to public, extensions");

  const toClient = (tx: Pick<PGlite, "query">): SqlClient => ({
    async query<T>(text: string, params?: unknown[]) {
      const res = await tx.query<T>(text, params as unknown[] | undefined);
      return res.rows;
    },
  });

  return {
    name: "pglite",
    raw: db,
    transaction: (fn) => db.transaction((tx) => fn(toClient(tx))),
    exec: async (text) => void (await db.exec(text)),
    query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
    close: () => db.close(),
  };
}
