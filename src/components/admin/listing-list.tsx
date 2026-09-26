import Link from "next/link";
import { ListChecks } from "lucide-react";
import { DataTable, type Column } from "@/components/common/data-table";
import { VerificationBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { listListings, PAGE_SIZE, type ChildKind, type ListingRow } from "@/lib/data/admin-records";
import { formatDateTime, formatDay, formatShortDate } from "@/lib/format";
import { EVENT_TYPE_LABELS, label, RESOURCE_TYPE_LABELS, VERIFICATION_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { FilterBar, ResultSummary, type FilterDef } from "./filter-bar";
import { DemoFlag, PublicationPill } from "./record-parts";
import { hrefWith, optionsFrom, PUBLICATION_LABELS, sp, type SearchParams } from "./admin-labels";

const NOUN: Record<ChildKind, string> = { service: "services", program: "programs", resource: "guides and resources", event: "events" };
export const KIND_BASE: Record<ChildKind, string> = { service: "/admin/services", program: "/admin/programs", resource: "/admin/resources", event: "/admin/events" };

/** Shared admin list for services, programs, resources and events. */
export async function ListingList({ kind, searchParams }: { kind: ChildKind; searchParams: SearchParams }) {
  const base = KIND_BASE[kind];
  const current = {
    q: sp(searchParams.q),
    verification: sp(searchParams.verification),
    publication: sp(searchParams.publication),
    when: kind === "event" ? sp(searchParams.when) : undefined,
    type: kind === "event" || kind === "resource" ? sp(searchParams.type) : undefined,
  };
  const page = parsePage(searchParams.page);
  const { rows, total } = await listListings(kind, { ...current, page });

  const filters: FilterDef[] = [
    { name: "verification", label: "Verification", options: optionsFrom(VERIFICATION_LABELS), value: current.verification },
    { name: "publication", label: "Publication", options: optionsFrom(PUBLICATION_LABELS), value: current.publication },
  ];
  if (kind === "event") {
    filters.push({ name: "when", label: "Dates", options: [{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }], value: current.when, allLabel: "All dates" });
    filters.push({ name: "type", label: "Event type", options: optionsFrom(EVENT_TYPE_LABELS), value: current.type });
  }
  if (kind === "resource") filters.push({ name: "type", label: "Resource type", options: optionsFrom(RESOURCE_TYPE_LABELS), value: current.type });

  const columns: Column<ListingRow>[] = [
    {
      key: "title",
      header: "Title",
      primary: true,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <Link href={`${base}/${r.id}`} className="text-primary underline">
            {r.title}
          </Link>
          <DemoFlag show={r.is_demo} />
        </span>
      ),
    },
    {
      key: "org",
      header: kind === "resource" ? "Publisher" : "Organization",
      cell: (r) =>
        r.org_id ? (
          <Link href={`/admin/organizations/${r.org_id}`} className="underline">
            {r.org_title}
          </Link>
        ) : (
          <span className="text-muted-foreground">{kind === "resource" ? "MittenLink" : "Independent"}</span>
        ),
    },
  ];
  if (kind === "resource") columns.push({ key: "type", header: "Type", cell: (r) => label(RESOURCE_TYPE_LABELS, r.resource_type) });
  if (kind === "event") {
    columns.push({ key: "dates", header: "Dates", cell: (r) => <span>{formatDateTime(r.starts_at)}</span> });
    columns.push({ key: "etype", header: "Type", cell: (r) => label(EVENT_TYPE_LABELS, r.event_type) });
  }
  columns.push(
    { key: "verification", header: "Verification", cell: (r) => <VerificationBadge status={r.verification_status} /> },
    { key: "publication", header: "Publication", cell: (r) => <PublicationPill status={r.publication_status} /> },
    { key: "verified", header: "Last verified", cell: (r) => (r.last_verified_at ? formatShortDate(r.last_verified_at) : <span className="text-muted-foreground">Never</span>) },
    { key: "review", header: "Next review", cell: (r) => (r.next_review_at ? formatDay(r.next_review_at, { month: "short", day: "numeric", year: "numeric" }) : "—") },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <Link href={`${base}/${r.id}`} className="font-semibold text-primary underline">
            Manage<span className="sr-only"> {r.title}</span>
          </Link>
          {r.publication_status === "published" && (
            <Link href={listingHref(r.kind, r.slug)} className="underline">
              Public page<span className="sr-only"> for {r.title}</span>
            </Link>
          )}
        </span>
      ),
    },
  );

  return (
    <>
      <FilterBar action={base} q={current.q} searchLabel="Search by title or organization" filters={filters} />
      <ResultSummary total={total} page={page} pageSize={PAGE_SIZE} noun={NOUN[kind]} />
      <DataTable
        caption={`Admin list of ${NOUN[kind]}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={ListChecks} title={`No ${NOUN[kind]} found`} description="Try a different search or clear the filters." />}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => hrefWith(base, current, { page: p })} label={`${NOUN[kind]} pages`} />
    </>
  );
}
