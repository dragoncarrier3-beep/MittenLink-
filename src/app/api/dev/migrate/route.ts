import { NextResponse } from "next/server";
import { getDriver } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";
import { devToolsEnabled } from "@/lib/server/dev-guard";

/** DEV ONLY: apply pending SQL migrations to the running local database without a restart. */
export async function POST() {
  if (!devToolsEnabled()) return new NextResponse("Not found", { status: 404 });
  const driver = await getDriver();
  const ran = await runMigrations(driver, { includeCompat: false });
  return NextResponse.json({ applied: ran });
}
