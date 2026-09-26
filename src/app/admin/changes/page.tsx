import type { Metadata } from "next";
import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/data/staff";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterNav } from "@/components/staff/filter-nav";
import { WorkflowStatus } from "@/components/staff/pills";
import { param, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { KIND_LABELS, label } from "@/lib/labels";

export const metadata: Metadata = { title: "Provider Edits" };

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  pending_review: { label: "Pending Review", statuses: ["pending_review"] },
  more_info_required: { label: "More Information Required", statuses: ["more_info_required"] },
  approved: { label: "Approved", statuses: ["approved"] },
  rejected: { label: "Rejected", statuses: ["rejected"] },
  all: { label: "All", statuses: ["pending_review", "more_info_required", "approved", "rejected", "withdrawn"] },
};

interface Row {
  id: string;
  org_title: string;
  target_type: string;
  target_label: string | null;
  action: string;
  summary: string;
  fields: string[];
  submitted_by: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  status: string;
  task_id: string | null;
  task_status: string | null;
  total: number;
}

export default async function ChangesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/changes");
  const sp = await searchParams;
  const key = FILTERS[param(sp, "status") ?? ""] ? param(sp, "status")! : "pending_review";
  const page = parsePage(sp.page);
  const [rows, counts] = await asService(async (sql) => {
    const rows = await sql.query<Row>(
      `select cr.id, l.title as org_title, cr.target_type, cr.action, cr.summary, cr.created_at, cr.reviewed_at, cr.status,
         array(select jsonb_object_keys(cr.proposed)) as fields,
         p.full_name as submitted_by,
         case when cr.target_type = 'location' then (select ol.name from organization_locations ol where ol.id = cr.target_id)
              else (select tl.title from listings tl where tl.id = cr.target_id) end as target_label,
         t.id as task_id, t.status as task_status,
         (count(*) over ())::int as total
       from provider_change_requests cr
       join listings l on l.id = cr.organization_id
       left join profiles p on p.id = cr.submitted_by
       left join lateral (select vt.id, vt.status from verification_tasks vt where vt.change_request_id = cr.id order by vt.created_at desc limit 1) t on true
       where cr.status = any($1)
       order by case when cr.status in ('pending_review', 'more_info_required') then cr.created_at end asc nulls last, coalesce(cr.reviewed_at, cr.created_at) desc
       limit $2 offset $3`,
      [FILTERS[key].statuses, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from provider_change_requests group by status");
    return [rows, Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>] as const;
  });
  const base = key === "pending_review" ? "/admin/changes" : `/admin/changes?status=${key}`;

  return (
    <>
      <PageHeader
        title="Provider Edits"
        description="Changes providers have proposed to their listings. Each edit is reviewed on its verification task before anything is published."
      />
      <FilterNav
        label="Filter provider edits by status"
        items={Object.entries(FILTERS).map(([k, f]) => ({
          href: k === "pending_review" ? "/admin/changes" : `/admin/changes?status=${k}`,
          label: f.label,
          count: f.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0),
          active: k === key,
        }))}
      />
      <DataTable
        caption={`Provider edit requests — ${FILTERS[key].label}`}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "org", header: "Organization", primary: true, cell: (r) => r.org_title },
          {
            key: "target",
            header: "What changes",
            cell: (r) => (
              <span>
                {r.target_type === "location" ? "Location" : label(KIND_LABELS, r.target_type)}
                {r.target_label ? `: ${r.target_label}` : ""}
                {r.action === "create" ? " (new)" : ""}
                <span className="block text-sm text-muted-foreground">{r.fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</span>
              </span>
            ),
          },
          { key: "summary", header: "Summary", cell: (r) => r.summary },
          { key: "by", header: "Submitted by", cell: (r) => r.submitted_by ?? "Provider" },
          { key: "date", header: "Submitted", cell: (r) => formatShortDate(r.created_at) },
          { key: "status", header: "Status", cell: (r) => <WorkflowStatus kind="change" status={r.status} /> },
          {
            key: "review",
            header: "Review",
            cell: (r) =>
              r.task_id ? (
                <Link href={`/verify/tasks/${r.task_id}?from=admin`} className="font-semibold text-primary underline underline-offset-2">
                  {["open", "in_progress", "escalated"].includes(r.task_status ?? "") ? "Review" : "View task"}
                  <span className="sr-only"> edit for {r.org_title}</span>
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">No review task on file</span>
              ),
          },
        ]}
        empty={<EmptyState icon={FilePenLine} title="No provider edits here" description={`There are no edit requests with the status “${FILTERS[key].label}”.`} />}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Provider edit pages"
      />
    </>
  );
}
