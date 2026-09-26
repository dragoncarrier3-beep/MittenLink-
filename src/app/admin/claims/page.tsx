import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/data/staff";
import { DomainMatch } from "@/components/staff/domain-match";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterNav } from "@/components/staff/filter-nav";
import { WorkflowStatus } from "@/components/staff/pills";
import { param, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { CLAIM_RELATIONSHIP_LABELS, label } from "@/lib/labels";

export const metadata: Metadata = { title: "Provider Claims" };

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  awaiting: { label: "Awaiting review", statuses: ["submitted", "under_review"] },
  submitted: { label: "Submitted", statuses: ["submitted"] },
  under_review: { label: "Under Review", statuses: ["under_review"] },
  more_info_required: { label: "More Information Required", statuses: ["more_info_required"] },
  approved: { label: "Approved", statuses: ["approved"] },
  rejected: { label: "Rejected", statuses: ["rejected"] },
  all: { label: "All", statuses: ["submitted", "under_review", "more_info_required", "approved", "rejected"] },
};

interface ClaimRow {
  id: string;
  org_title: string;
  claimant_name: string;
  claimant_title: string;
  relationship: string;
  work_email: string;
  website: string | null;
  submitted_at: Date | null;
  status: string;
  total: number;
}

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/claims");
  const sp = await searchParams;
  const key = FILTERS[param(sp, "status") ?? ""] ? param(sp, "status")! : "awaiting";
  const page = parsePage(sp.page);
  const [rows, counts] = await asService(async (sql) => {
    const rows = await sql.query<ClaimRow>(
      `select c.id, l.title as org_title, c.claimant_name, c.claimant_title, c.relationship, c.work_email, o.website, c.submitted_at, c.status,
         (count(*) over ())::int as total
       from provider_claims c join listings l on l.id = c.organization_id join organizations o on o.id = c.organization_id
       where c.status = any($1)
       order by case c.status when 'submitted' then 0 when 'under_review' then 1 when 'more_info_required' then 2 else 3 end, c.submitted_at desc nulls last
       limit $2 offset $3`,
      [FILTERS[key].statuses, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from provider_claims where status <> 'draft' group by status");
    return [rows, Object.fromEntries(counts.map((r) => [r.status, r.n])) as Record<string, number>] as const;
  });
  const countFor = (k: string) => FILTERS[k].statuses.reduce((s, st) => s + (counts[st] ?? 0), 0);
  const base = key === "awaiting" ? "/admin/claims" : `/admin/claims?status=${key}`;

  return (
    <>
      <PageHeader title="Provider Claims" description="Review requests from people who want to manage an organization's listing. Approving a claim grants provider management access." />
      <FilterNav
        label="Filter claims by status"
        items={Object.entries(FILTERS).map(([k, f]) => ({ href: k === "awaiting" ? "/admin/claims" : `/admin/claims?status=${k}`, label: f.label, count: countFor(k), active: k === key }))}
      />
      <DataTable
        caption={`Provider claims — ${FILTERS[key].label}`}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "org",
            header: "Organization",
            primary: true,
            cell: (r) => (
              <Link href={`/admin/claims/${r.id}`} className="font-semibold text-primary underline underline-offset-2">
                {r.org_title}
                <span className="sr-only"> — review claim by {r.claimant_name}</span>
              </Link>
            ),
          },
          { key: "claimant", header: "Claimant", cell: (r) => r.claimant_name },
          { key: "role", header: "Role / title", cell: (r) => `${r.claimant_title} (${label(CLAIM_RELATIONSHIP_LABELS, r.relationship)})` },
          {
            key: "email",
            header: "Work email",
            cell: (r) => (
              <span className="flex flex-col">
                <span className="break-all">{r.work_email}</span>
                <DomainMatch email={r.work_email} website={r.website} />
              </span>
            ),
          },
          { key: "submitted", header: "Submitted", cell: (r) => (r.submitted_at ? formatShortDate(r.submitted_at) : "—") },
          { key: "status", header: "Status", cell: (r) => <WorkflowStatus kind="claim" status={r.status} /> },
        ]}
        empty={<EmptyState icon={FileCheck2} title="No claims here" description={`There are no claims with the status “${FILTERS[key].label}”.`} />}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Claims pages"
      />
    </>
  );
}
