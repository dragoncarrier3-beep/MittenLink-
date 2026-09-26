import { NextResponse, type NextRequest } from "next/server";

/** Services are browsed through unified search, filtered to services. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/search?kind=service", request.url), 308);
}
