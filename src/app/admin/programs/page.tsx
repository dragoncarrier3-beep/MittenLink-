import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ListingList } from "@/components/admin/listing-list";
import type { SearchParams } from "@/components/admin/admin-labels";

export const metadata: Metadata = { title: "Programs" };

export default async function AdminProgramsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/programs");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Programs" }]}
        title="Programs"
        description="Programs run by organizations or independently. Open a record to change its verification or publication status."
      />
      <ListingList kind="program" searchParams={params} />
    </>
  );
}
