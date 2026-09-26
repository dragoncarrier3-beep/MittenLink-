import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { DataTable, type Column } from "@/components/common/data-table";
import { ListingTierBadge, VerificationBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterBar, ResultSummary } from "@/components/admin/filter-bar";
import { DemoFlag, PublicationPill } from "@/components/admin/record-parts";
import { hrefWith, optionsFrom, PUBLICATION_LABELS, sp, type SearchParams } from "@/components/admin/admin-labels";
import { getReferenceOptions, listOrganizations, PAGE_SIZE, type OrgListRow } from "@/lib/data/admin-records";
import { formatShortDate } from "@/lib/format";
import { label, ORG_TYPE_LABELS, VERIFICATION_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Organizations" };

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/organizations");
  const params = await searchParams;
  const current = {
    q: sp(params.q),
    verification: sp(params.verification),
    tier: sp(params.tier),
    claimed: sp(params.claimed),
    county: sp(params.county),
    region: sp(params.region),
    publication: sp(params.publication),
  };
  const page = parsePage(params.page);
  const [{ rows, total }, ref] = await Promise.all([listOrganizations({ ...current, page }), getReferenceOptions()]);

  const columns: Column<OrgListRow>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <Link href={`/admin/organizations/${r.id}`} className="text-primary underline">
            {r.title}
          </Link>
          <DemoFlag show={r.is_demo} />
        </span>
      ),
    },
    { key: "type", header: "Type", cell: (r) => label(ORG_TYPE_LABELS, r.org_type) },
    {
      key: "where",
      header: "City / County",
      cell: (r) => (r.primary_city || r.county ? [r.primary_city, r.county ? `${r.county} County` : null].filter(Boolean).join(", ") : <span className="text-muted-foreground">Statewide / virtual</span>),
    },
    { key: "counts", header: "Locations / Services", cell: (r) => `${r.locations} / ${r.services}` },
    { key: "verification", header: "Verification", cell: (r) => <VerificationBadge status={r.verification_status} /> },
    { key: "tier", header: "Listing tier", cell: (r) => <ListingTierBadge tier={r.listing_tier} showFree /> },
    { key: "claimed", header: "Claimed", cell: (r) => (r.claimed ? "Yes" : "No") },
    { key: "publication", header: "Publication", cell: (r) => <PublicationPill status={r.publication_status} /> },
    { key: "verified", header: "Last verified", cell: (r) => (r.last_verified_at ? formatShortDate(r.last_verified_at) : <span className="text-muted-foreground">Never</span>) },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organizations" }]}
        title="Organizations"
        description="Every provider organization in the directory. Open a record to edit details, manage verification and publication, or review managers and contact sources."
      />
      <FilterBar
        action="/admin/organizations"
        q={current.q}
        searchLabel="Search by organization name"
        filters={[
          { name: "verification", label: "Verification", options: optionsFrom(VERIFICATION_LABELS), value: current.verification },
          { name: "tier", label: "Listing tier", options: [{ value: "free", label: "Free Listing" }, { value: "enhanced", label: "Enhanced Listing" }], value: current.tier },
          { name: "claimed", label: "Claimed", options: [{ value: "yes", label: "Claimed" }, { value: "no", label: "Not claimed" }], value: current.claimed },
          { name: "publication", label: "Publication", options: optionsFrom(PUBLICATION_LABELS), value: current.publication },
          { name: "region", label: "Region", options: ref.regions, value: current.region, allLabel: "All regions" },
          { name: "county", label: "County", options: ref.counties, value: current.county, allLabel: "All counties" },
        ]}
      />
      <ResultSummary total={total} page={page} pageSize={PAGE_SIZE} noun="organizations" />
      <DataTable
        caption="Organizations"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={Building2} title="No organizations found" description="Try a different search or clear the filters." />}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => hrefWith("/admin/organizations", current, { page: p })} label="Organization pages" />
    </>
  );
}
