import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { listStaffUsers, listTasks, PAGE_SIZE } from "@/lib/data/staff";
import { PageHeader, Section } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { VerificationBadge } from "@/components/common/badges";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ActionForm } from "@/components/staff/action-form";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { TaskTable } from "@/components/staff/task-table";
import { formatDay, formatShortDate } from "@/lib/format";
import { KIND_LABELS, PRIORITY_LABELS, TASK_REASON_LABELS, TASK_STATUS_LABELS, label } from "@/lib/labels";
import { adminAssignTaskAction, createRenewalTaskAction } from "./actions";

export const metadata: Metadata = { title: "Verification" };

const RESULTS: Record<string, string> = {
  assigned: "Task assigned. The team member was notified.",
  unassigned: "Task is now unassigned.",
  renewal_created: "Review task created. It is now in the unassigned verification queue.",
  verified: "Record verified.",
  update_requested: "Update requested from the organization.",
  unable: "Record marked Unable to Verify.",
  rejected: "Provider change rejected.",
};

const ACTIVE = ["open", "in_progress", "escalated"];
const selectClass = "min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base";

export default async function AdminVerificationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/verification");
  const sp = await searchParams;
  const reason = param(sp, "reason") ?? "";
  const priority = param(sp, "priority") ?? "";
  const assignee = param(sp, "assignee") ?? "";
  const status = param(sp, "status") ?? "";
  const page = parsePage(sp.page);

  const staff = await listStaffUsers();
  const validAssignee = assignee === "unassigned" || staff.some((s) => s.id === assignee) ? assignee : "";
  const rows = await listTasks({
    statuses: ACTIVE.includes(status) ? [status] : ACTIVE,
    reasons: TASK_REASON_LABELS[reason] ? [reason] : undefined,
    priorities: PRIORITY_LABELS[priority] ? [priority] : undefined,
    assignee: validAssignee || undefined,
    order: "escalated_first",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const renewals = await asService((sql) =>
    sql.query<{ id: string; title: string; kind: string; next_review_at: Date | string; last_verified_at: Date | null; verification_status: string; has_task: boolean }>(
      `select l.id, l.title, l.kind, l.next_review_at, l.last_verified_at, l.verification_status,
         exists (select 1 from verification_tasks vt where vt.listing_id = l.id and vt.status in ('open', 'in_progress', 'escalated')) as has_task
       from listings l where l.publication_status = 'published' and l.verification_status = 'verified' and l.next_review_at <= current_date + 14
       order by l.next_review_at, l.title limit 50`,
    ),
  );

  const current = { reason, priority, assignee: validAssignee, status };
  const qs = new URLSearchParams(Object.entries(current).filter(([, v]) => v) as [string, string][]).toString();
  const returnTo = `/admin/verification${qs ? `?${qs}${page > 1 ? `&page=${page}` : ""}` : page > 1 ? `?page=${page}` : ""}`;
  const filtered = !!qs;
  const result = resultFor(sp, RESULTS);

  return (
    <>
      <PageHeader title="Verification" description="All open, in-progress, and escalated verification tasks. Escalated tasks are listed first." />
      <ResultBanner message={result.message} warning={result.warning} />

      <form method="get" action="/admin/verification" className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter verification tasks">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-reason" className="font-semibold">Reason</label>
          <select id="f-reason" name="reason" defaultValue={reason} className={selectClass}>
            <option value="">All reasons</option>
            {Object.entries(TASK_REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-priority" className="font-semibold">Priority</label>
          <select id="f-priority" name="priority" defaultValue={priority} className={selectClass}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-assignee" className="font-semibold">Assignee</label>
          <select id="f-assignee" name="assignee" defaultValue={validAssignee} className={selectClass}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-status" className="font-semibold">Status</label>
          <select id="f-status" name="status" defaultValue={status} className={selectClass}>
            <option value="">All active</option>
            {ACTIVE.map((k) => (
              <option key={k} value={k}>{TASK_STATUS_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonVariants()}>Apply filters</button>
          {filtered && (
            <Link href="/admin/verification" className={buttonVariants({ variant: "outline" })}>
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-sm text-muted-foreground">
        {rows[0]?.total ?? 0} {(rows[0]?.total ?? 0) === 1 ? "task matches" : "tasks match"}
        {filtered ? " your filters" : ""}.
      </p>
      <TaskTable
        caption="Active verification tasks"
        hrefSuffix="?from=admin"
        rows={rows}
        columns={["resource", "type", "reason", "taskStatus", "priority", "due", "assignee", "actions"]}
        actions={(r) => (
          <ActionForm action={adminAssignTaskAction} hidden={{ taskId: r.id, returnTo }} buttons={[{ label: "Assign", pendingLabel: "Assigning…" }]}>
            <label htmlFor={`assign-${r.id}`} className="text-sm font-semibold">
              Assign to<span className="sr-only"> for {r.listing_title}</span>
            </label>
            <select id={`assign-${r.id}`} name="assignee" defaultValue={r.assigned_to ?? "unassigned"} className={`${selectClass} min-w-40`}>
              <option value="unassigned">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </ActionForm>
        )}
        empty={
          <EmptyState
            icon={ClipboardCheck}
            title={filtered ? "No tasks match these filters" : "No active verification tasks"}
            description={filtered ? "Try clearing one or more filters." : "Every verification task is resolved."}
            action={filtered ? { label: "Clear filters", href: "/admin/verification" } : undefined}
          />
        }
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows[0]?.total ?? 0}
        hrefFor={(p) => `/admin/verification?${new URLSearchParams({ ...Object.fromEntries(Object.entries(current).filter(([, v]) => v)), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`}
        label="Verification task pages"
      />

      <Section title="Verification renewals" id="renewals" className="mt-10" description="Verified, published records whose next review date is within 14 days (or overdue).">
        <DataTable
          caption="Records due for verification renewal"
          rows={renewals}
          rowKey={(r) => r.id}
          columns={[
            { key: "title", header: "Record", primary: true, cell: (r) => r.title },
            { key: "kind", header: "Type", cell: (r) => label(KIND_LABELS, r.kind) },
            { key: "status", header: "Current status", cell: (r) => <VerificationBadge status={r.verification_status} /> },
            { key: "last", header: "Last verified", cell: (r) => (r.last_verified_at ? formatShortDate(r.last_verified_at) : "Never") },
            { key: "next", header: "Review due", cell: (r) => formatDay(r.next_review_at, { month: "short", day: "numeric", year: "numeric" }) },
            {
              key: "action",
              header: "Action",
              srOnlyHeader: true,
              cell: (r) =>
                r.has_task ? (
                  <span className="text-sm text-muted-foreground">Review task already open</span>
                ) : (
                  <ActionForm action={createRenewalTaskAction} hidden={{ listingId: r.id }} buttons={[{ label: "Create review task", pendingLabel: "Creating…" }]} />
                ),
            },
          ]}
          empty={<EmptyState icon={CalendarClock} title="No renewals due" description="No verified records are due for review in the next 14 days." headingLevel={3} />}
        />
      </Section>
    </>
  );
}
