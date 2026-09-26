import { NextResponse, type NextRequest } from "next/server";
import { asService } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { devToolsEnabled } from "@/lib/server/dev-guard";

/**
 * DEV ONLY: sign in as a demo account for automated tests and local QA.
 * GET /api/dev/login-as?email=admin@mittenlink.demo&next=/admin
 * Returns 404 unless NODE_ENV=development and DEMO_MODE=true.
 */
export async function GET(req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse("Not found", { status: 404 });
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const next = req.nextUrl.searchParams.get("next") ?? "/account";
  const rows = await asService((sql) =>
    sql.query<{ id: string }>("select id from public.profiles where lower(email) = lower($1) and is_demo and is_active", [email]),
  );
  if (!rows[0]) return NextResponse.json({ error: "Unknown demo account" }, { status: 400 });
  await createSession(rows[0].id);
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/account", req.url));
}
