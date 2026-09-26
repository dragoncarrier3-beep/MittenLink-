import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/common/states";

export const metadata: Metadata = { title: "Not Authorized" };

export default function NotAuthorizedPage() {
  return (
    <div className="container-page py-12">
      <h1 className="sr-only">Not authorized</h1>
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="This area is limited to accounts with a specific role. If you think you should have access, contact a MittenLink administrator."
        action={{ label: "Go to My Account", href: "/account" }}
      />
    </div>
  );
}
