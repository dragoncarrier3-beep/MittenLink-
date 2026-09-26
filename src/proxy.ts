import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy (Next.js 16 replacement for middleware).
 *
 * Only does work when AUTH_PROVIDER=supabase: refreshes the Supabase Auth
 * session cookie so Server Components always see a valid session. With the
 * default local auth provider this is a no-op pass-through.
 * Authorization is NOT decided here — every page and action checks roles
 * server-side, and the database enforces Row Level Security.
 */
export async function proxy(request: NextRequest) {
  if (process.env.AUTH_PROVIDER !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const { createServerClient } = await import("@supabase/ssr");
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
