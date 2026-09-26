import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getQueueCounts } from "@/lib/data/admin-counts";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | MittenLink Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin("/admin");
  const c = await getQueueCounts();
  const nav = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/organizations", label: "Organizations" },
    { href: "/admin/locations", label: "Locations" },
    { href: "/admin/services", label: "Services" },
    { href: "/admin/programs", label: "Programs" },
    { href: "/admin/resources", label: "Resources" },
    { href: "/admin/events", label: "Events" },
    { href: "/admin/claims", label: "Claims", count: c.claims },
    { href: "/admin/verification", label: "Verification", count: c.verification },
    { href: "/admin/changes", label: "Provider Edits", count: c.changes },
    { href: "/admin/submissions", label: "New Submissions", count: c.submissions },
    { href: "/admin/corrections", label: "Community Corrections", count: c.corrections },
    { href: "/admin/reports", label: "Family Reports", count: c.familyReports },
    { href: "/admin/source-watch", label: "Source Watch", count: c.sourceWatch },
    { href: "/admin/duplicates", label: "Potential Duplicates", count: c.duplicates },
    { href: "/admin/outreach", label: "Outreach", count: c.outreachDue },
    { href: "/admin/search-analytics", label: "Search Analytics" },
    { href: "/admin/billing", label: "Enhanced Listings" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/audit", label: "Audit Log" },
    ...(user.roles.includes("super_admin") ? [{ href: "/admin/settings", label: "Settings" }] : []),
  ];
  return (
    <WorkspaceShell label="Admin" title="Administration" nav={nav}>
      {children}
    </WorkspaceShell>
  );
}
