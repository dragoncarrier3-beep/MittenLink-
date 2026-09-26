import "server-only";
import bcrypt from "bcryptjs";
import { asService } from "@/lib/db";
import { createSession, destroySession, readSessionUserId } from "./session";

/**
 * Authentication adapter. The rest of the app only needs a user id; roles and
 * profile data always come from the application database.
 *
 *   AUTH_PROVIDER=local     (default) bcrypt passwords in auth.users + signed cookie
 *   AUTH_PROVIDER=supabase  Supabase Auth via @supabase/ssr cookies
 */
export type AuthProviderName = "local" | "supabase";

export function authProviderName(): AuthProviderName {
  return process.env.AUTH_PROVIDER === "supabase" ? "supabase" : "local";
}

let cachedDummyHash: string | null = null;
function dummyHash() {
  cachedDummyHash ??= bcrypt.hashSync("not-a-real-password", 10);
  return cachedDummyHash;
}

export type SignInResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "inactive" | "unavailable" };

async function supabaseServerClient() {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component; proxy refreshes the session */
        }
      },
    },
  });
}

export async function getSessionUserId(): Promise<string | null> {
  if (authProviderName() === "supabase") {
    try {
      const supabase = await supabaseServerClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    } catch {
      return null;
    }
  }
  return readSessionUserId();
}

async function profileIsActive(userId: string) {
  const rows = await asService((sql) =>
    sql.query<{ is_active: boolean }>("select is_active from public.profiles where id = $1", [userId]),
  );
  return rows[0]?.is_active ?? false;
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  if (authProviderName() === "supabase") {
    const supabase = await supabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, reason: "invalid" };
    if (!(await profileIsActive(data.user.id))) {
      await supabase.auth.signOut();
      return { ok: false, reason: "inactive" };
    }
    return { ok: true, userId: data.user.id };
  }

  const rows = await asService((sql) =>
    sql.query<{ id: string; encrypted_password: string | null }>(
      "select id, encrypted_password from auth.users where lower(email) = lower($1)",
      [email.trim()],
    ),
  );
  const user = rows[0];
  // Compare against a dummy hash when the user does not exist to keep timing uniform.
  const hash = user?.encrypted_password ?? dummyHash();
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) return { ok: false, reason: "invalid" };
  if (!(await profileIsActive(user.id))) return { ok: false, reason: "inactive" };
  await asService((sql) => sql.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]));
  await createSession(user.id);
  return { ok: true, userId: user.id };
}

/**
 * One-click demo sign-in (DEMO_MODE only, demo-flagged accounts only).
 * Lets presenters switch roles without exposing passwords in the UI.
 */
export async function signInAsDemoUser(userId: string): Promise<SignInResult> {
  if (process.env.DEMO_MODE === "false") return { ok: false, reason: "unavailable" };
  if (authProviderName() !== "local") return { ok: false, reason: "unavailable" };
  const rows = await asService((sql) =>
    sql.query<{ id: string }>("select id from public.profiles where id = $1 and is_demo and is_active", [userId]),
  );
  if (!rows[0]) return { ok: false, reason: "invalid" };
  await createSession(rows[0].id);
  return { ok: true, userId: rows[0].id };
}

export async function signUpWithPassword(email: string, password: string, fullName: string): Promise<{ ok: true; userId: string } | { ok: false; reason: "exists" | "unavailable" }> {
  const normalized = email.trim().toLowerCase();
  if (authProviderName() === "supabase") {
    const supabase = await supabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email: normalized, password, options: { data: { full_name: fullName } } });
    if (error || !data.user) return { ok: false, reason: error?.message.includes("registered") ? "exists" : "unavailable" };
    await asService(async (sql) => {
      await sql.query(
        "insert into public.profiles (id, email, full_name) values ($1, $2, $3) on conflict (id) do nothing",
        [data.user!.id, normalized, fullName],
      );
      await sql.query("insert into public.user_roles (user_id, role_key) values ($1, 'community_member') on conflict do nothing", [data.user!.id]);
    });
    return { ok: true, userId: data.user.id };
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await asService(async (sql) => {
    const existing = await sql.query("select 1 from auth.users where lower(email) = $1", [normalized]);
    if (existing.length) return null;
    const [user] = await sql.query<{ id: string }>(
      "insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now()) returning id",
      [normalized, hash, JSON.stringify({ full_name: fullName })],
    );
    await sql.query("insert into public.profiles (id, email, full_name) values ($1, $2, $3)", [user.id, normalized, fullName]);
    await sql.query("insert into public.user_roles (user_id, role_key) values ($1, 'community_member')", [user.id]);
    return user.id;
  });
  if (!result) return { ok: false, reason: "exists" };
  await createSession(result);
  return { ok: true, userId: result };
}

export async function signOut() {
  if (authProviderName() === "supabase") {
    const supabase = await supabaseServerClient();
    await supabase.auth.signOut();
    return;
  }
  await destroySession();
}
