import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SqlClient } from "./types";

export interface MigrationTarget {
  /** Execute a multi-statement SQL script (no parameters). */
  exec(sql: string): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

const root = () => process.env.MITTENLINK_ROOT ?? process.cwd();

/**
 * Applies pending SQL migrations from /supabase/migrations in filename order.
 * With `includeCompat`, the local Supabase compatibility shim is applied first
 * (only for PGlite / plain PostgreSQL — never on a Supabase project).
 */
export async function runMigrations(target: MigrationTarget, opts: { includeCompat: boolean }) {
  if (opts.includeCompat) {
    await target.exec(await readFile(path.join(root(), "db/local/000_supabase_compat.sql"), "utf8"));
  }
  await target.exec(`
    create schema if not exists app;
    create table if not exists app.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const dir = path.join(root(), "supabase/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(
    (await target.query<{ filename: string }>("select filename from app.schema_migrations")).map((r) => r.filename),
  );
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await target.exec(`begin;\n${sql}\n;insert into app.schema_migrations(filename) values ('${file.replace(/'/g, "''")}');\ncommit;`);
    ran.push(file);
  }
  return ran;
}

export async function isSeeded(sql: SqlClient) {
  const rows = await sql.query<{ n: number }>("select count(*)::int as n from public.listings");
  return (rows[0]?.n ?? 0) > 0;
}
