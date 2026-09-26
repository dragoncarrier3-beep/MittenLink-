import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Bookmark, BadgeCheck, ClipboardList, FileText, LayoutDashboard, Search, ShieldCheck, UserRound } from "lucide-react";
import { asCurrentUser, requireUser, isAdmin, isProvider, isStaff } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/common/page";

export const metadata: Metadata = { title: "Overview" };

interface Counts {
  saved: number;
  searches: number;
  reports: number;
  claims: number;
  claims_attention: number;
  unread: number;
}

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");
  const [counts] = await asCurrentUser((sql) =>
    sql.query<Counts>(
      `select
         (select count(*)::int from public.saved_resources where user_id = auth.uid()) as saved,
         (select count(*)::int from public.saved_searches where user_id = auth.uid()) as searches,
         ((select count(*)::int from public.family_experience_reports where submitted_by = auth.uid())
          + (select count(*)::int from public.community_corrections where submitter_user_id = auth.uid())
          + (select count(*)::int from public.community_submissions where submitter_user_id = auth.uid())) as reports,
         (select count(*)::int from public.provider_claims where claimant_user_id = auth.uid()) as claims,
         (select count(*)::int from public.provider_claims where claimant_user_id = auth.uid() and status in ('draft', 'more_info_required')) as claims_attention,
         (select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null) as unread`,
    ),
  );
  const c: Counts = counts ?? { saved: 0, searches: 0, reports: 0, claims: 0, claims_attention: 0, unread: 0 };

  const cards = [
    { href: "/account/saved", icon: Bookmark, title: "Saved resources", text: c.saved ? `${c.saved} saved` : "Nothing saved yet" },
    { href: "/account/searches", icon: Search, title: "Saved searches", text: c.searches ? `${c.searches} saved` : "No saved searches yet" },
    { href: "/account/reports", icon: FileText, title: "My reports", text: c.reports ? `${c.reports} submitted` : "Corrections, suggestions, and family reports" },
    {
      href: "/account/claims",
      icon: ClipboardList,
      title: "My claims",
      text: c.claims_attention ? `${c.claims_attention} need${c.claims_attention === 1 ? "s" : ""} your attention` : c.claims ? `${c.claims} total` : "Claim your organization's listing",
    },
    { href: "/notifications", icon: Bell, title: "Notifications", text: c.unread ? `${c.unread} unread` : "You're all caught up" },
    { href: "/account/profile", icon: UserRound, title: "Profile", text: "Your name, title, and phone" },
  ];
  const workspaces = [
    ...(isProvider(user) ? [{ href: "/provider", icon: LayoutDashboard, title: "Provider Dashboard", text: "Manage your organization's listing" }] : []),
    ...(isStaff(user) ? [{ href: "/verify", icon: BadgeCheck, title: "Verification Queue", text: "Review listings and provider updates" }] : []),
    ...(isAdmin(user) ? [{ href: "/admin", icon: ShieldCheck, title: "Admin Dashboard", text: "Claims, moderation, and platform settings" }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName.split(" ")[0] || user.fullName}`}
        description={
          <>
            Signed in as {user.email} · {user.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || ROLE_LABELS.community_member}
          </>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="flex h-full min-h-24 items-start gap-3 rounded-xl border bg-card p-5 shadow-sm hover:border-primary hover:bg-muted/40">
              <card.icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-lg font-bold">{card.title}</span>
                <span className="block text-muted-foreground">{card.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {workspaces.length > 0 && (
        <section aria-labelledby="workspaces-heading" className="mt-10">
          <h2 id="workspaces-heading" className="mb-4 text-2xl font-bold">
            Your workspaces
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((w) => (
              <li key={w.href}>
                <Link href={w.href} className="flex h-full min-h-24 items-start gap-3 rounded-xl border bg-secondary p-5 hover:border-primary">
                  <w.icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-lg font-bold">{w.title}</span>
                    <span className="block text-muted-foreground">{w.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
