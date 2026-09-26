import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { authProviderName } from "@/lib/auth/provider";
import { asService } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";
import { SignInForm } from "./sign-in-form";
import { demoSignInAction } from "../actions";

export const metadata: Metadata = { title: "Sign In" };

const DEMO_ORDER = ["admin@mittenlink.demo", "verifier@mittenlink.demo", "provider@mittenlink.demo", "community@mittenlink.demo"];
const DEMO_DESCRIPTIONS: Record<string, string> = {
  "admin@mittenlink.demo": "Review claims, queues, Source Watch, analytics, users, and settings.",
  "verifier@mittenlink.demo": "Work the verification queue and approve provider updates.",
  "provider@mittenlink.demo": "Manage Great Lakes Independent Living Network (Enhanced listing).",
  "community@mittenlink.demo": "Save resources, submit reports, and try claiming a provider.",
};

async function demoAccounts() {
  if (process.env.DEMO_MODE === "false" || authProviderName() !== "local") return [];
  try {
    const rows = await asService((sql) =>
      sql.query<{ id: string; email: string; full_name: string; roles: string[] }>(
        `select p.id, p.email, p.full_name, array_agg(ur.role_key order by r.rank desc) as roles
         from public.profiles p join public.user_roles ur on ur.user_id = p.id join public.roles r on r.key = ur.role_key
         where p.is_demo and p.is_active and p.email = any($1) group by p.id`,
        [DEMO_ORDER],
      ),
    );
    return rows.sort((a, b) => DEMO_ORDER.indexOf(a.email) - DEMO_ORDER.indexOf(b.email));
  } catch {
    return [];
  }
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const user = await getCurrentUser();
  if (user && next) redirect(next);
  const accounts = await demoAccounts();

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
      <div className="max-w-lg">
        <h1 className="text-3xl font-bold">Sign in to MittenLink</h1>
        <p className="mt-2 text-lg text-muted-foreground">Save resources, manage your organization, or access staff tools.</p>
        {user && (
          <p className="mt-4 rounded-lg border bg-info-soft p-3" role="status">
            You are signed in as <strong>{user.fullName}</strong>. Signing in again will switch accounts.
          </p>
        )}
        {params.error === "demo" && (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger-soft p-3" role="alert">
            That demo account is not available. Please choose another account or sign in with a password.
          </p>
        )}
        <div className="mt-6">
          <SignInForm next={next} />
        </div>
        <p className="mt-6">
          New to MittenLink?{" "}
          <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary underline">
            Create a free account
          </Link>
        </p>
      </div>

      {accounts.length > 0 && (
        <section aria-labelledby="demo-accounts-heading" className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            <h2 id="demo-accounts-heading" className="text-xl font-bold">
              Demonstration accounts
            </h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            For this demo, you can switch between roles with one click. These accounts contain only fictional sample data. One-click sign-in is disabled outside demo mode.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {accounts.map((a) => (
              <li key={a.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{a.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {ROLE_LABELS[a.roles[0]] ?? a.roles[0]} · {a.email}
                    </p>
                    <p className="mt-1 text-sm">{DEMO_DESCRIPTIONS[a.email]}</p>
                  </div>
                  <form action={demoSignInAction}>
                    <input type="hidden" name="userId" value={a.id} />
                    <input type="hidden" name="next" value={next || defaultLanding(a.roles)} />
                    <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-[#08486b]">
                      Sign in as {a.full_name.split(" ")[0]}
                      <span className="sr-only"> ({ROLE_LABELS[a.roles[0]]})</span>
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Password sign-in for demo accounts uses the <code>DEMO_ACCOUNT_PASSWORD</code> configured on the server (see the README). Passwords are never shown in the interface.
          </p>
        </section>
      )}
    </div>
  );
}

function defaultLanding(roles: string[]) {
  if (roles.includes("super_admin") || roles.includes("admin")) return "/admin";
  if (roles.includes("verifier")) return "/verify";
  if (roles.includes("provider")) return "/provider";
  return "/account";
}
