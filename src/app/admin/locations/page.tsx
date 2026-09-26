import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterBar, ResultSummary } from "@/components/admin/filter-bar";
import { YesNo } from "@/components/admin/record-parts";
import { StatusPill } from "@/components/common/badges";
import { hrefWith, LOCATION_STATUS_LABELS, optionsFrom, sp, type SearchParams } from "@/components/admin/admin-labels";
import { getReferenceOptions, listLocations, PAGE_SIZE } from "@/lib/data/admin-records";
import { label } from "@/lib/labels";

export const metadata: Metadata = { title: "Locations" };

export default async function AdminLocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/locations");
  const params = await searchParams;
  const current = { q: sp(params.q), county: sp(params.county), status: sp(params.status), accessible: sp(params.accessible) };
  const page = parsePage(params.page);
  const [{ rows, total }, ref] = await Promise.all([listLocations({ ...current, page }), getReferenceOptions()]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Locations" }]}
        title="Locations"
        description="Every physical location across all organizations. Locations are managed from their organization's admin page."
      />
      <FilterBar
        action="/admin/locations"
        q={current.q}
        searchLabel="Search by location, organization or city"
        filters={[
          { name: "county", label: "County", options: ref.counties, value: current.county, allLabel: "All counties" },
          { name: "status", label: "Status", options: optionsFrom(LOCATION_STATUS_LABELS), value: current.status },
          {
            name: "accessible",
            label: "Wheelchair accessible",
            options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not recorded" }],
            value: current.accessible,
          },
        ]}
      />
      <ResultSummary total={total} page={page} pageSize={PAGE_SIZE} noun="locations" />
      <DataTable
        caption="Locations"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={MapPin} title="No locations found" description="Try a different search or clear the filters." />}
        columns={[
          {
            key: "org",
            header: "Organization",
            primary: true,
            cell: (r) => (
              <Link href={`/admin/organizations/${r.organization_id}#locations`} className="text-primary underline">
                {r.org_title}
              </Link>
            ),
          },
          { key: "name", header: "Location", cell: (r) => <span>{r.name}{r.is_primary && <span className="ml-1 text-sm text-muted-foreground">(Primary)</span>}</span> },
          { key: "address", header: "Address", cell: (r) => `${r.street}, ${r.city} ${r.zip}` },
          { key: "county", header: "County", cell: (r) => `${r.county} County` },
          { key: "access", header: "Wheelchair accessible", cell: (r) => <YesNo value={r.wheelchair_accessible} /> },
          {
            key: "status",
            header: "Status",
            cell: (r) => <StatusPill tone={r.status === "open" ? "success" : r.status === "closed" ? "danger" : "warning"}>{label(LOCATION_STATUS_LABELS, r.status)}</StatusPill>,
          },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => hrefWith("/admin/locations", current, { page: p })} label="Location pages" />
    </>
  );
}
