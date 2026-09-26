import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getLookups, getOrganizationOptions } from "@/lib/data/operations";
import { PageHeader, Panel } from "@/components/common/page";
import { OutreachContactForm } from "@/components/operations/outreach-forms";

export const metadata: Metadata = { title: "Add Outreach Contact" };

export default async function NewOutreachPage() {
  await requireAdmin("/admin/outreach/new");
  const [organizations, { admins }] = await Promise.all([getOrganizationOptions(), getLookups()]);
  return (
    <>
      <PageHeader
        title="Add an outreach contact"
        description="Record a person at an organization you plan to contact about their MittenLink listing."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Outreach", href: "/admin/outreach" }, { label: "Add contact" }]}
      />
      <Panel className="max-w-2xl">
        <OutreachContactForm organizations={organizations} admins={admins.map((a) => ({ value: a.id, label: a.full_name }))} />
      </Panel>
    </>
  );
}
