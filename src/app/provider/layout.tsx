import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/provider/active-org";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { EmptyState } from "@/components/common/states";
import { OrgSwitcher } from "./org-switcher";

export const metadata: Metadata = { title: { default: "Provider Dashboard", template: "%s | MittenLink Provider" } };

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/provider");
  const active = await getActiveOrganization(user);
  if (!active) {
    return (
      <div className="container-page py-10">
        <h1 className="mb-6 text-3xl font-bold">Provider Dashboard</h1>
        <EmptyState
          icon={Building2}
          title="You don't manage any organizations yet"
          description="Find your organization on MittenLink and submit a claim. Once an administrator approves it, you can manage your listing here."
          action={{ label: "Claim a Provider", href: "/claim" }}
        />
      </div>
    );
  }
  return (
    <WorkspaceShell
      label="Provider"
      title="Provider Dashboard"
      context={<OrgSwitcher organizations={user.organizations} activeId={active.id} />}
      nav={[
        { href: "/provider", label: "Overview", exact: true },
        { href: "/provider/organization", label: "Organization" },
        { href: "/provider/locations", label: "Locations" },
        { href: "/provider/services", label: "Services" },
        { href: "/provider/programs", label: "Programs" },
        { href: "/provider/events", label: "Events" },
        { href: "/provider/verification", label: "Verification & Updates" },
        { href: "/provider/plan", label: "Listing Plan" },
        { href: "/provider/analytics", label: "Listing Analytics" },
        { href: "/account", label: "Account" },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
