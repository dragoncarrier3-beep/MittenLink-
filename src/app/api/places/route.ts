import { NextResponse, type NextRequest } from "next/server";
import { asPublic } from "@/lib/db";
import { suggestPlaces } from "@/lib/search/places";
import { rateLimit } from "@/lib/server/rate-limit";

/** Location autocomplete backed by the local places + counties gazetteer. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 1) return NextResponse.json({ ok: true, suggestions: [] });
  const limit = await rateLimit("places", 240, 60_000);
  if (!limit.ok) return NextResponse.json({ ok: false, suggestions: [] }, { status: 429 });
  try {
    const suggestions = await asPublic((sql) => suggestPlaces(sql, q));
    return NextResponse.json({ ok: true, suggestions }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("[api/places] failed", err);
    return NextResponse.json({ ok: false, suggestions: [] }, { status: 500 });
  }
}
