import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser, isAdmin, isProvider, isStaff } from "@/lib/auth";
import { asService } from "@/lib/db";
import { Logo } from "./logo";
import { PRIMARY_NAV, UTILITY_NAV } from "./nav-config";
import { MobileNav, NavLink } from "./site-header-client";
import { AccountMenu } from "./account-menu";

async function unreadCount(userId: string) {
  try {
    const rows = await asService((sql) =>
      sql.query<{ n: number }>("select count(*)::int as n from public.notifications where user_id = $1 and read_at is null", [userId]),
    );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const workspaceLinks = user
    ? [
        { href: "/account", label: "My Account" },
        ...(isProvider(user) ? [{ href: "/provider", label: "Provider Dashboard" }] : []),
        ...(isStaff(user) ? [{ href: "/verify", label: "Verification Queue" }] : []),
        ...(isAdmin(user) ? [{ href: "/admin", label: "Admin Dashboard" }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      {/* Utility bar */}
      <div className="hidden border-b bg-muted/60 lg:block">
        <div className="container-page flex min-h-10 items-center justify-end gap-5 text-sm">
          <nav aria-label="Utility">
            <ul className="flex items-center gap-5">
              {UTILITY_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="rounded font-semibold text-foreground underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
              {!user && (
                <li>
                  <Link href="/sign-in" className="rounded font-semibold text-primary underline-offset-4 hover:underline">
                    Sign In
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>

      <div className="container-page flex min-h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {user && (
            <Link
              href="/notifications"
              className="relative inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span aria-hidden className="absolute top-1.5 right-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <AccountMenu name={user.fullName} email={user.email} links={workspaceLinks} />
          ) : (
            <Link href="/sign-in" className="hidden min-h-11 items-center rounded-lg px-3 font-semibold text-primary hover:bg-muted sm:inline-flex lg:hidden">
              Sign In
            </Link>
          )}
          <MobileNav signedIn={!!user} workspaceLinks={workspaceLinks} />
        </div>
      </div>
    </header>
  );
}
