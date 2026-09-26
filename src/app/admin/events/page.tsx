import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ListingList } from "@/components/admin/listing-list";
import type { SearchParams } from "@/components/admin/admin-labels";

export const metadata: Metadata = { title: "Events" };

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/events");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Events" }]}
        title="Events"
        description="Workshops, support groups and community events. Open a record to change its verification or publication status."
      />
      <ListingList kind="event" searchParams={params} />
    </>
  );
}
