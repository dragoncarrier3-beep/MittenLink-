import type { Metadata } from "next";
import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import { isSuperAdmin, requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { FilterBar, ResultSummary } from "@/components/admin/filter-bar";
import { hrefWith, prettyJson, sp, type SearchParams } from "@/components/admin/admin-labels";
import { auditFilterOptions, listAudit, PAGE_SIZE, type AuditRow } from "@/lib/data/admin-records";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const hasData = (v: unknown) => v !== null && v !== undefined && !(typeof v === "object" && Object.keys(v as object).length === 0);

function AuditDetails({ row }: { row: AuditRow }) {
  if (!hasData(row.previous_state) && !hasData(row.new_state) && !hasData(row.metadata)) {
    return <span className="text-sm text-muted-foreground">No details</span>;
  }
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline">
        Details<span className="sr-only"> for {row.action} on {row.entity_label ?? row.entity_type}</span>
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {hasData(row.previous_state) && (
          <div>
            <p className="text-sm font-bold">Previous state</p>
            <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-foreground p-3 text-sm whitespace-pre-wrap text-background">{prettyJson(row.previous_state)}</pre>
          </div>
        )}
        {hasData(row.new_state) && (
          <div>
            <p className="text-sm font-bold">New state</p>
            <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-foreground p-3 text-sm whitespace-pre-wrap text-background">{prettyJson(row.new_state)}</pre>
          </div>
        )}
        {hasData(row.metadata) && (
          <div>
            <p className="text-sm font-bold">Context</p>
            <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap text-foreground">{prettyJson(row.metadata)}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAdmin("/admin/audit");
  const includeSensitive = isSuperAdmin(user);
  const params = await searchParams;
  const current = { action: sp(params.action), entity: sp(params.entity), actor: sp(params.actor), from: sp(params.from), to: sp(params.to) };
  const page = parsePage(params.page);
  const [{ rows, total }, options] = await Promise.all([listAudit({ ...current, page }, includeSensitive), auditFilterOptions(includeSensitive)]);
  const toOptions = (list: string[]) => list.map((v) => ({ value: v, label: v }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit log" }]}
        title="Audit log"
        description="A permanent record of important changes: who did what, when, and what changed."
        actions={
          <Link href={hrefWith("/admin/audit/export", current)} className={buttonVariants({ variant: "outline" })} prefetch={false}>
            <Download aria-hidden /> Export CSV
          </Link>
        }
      />
      <p className="mb-5 rounded-lg border border-info/30 bg-info-soft p-4 text-foreground">
        Audit entries are append-only and cannot be edited or deleted.
        {!includeSensitive && " Role and platform-setting changes are visible to Super Administrators only."}
      </p>
      <FilterBar
        action="/admin/audit"
        filters={[
          { name: "action", label: "Action", options: toOptions(options.actions), value: current.action, allLabel: "All actions" },
          { name: "entity", label: "Record type", options: toOptions(options.entities), value: current.entity, allLabel: "All record types" },
          { name: "actor", label: "User", options: toOptions(options.actors), value: current.actor, allLabel: "All users" },
        ]}
        dateRange={{ from: current.from, to: current.to }}
        hideSearch
      />
      <ResultSummary total={total} page={page} pageSize={PAGE_SIZE} noun="audit entries" />
      <DataTable
        caption="Audit entries, newest first"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={ScrollText} title="No audit entries match" description="Try widening the date range or clearing the filters." />}
        columns={[
          {
            key: "when",
            header: "Timestamp",
            primary: true,
            className: "w-44",
            cell: (r) => <time dateTime={new Date(r.created_at).toISOString()} className="font-normal">{formatDateTime(r.created_at)}</time>,
          },
          { key: "user", header: "User", cell: (r) => r.actor_label ?? "System" },
          { key: "action", header: "Action", cell: (r) => <code className="rounded bg-muted px-1.5 py-0.5 text-sm break-all">{r.action}</code> },
          { key: "type", header: "Entity type", cell: (r) => r.entity_type },
          {
            key: "entity",
            header: "Entity",
            cell: (r) => (
              <span className="break-words">
                {r.entity_label ?? <span className="text-muted-foreground">—</span>}
                {r.entity_id && <span className="block text-xs break-all text-muted-foreground">ID {r.entity_id}</span>}
              </span>
            ),
          },
          { key: "details", header: "Details", className: "min-w-40 max-w-md", cell: (r) => <AuditDetails row={r} /> },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => hrefWith("/admin/audit", current, { page: p })} label="Audit log pages" />
    </>
  );
}
