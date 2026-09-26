import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ResourceForm } from "@/components/admin/resource-form";
import { getReferenceOptions } from "@/lib/data/admin-records";
import { saveGuideAction } from "../actions";

export const metadata: Metadata = { title: "New guide" };

export default async function NewGuidePage() {
  await requireAdmin("/admin/resources/new");
  const ref = await getReferenceOptions();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Guides & Resources", href: "/admin/resources" }, { label: "New guide" }]}
        title="New guide"
        description="Write a plain-language guide or add an informational resource. New guides are saved as Pending Review unless you mark them verified."
      />
      <ResourceForm action={saveGuideAction} categories={ref.categories} populations={ref.populations} />
    </>
  );
}
