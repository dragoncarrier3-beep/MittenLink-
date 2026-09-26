import type { Metadata } from "next";
import Link from "next/link";
import { Copy } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/data/staff";
import { MIN_CONFIDENCE } from "@/lib/domain/dedupe";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { VerificationBadge } from "@/components/common/badges";
import { Pagination, parsePage } from "@/components/common/pagination";
import { ActionForm } from "@/components/staff/action-form";
import { DuplicateSignals } from "@/components/staff/duplicate-signals";
import { FilterNav } from "@/components/staff/filter-nav";
import { WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { scanDuplicatesAction } from "./actions";

export const metadata: Metadata = { title: "Potential Duplicates" };

const RESULTS: Record<string, string> = {
  scan: "Duplicate scan finished: {n} new suggestion(s) added for review.",
  kept_separate: "Marked as separate organizations. This pair won't be suggested again.",
  ignored: "Suggestion ignored. This pair won't be suggested again.",
};

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  open: { label: "Open", statuses: ["open"] },
  merged: { label: "Merged", statuses: ["merged"] },
  kept_separate: { label: "Kept Separate", statuses: ["kept_separate"] },
  ignored: { label: "Ignored", statuses: ["ignored"] },
  all: { label: "All", statuses: ["open", "merged", "kept_separate", "ignored"] },
};

interface Row {
  id: string; confidence: number; signals: Record<string, unknown>; status: string; created_at: Date; resolved_at: Date | null; resolver: string | null;
  a_title: string; a_status: string; a_pub: string; b_title: string; b_status: string; b_pub: string; total: number;
}

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/duplicates");
  const sp = await searchParams;
  const key = FILTERS[param(sp, "status") ?? ""] ? param(sp, "status")! : "open";
  const page = parsePage(sp.page);
  const [rows, counts] = await asService(async (sql) => {
    const rows = await sql.query<Row>(
      `select d.id, d.confidence, d.signals, d.status, d.created_at, d.resolved_at, rp.full_name as resolver,
         la.title as a_title, la.verification_status as a_status, la.publication_status as a_pub,
         lb.title as b_title, lb.verification_status as b_status, lb.publication_status as b_pub,
         (count(*) over ())::int as total
       from duplicate_suggestions d join listings la on la.id = d.listing_a join listings lb on lb.id = d.listing_b
       left join profiles rp on rp.id = d.resolved_by
       where d.status = any($1)
       order by (d.status = 'open') desc, d.confidence desc, d.created_at desc
       limit $2 offset $3`,
      [FILTERS[key].statuses, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from duplicate_suggestions group by status");
    return [rows, Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>] as const;
  });
  const result = resultFor(sp, RESULTS);
  const base = key === "open" ? "/admin/duplicates" : `/admin/duplicates?status=${key}`;

  return (
    <>
      <PageHeader
        title="Potential Duplicates"
        description="Records that may describe the same organization. Nothing is merged automatically — review each suggestion and decide."
        actions={<ActionForm action={scanDuplicatesAction} hidden={{}} size="default" buttons={[{ label: "Run duplicate scan", pendingLabel: "Scanning…", variant: "default" }]} />}
      />
      <ResultBanner message={result.message} warning={result.warning} />
      <p className="mb-5 text-sm text-muted-foreground">
        The scan compares published and pending providers by name similarity, website domain, phone, street address, ZIP code, and email, and suggests
        pairs with a confidence of {MIN_CONFIDENCE}% or more. Pairs already reviewed are not suggested again.
      </p>
      <FilterNav
        label="Filter suggestions by status"
        items={Object.entries(FILTERS).map(([k, f]) => ({
          href: k === "open" ? "/admin/duplicates" : `/admin/duplicates?status=${k}`,
          label: f.label,
          count: f.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0),
          active: k === key,
        }))}
      />
      <DataTable
        caption={`Duplicate suggestions — ${FILTERS[key].label}`}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "pair",
            header: "Records",
            primary: true,
            cell: (r) => (
              <Link href={`/admin/duplicates/${r.id}`} className="font-semibold text-primary underline underline-offset-2">
                {r.a_title} <span className="font-normal text-foreground">and</span> {r.b_title}
                <span className="sr-only"> — {r.status === "open" ? "review" : "view"} suggestion</span>
              </Link>
            ),
          },
          {
            key: "status_a",
            header: "Verification",
            cell: (r) => (
              <span className="flex flex-col gap-1">
                <VerificationBadge status={r.a_status} />
                <VerificationBadge status={r.b_status} />
              </span>
            ),
          },
          { key: "confidence", header: "Confidence", cell: (r) => <span className="text-lg font-bold">{r.confidence}%</span> },
          { key: "signals", header: "Signals", cell: (r) => <DuplicateSignals signals={r.signals} compact /> },
          { key: "found", header: "Found", cell: (r) => formatShortDate(r.created_at) },
          {
            key: "status",
            header: "Status",
            cell: (r) => (
              <span className="flex flex-col gap-1">
                <WorkflowStatus kind="duplicate" status={r.status} />
                {r.resolved_at && <span className="text-sm text-muted-foreground">{`${r.resolver ?? "Admin"}, ${formatShortDate(r.resolved_at)}`}</span>}
              </span>
            ),
          },
        ]}
        empty={
          <EmptyState
            icon={Copy}
            title={key === "open" ? "No open duplicate suggestions" : "No suggestions here"}
            description={key === "open" ? "Run a duplicate scan to look for providers that may be listed twice." : `There are no suggestions with the status “${FILTERS[key].label}”.`}
          />
        }
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Duplicate suggestion pages"
      />
    </>
  );
}
