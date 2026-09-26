import { NextResponse } from "next/server";
import { asPublic, driverName } from "@/lib/db";

/** Liveness/readiness probe. Returns no sensitive information. */
export async function GET() {
  try {
    const rows = await asPublic((sql) => sql.query<{ n: number }>("select count(*)::int as n from public.listings"));
    return NextResponse.json({ ok: true, database: driverName(), publicListings: rows[0]?.n ?? 0 });
  } catch {
    return NextResponse.json({ ok: false, database: driverName() }, { status: 503 });
  }
}
