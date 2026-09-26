import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Plus, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listOutreach, type OutreachRow } from "@/lib/data/operations";
import { OUTREACH_STATUS_LABELS } from "@/lib/labels";
import { formatDay, formatShortDate } from "@/lib/format";
import { PageHeader, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { StatusPill } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { LinkTabs } from "@/components/operations/link-tabs";
import { OutreachStatusPill } from "@/components/operations/status";

export const metadata: Metadata = { title: "Outreach" };

const PAGE_SIZE = 25;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OutreachPage({ searchParams }: { searchParams: SP }) {
  const user = await requireAdmin("/admin/outreach");
  const sp = await searchParams;
  const queue = one(sp.view) === "queue";
  const statusParam = one(sp.status);
  const status = statusParam && statusParam in OUTREACH_STATUS_LABELS ? statusParam : null;
  const mine = one(sp.mine) === "1";
  const overdue = one(sp.overdue) === "1";
  const page = parsePage(sp.page);

  const { rows, dueCount, total } = await listOutreach({ status: queue ? null : status, assignedTo: mine ? user.id : null, overdue: !queue && overdue, queue });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (queue) params.set("view", "queue");
    if (!queue && status) params.set("status", status);
    if (mine) params.set("mine", "1");
    if (!queue && overdue) params.set("overdue", "1");
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/outreach${s ? `?${s}` : ""}`;
  };
  const filtered = !!(status || mine || overdue);

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Track conversations with organizations, invite them to claim their free listing, and keep follow-ups from slipping."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Outreach" }]}
        actions={
          <Link href="/admin/outreach/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add Outreach Contact
          </Link>
        }
      />
      <LinkTabs
        label="Outreach views"
        items={[
          { href: "/admin/outreach", label: "All contacts", count: total, current: !queue },
          { href: "/admin/outreach?view=queue", label: "Follow-Up Queue", count: dueCount, current: queue },
        ]}
      />

      <form method="get" action="/admin/outreach" className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:flex-wrap md:items-end" aria-label="Filter outreach contacts">
        {queue && <input type="hidden" name="view" value="queue" />}
        {!queue && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-status" className="font-semibold">
              Status
            </label>
            <select id="f-status" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-lg border border-input bg-card px-3">
              <option value="">All statuses</option>
              {Object.entries(OUTREACH_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5 accent-[var(--primary)]" /> Assigned to me
        </label>
        {!queue && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-5 accent-[var(--primary)]" /> Overdue only
          </label>
        )}
        <div className="flex gap-2">
          <button type="submit" className={buttonVariants()}>
            Apply Filters
          </button>
          {filtered && (
            <Link href={queue ? "/admin/outreach?view=queue" : "/admin/outreach"} className={buttonVariants({ variant: "ghost" })}>
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <Section
        title={queue ? "Follow-Up Queue" : "Outreach contacts"}
        description={queue ? "Contacts with a follow-up due today or earlier, excluding organizations that have claimed or declined. Oldest first." : `${rows.length} ${rows.length === 1 ? "contact" : "contacts"}${filtered ? " match your filters" : ""}.`}
      >
        <p role="status" className="sr-only">
          {rows.length} {rows.length === 1 ? "contact" : "contacts"} shown
        </p>
        <DataTable
          caption={queue ? "Outreach follow-up queue" : "Outreach contacts"}
          rows={pageRows}
          rowKey={(r) => r.id}
          empty={
            queue ? (
              <EmptyState icon={CalendarClock} title="No follow-ups due" description="Everyone is up to date. Follow-ups appear here on their due date." />
            ) : (
              <EmptyState icon={Users} title={filtered ? "No contacts match these filters" : "No outreach contacts yet"} description={filtered ? "Try clearing a filter." : "Add a contact to start tracking outreach."} action={filtered ? { label: "Clear filters", href: "/admin/outreach" } : { label: "Add Outreach Contact", href: "/admin/outreach/new" }} />
            )
          }
          columns={columns}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={qs} label="Outreach pages" />
      </Section>
    </>
  );
}

const columns = [
  {
    key: "org",
    header: "Organization",
    primary: true,
    cell: (r: OutreachRow) => (
      <Link href={`/admin/outreach/${r.id}`} className="font-semibold text-primary underline">
        {r.organization_title}
        <span className="sr-only"> — outreach with {r.contact_name}</span>
      </Link>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    cell: (r: OutreachRow) => (
      <div>
        <div>{r.contact_name}</div>
        {r.contact_role && <div className="text-sm text-muted-foreground">{r.contact_role}</div>}
      </div>
    ),
  },
  {
    key: "reach",
    header: "Email / phone",
    cell: (r: OutreachRow) => (
      <div className="text-sm break-all">
        {r.email && <div>{r.email}</div>}
        {r.phone && <div>{r.phone}</div>}
        {!r.email && !r.phone && <span className="text-muted-foreground">None on file</span>}
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (r: OutreachRow) => <OutreachStatusPill status={r.status} /> },
  { key: "last", header: "Last contacted", cell: (r: OutreachRow) => (r.last_contacted_at ? formatShortDate(r.last_contacted_at) : <span className="text-muted-foreground">Never</span>) },
  {
    key: "next",
    header: "Next follow-up",
    cell: (r: OutreachRow) =>
      r.next_follow_up_at ? (
        <div className="flex flex-col items-start gap-1">
          <span>{formatDay(r.next_follow_up_at, { month: "short", day: "numeric", year: "numeric" })}</span>
          {r.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : r.is_due ? <StatusPill tone="warning">Due today</StatusPill> : null}
        </div>
      ) : (
        <span className="text-muted-foreground">None scheduled</span>
      ),
  },
  { key: "staff", header: "Assigned staff", cell: (r: OutreachRow) => r.assignee_name ?? <span className="text-muted-foreground">Unassigned</span> },
];
