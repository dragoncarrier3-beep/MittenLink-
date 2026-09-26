import postgres from "postgres";
import type { DatabaseDriver, SqlClient } from "../types";

/**
 * Standard PostgreSQL driver (Supabase or any managed Postgres).
 * DATABASE_URL should use a role that can `SET ROLE anon|authenticated`
 * (the Supabase `postgres` role can). Use the transaction pooler URL on
 * serverless hosts; prepared statements are disabled for pooler safety.
 */
export function createPostgresDriver(url = process.env.DATABASE_URL): DatabaseDriver {
  if (!url) throw new Error("DATABASE_URL is not configured");
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connection: { search_path: "public, extensions" },
  });

  return {
    name: "postgres",
    async transaction<T>(fn: (c: SqlClient) => Promise<T>) {
      return (await sql.begin(async (tx) => {
        const client: SqlClient = {
          async query<R>(text: string, params?: unknown[]) {
            return (await tx.unsafe(text, (params ?? []) as never[])) as unknown as R[];
          },
        };
        return fn(client);
      })) as T;
    },
    exec: async (text) => void (await sql.unsafe(text)),
    query: async <R,>(text: string, params?: unknown[]) => (await sql.unsafe(text, (params ?? []) as never[])) as unknown as R[],
    close: () => sql.end(),
  };
}
