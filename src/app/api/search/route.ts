import { NextResponse, type NextRequest } from "next/server";
import { parseSearchParams } from "@/lib/search/params";
import { runSearch, type RunSearchOptions } from "@/lib/search/service";
import { rateLimit } from "@/lib/server/rate-limit";
import type { SearchErrorResponse } from "@/lib/search/types";

const TRIGGERS = new Set(["load", "query", "filter", "location", "page", "sort"]);

/**
 * Unified search API used by the search page for in-place updates.
 * `commit=1` marks an explicit search (Enter, Apply, or a pause in typing);
 * only committed first-page searches are logged for gap analysis.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = await rateLimit("search", 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json<SearchErrorResponse>(
      { ok: false, error: "You're searching very quickly. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  try {
    const params = parseSearchParams(sp);
    const trigger = sp.get("trigger");
    const result = await runSearch(params, {
      commit: sp.get("commit") === "1",
      trigger: trigger && TRIGGERS.has(trigger) ? (trigger as RunSearchOptions["trigger"]) : "query",
      abandonedFilters: sp.get("abandoned") === "1",
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/search] failed", err);
    return NextResponse.json<SearchErrorResponse>(
      { ok: false, error: "We couldn't complete your search. Your filters have been preserved." },
      { status: 500 },
    );
  }
}
