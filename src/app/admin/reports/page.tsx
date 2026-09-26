import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
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
import { formatDay, formatShortDate } from "@/lib/format";
import { EXPERIENCE_LABELS, RATING_LABELS, label } from "@/lib/labels";

export const metadata: Metadata = { title: "Family Reports" };

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  awaiting: { label: "Awaiting moderation", statuses: ["submitted", "under_review"] },
  submitted: { label: "Submitted", statuses: ["submitted"] },
  under_review: { label: "Under Review", statuses: ["under_review"] },
  approved: { label: "Approved", statuses: ["approved"] },
  rejected: { label: "Rejected", statuses: ["rejected"] },
  needs_clarification: { label: "Needs Clarification", statuses: ["needs_clarification"] },
  all: { label: "All", statuses: ["submitted", "under_review", "approved", "rejected", "needs_clarification"] },
};

interface Row {
  id: string; org_title: string; service_title: string | null; service_type: string; approx_service_month: Date | string | null; experience_category: string;
  accessibility_rating: string; communication_rating: string; comments: string | null; publish_anonymously: boolean; contact_email: string | null;
  status: string; created_at: Date; total: number;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/reports");
  const sp = await searchParams;
  const key = FILTERS[param(sp, "status") ?? ""] ? param(sp, "status")! : "awaiting";
  const page = parsePage(sp.page);
  const [rows, counts] = await asService(async (sql) => {
    const rows = await sql.query<Row>(
      `select r.id, l.title as org_title, sl.title as service_title, r.service_type, r.approx_service_month, r.experience_category, r.accessibility_rating,
         r.communication_rating, r.comments, r.publish_anonymously, r.contact_email, r.status, r.created_at, (count(*) over ())::int as total
       from family_experience_reports r join listings l on l.id = r.organization_id left join listings sl on sl.id = r.service_id
       where r.status = any($1)
       order by case r.status when 'submitted' then 0 when 'under_review' then 1 else 2 end, r.created_at desc
       limit $2 offset $3`,
      [FILTERS[key].statuses, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from family_experience_reports group by status");
    return [rows, Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>] as const;
  });
  const base = key === "awaiting" ? "/admin/reports" : `/admin/reports?status=${key}`;

  return (
    <>
      <PageHeader
        title="Family Experience Reports"
        description="Moderate reports from families before anything is published. Reports are published anonymously, and only when the family gave permission."
      />
      <p className="mb-5 rounded-lg border border-warning/40 bg-warning-soft p-4">
        <strong>Reminder:</strong> reports must not contain private medical information, names of other people, or anything that could identify a family.
        Reject or ask for clarification when a report includes those details.
      </p>
      <FilterNav
        label="Filter reports by status"
        items={Object.entries(FILTERS).map(([k, f]) => ({
          href: k === "awaiting" ? "/admin/reports" : `/admin/reports?status=${k}`,
          label: f.label,
          count: f.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0),
          active: k === key,
        }))}
      />
      <DataTable
        caption={`Family experience reports — ${FILTERS[key].label}`}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "provider",
            header: "Provider",
            primary: true,
            cell: (r) => (
              <Link href={`/admin/reports/${r.id}`} className="font-semibold text-primary underline underline-offset-2">
                {r.org_title}
                <span className="sr-only"> — moderate report from {formatShortDate(r.created_at)}</span>
              </Link>
            ),
          },
          { key: "service", header: "Service", cell: (r) => r.service_title ?? r.service_type },
          { key: "month", header: "Approx. month", cell: (r) => (r.approx_service_month ? formatDay(r.approx_service_month, { month: "long", year: "numeric" }) : "—") },
          {
            key: "ratings",
            header: "Experience & ratings",
            cell: (r) => (
              <span className="flex flex-col text-sm">
                <span>Overall: {label(EXPERIENCE_LABELS, r.experience_category)}</span>
                <span>Accessibility: {label(RATING_LABELS, r.accessibility_rating)}</span>
                <span>Communication: {label(RATING_LABELS, r.communication_rating)}</span>
              </span>
            ),
          },
          { key: "comments", header: "Comments", cell: (r) => <span className="line-clamp-4 text-sm">{r.comments ?? "No comments"}</span> },
          { key: "publish", header: "Publish permission", cell: (r) => (r.publish_anonymously ? "Yes, anonymously" : "No — do not publish") },
          { key: "email", header: "Contact (private)", cell: (r) => <span className="break-all">{r.contact_email ?? "Not provided"}</span> },
          { key: "status", header: "Status", cell: (r) => <WorkflowStatus kind="report" status={r.status} /> },
        ]}
        empty={<EmptyState icon={MessagesSquare} title="No reports here" description={`There are no reports with the status “${FILTERS[key].label}”.`} />}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Report pages"
      />
    </>
  );
}
