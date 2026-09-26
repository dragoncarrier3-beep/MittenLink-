import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ListingList } from "@/components/admin/listing-list";
import type { SearchParams } from "@/components/admin/admin-labels";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/services");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Services" }]}
        title="Services"
        description="Every service offered by an organization. Open a record to change its verification or publication status."
      />
      <ListingList kind="service" searchParams={params} />
    </>
  );
}
