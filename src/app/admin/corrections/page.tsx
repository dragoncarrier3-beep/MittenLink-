import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/data/staff";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { Pagination, parsePage } from "@/components/common/pagination";
import { ActionForm } from "@/components/staff/action-form";
import { FilterNav } from "@/components/staff/filter-nav";
import { WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { CORRECTION_ISSUE_LABELS, KIND_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { correctionAction } from "./actions";

export const metadata: Metadata = { title: "Community Corrections" };

const RESULTS: Record<string, string> = {
  in_review: "Correction marked In Review.",
  dismiss: "Correction dismissed. Any task opened only for it was cancelled.",
  create_task: "Verification task created. It is now in the unassigned verification queue.",
};

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  open: { label: "Open", statuses: ["new", "in_review"] },
  new: { label: "New", statuses: ["new"] },
  in_review: { label: "In Review", statuses: ["in_review"] },
  resolved: { label: "Resolved", statuses: ["resolved"] },
  dismissed: { label: "Dismissed", statuses: ["dismissed"] },
  all: { label: "All", statuses: ["new", "in_review", "resolved", "dismissed"] },
};

interface Row {
  id: string; listing_id: string; title: string; kind: string; slug: string; publication_status: string; issue_type: string; details: string;
  email: string | null; submitter_name: string | null; status: string; created_at: Date; task_id: string | null; task_open: boolean | null; total: number;
}

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/corrections");
  const sp = await searchParams;
  const key = FILTERS[param(sp, "status") ?? ""] ? param(sp, "status")! : "open";
  const page = parsePage(sp.page);
  const [rows, counts] = await asService(async (sql) => {
    const rows = await sql.query<Row>(
      `select cc.id, cc.listing_id, l.title, l.kind, l.slug, l.publication_status, cc.issue_type, cc.details, coalesce(cc.submitter_email, p.email) as email,
         p.full_name as submitter_name, cc.status, cc.created_at, t.id as task_id, t.status in ('open', 'in_progress', 'escalated') as task_open,
         (count(*) over ())::int as total
       from community_corrections cc join listings l on l.id = cc.listing_id left join profiles p on p.id = cc.submitter_user_id
       left join lateral (select vt.id, vt.status from verification_tasks vt where vt.correction_id = cc.id order by vt.created_at desc limit 1) t on true
       where cc.status = any($1)
       order by case cc.status when 'new' then 0 when 'in_review' then 1 else 2 end, cc.created_at desc
       limit $2 offset $3`,
      [FILTERS[key].statuses, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from community_corrections group by status");
    return [rows, Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>] as const;
  });
  const result = resultFor(sp, RESULTS);
  const base = key === "open" ? "/admin/corrections" : `/admin/corrections?status=${key}`;

  return (
    <>
      <PageHeader title="Community Corrections" description="Reports of outdated information from the public. Submitter contact details are private and visible to staff only." />
      <ResultBanner message={result.message} warning={result.warning} />
      <FilterNav
        label="Filter corrections by status"
        items={Object.entries(FILTERS).map(([k, f]) => ({
          href: k === "open" ? "/admin/corrections" : `/admin/corrections?status=${k}`,
          label: f.label,
          count: f.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0),
          active: k === key,
        }))}
      />
      <DataTable
        caption={`Community corrections — ${FILTERS[key].label}`}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "record",
            header: "Record",
            primary: true,
            cell: (r) => (
              <span>
                {r.publication_status === "published" ? (
                  <Link href={listingHref(r.kind, r.slug)} className="text-primary underline underline-offset-2">
                    {r.title}
                    <span className="sr-only"> (public page)</span>
                  </Link>
                ) : (
                  r.title
                )}
                <span className="block text-sm font-normal text-muted-foreground">{label(KIND_LABELS, r.kind)}</span>
              </span>
            ),
          },
          { key: "issue", header: "Issue", cell: (r) => label(CORRECTION_ISSUE_LABELS, r.issue_type) },
          { key: "details", header: "Details", cell: (r) => <span className="whitespace-pre-line">{r.details}</span> },
          {
            key: "email",
            header: "Submitter (private)",
            cell: (r) => (
              <span className="break-all">
                {r.submitter_name ? `${r.submitter_name} — ` : ""}
                {r.email ?? "No email provided"}
              </span>
            ),
          },
          { key: "date", header: "Reported", cell: (r) => formatShortDate(r.created_at) },
          { key: "status", header: "Status", cell: (r) => <WorkflowStatus kind="correction" status={r.status} /> },
          {
            key: "actions",
            header: "Actions",
            srOnlyHeader: true,
            cell: (r) => {
              const open = ["new", "in_review"].includes(r.status);
              return (
                <div className="flex flex-col gap-2">
                  {r.task_id && (
                    <Link href={`/verify/tasks/${r.task_id}?from=admin`} className="text-sm font-semibold text-primary underline underline-offset-2">
                      {r.task_open ? "Open task" : "View task"}
                      <span className="sr-only"> for {r.title}</span>
                    </Link>
                  )}
                  {open && (
                    <ActionForm
                      action={correctionAction}
                      hidden={{ correctionId: r.id, returnTo: base }}
                      buttons={[
                        ...(r.status === "new" ? [{ label: "Mark in review", value: "in_review" }] : []),
                        ...(!r.task_open ? [{ label: "Create verification task", value: "create_task" }] : []),
                        { label: "Dismiss", value: "dismiss" },
                      ]}
                    />
                  )}
                </div>
              );
            },
          },
        ]}
        empty={<EmptyState icon={MessageSquareWarning} title="No corrections here" description={`There are no corrections with the status “${FILTERS[key].label}”.`} />}
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Correction pages"
      />
    </>
  );
}
