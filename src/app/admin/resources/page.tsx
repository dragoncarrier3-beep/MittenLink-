import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ListingList } from "@/components/admin/listing-list";
import type { SearchParams } from "@/components/admin/admin-labels";

export const metadata: Metadata = { title: "Guides & Resources" };

export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/resources");
  const params = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Guides & Resources" }]}
        title="Guides & Resources"
        description="Plain-language guides and informational resources. Create new guides or manage existing ones."
        actions={
          <Link href="/admin/resources/new" className={buttonVariants()}>
            <Plus aria-hidden /> New guide
          </Link>
        }
      />
      <ListingList kind="resource" searchParams={params} />
    </>
  );
}
