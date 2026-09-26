import type { Metadata } from "next";
import { requireUser, isAdmin, isProvider, isStaff } from "@/lib/auth";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export const metadata: Metadata = { title: { default: "My Account", template: "%s | MittenLink Account" } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <WorkspaceShell
      label="Account"
      title="My Account"
      nav={[
        { href: "/account", label: "Overview", exact: true },
        { href: "/account/saved", label: "Saved Resources" },
        { href: "/account/searches", label: "Saved Searches" },
        { href: "/account/reports", label: "My Reports" },
        { href: "/account/claims", label: "My Claims" },
        { href: "/account/profile", label: "Profile" },
        { href: "/notifications", label: "Notifications" },
        ...(isProvider(user) ? [{ href: "/provider", label: "Provider Dashboard" }] : []),
        ...(isStaff(user) ? [{ href: "/verify", label: "Verification Queue" }] : []),
        ...(isAdmin(user) ? [{ href: "/admin", label: "Admin Dashboard" }] : []),
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
