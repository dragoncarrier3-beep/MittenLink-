import { createClient } from "@supabase/supabase-js";

/**
 * Creates (or finds) a Supabase Auth user using the service-role key.
 * Used only by the seed script when AUTH_PROVIDER=supabase. Never import
 * this from client code — the service-role key must stay server-side.
 */
export async function createSupabaseAuthUser(email: string, password: string, fullName: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed Supabase Auth users.");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.data.user) return created.data.user.id;

  // Already exists: look it up.
  for (let page = 1; page < 20; page++) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (list.data.users.length < 200) break;
  }
  throw new Error(`Could not create or find Supabase user ${email}: ${created.error?.message ?? "unknown error"}`);
}
