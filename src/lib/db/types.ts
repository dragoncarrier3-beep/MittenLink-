export type Row = Record<string, unknown>;

/** Minimal SQL surface shared by every driver. Parameters use $1, $2 … placeholders. */
export interface SqlClient {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface DatabaseDriver {
  readonly name: "pglite" | "postgres";
  /** Runs fn inside a single transaction on one connection. */
  transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T>;
  /** Execute a multi-statement script outside any transaction (migrations only). */
  exec(sql: string): Promise<void>;
  /** Single parameterized query outside a transaction (migrations only). */
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** Who a query runs as. `null` user = anonymous public visitor. */
export interface DbActor {
  userId: string | null;
}
