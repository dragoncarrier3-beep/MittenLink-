import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DataTable, type Column } from "@/components/common/data-table";
import { VerificationBadge } from "@/components/common/badges";
import { formatDay, formatShortDate } from "@/lib/format";
import { KIND_LABELS, TASK_REASON_LABELS, label } from "@/lib/labels";
import type { TaskRow } from "@/lib/data/staff";
import { PriorityPill, WorkflowStatus } from "./pills";

function isOverdue(due: Date | string | null) {
  if (!due) return false;
  const iso = due instanceof Date ? due.toISOString().slice(0, 10) : String(due).slice(0, 10);
  return iso < new Date().toISOString().slice(0, 10);
}

export function DueDate({ due }: { due: Date | string | null }) {
  if (!due) return <span className="text-muted-foreground">No due date</span>;
  const overdue = isOverdue(due);
  return (
    <span className={overdue ? "font-semibold text-danger" : undefined}>
      {formatDay(due, { month: "short", day: "numeric", year: "numeric" })}
      {overdue && (
        <span className="ml-1 inline-flex items-center gap-1 text-sm">
          <AlertTriangle className="size-4" aria-hidden /> Overdue
        </span>
      )}
    </span>
  );
}

type ColumnKey = "resource" | "type" | "county" | "status" | "lastVerified" | "reason" | "priority" | "due" | "assignee" | "taskStatus" | "resolution" | "completedBy" | "completedAt" | "actions";

/**
 * Verification task table used by the verifier queues and the admin
 * verification overview. `actions` renders per-row controls.
 */
export function TaskTable({
  rows,
  caption,
  columns,
  actions,
  empty,
  hrefSuffix = "",
}: {
  rows: TaskRow[];
  caption: string;
  columns: ColumnKey[];
  actions?: (row: TaskRow) => React.ReactNode;
  empty?: React.ReactNode;
  /** Appended to task links, e.g. "?from=admin". */
  hrefSuffix?: string;
}) {
  const all: Record<ColumnKey, Column<TaskRow>> = {
    resource: {
      key: "resource",
      header: "Resource",
      primary: true,
      cell: (r) => (
        <Link href={`/verify/tasks/${r.id}${hrefSuffix}`} className="font-semibold text-primary underline underline-offset-2">
          {r.listing_title}
          <span className="sr-only"> — open verification task</span>
        </Link>
      ),
    },
    type: { key: "type", header: "Type", cell: (r) => label(KIND_LABELS, r.listing_kind) },
    county: { key: "county", header: "County", cell: (r) => (r.county ? `${r.county}` : <span className="text-muted-foreground">Statewide / not set</span>) },
    status: { key: "status", header: "Current status", cell: (r) => <VerificationBadge status={r.verification_status} /> },
    lastVerified: {
      key: "lastVerified",
      header: "Last verified",
      cell: (r) => (r.last_verified_at ? formatShortDate(r.last_verified_at) : <span className="text-muted-foreground">Never</span>),
    },
    reason: { key: "reason", header: "Reason for review", cell: (r) => label(TASK_REASON_LABELS, r.reason) },
    priority: { key: "priority", header: "Priority", cell: (r) => <PriorityPill priority={r.priority} /> },
    due: { key: "due", header: "Due date", cell: (r) => <DueDate due={r.due_at} /> },
    assignee: { key: "assignee", header: "Assigned to", cell: (r) => r.assignee_name ?? <span className="text-muted-foreground">Unassigned</span> },
    taskStatus: { key: "taskStatus", header: "Task status", cell: (r) => <WorkflowStatus kind="task" status={r.status} /> },
    resolution: { key: "resolution", header: "Resolution", cell: (r) => r.resolution ?? (r.status === "cancelled" ? "Cancelled" : "—") },
    completedBy: { key: "completedBy", header: "Completed by", cell: (r) => r.completed_by_name ?? r.assignee_name ?? "—" },
    completedAt: { key: "completedAt", header: "Completed", cell: (r) => (r.completed_at ? formatShortDate(r.completed_at) : "—") },
    actions: { key: "actions", header: "Actions", srOnlyHeader: true, cell: (r) => actions?.(r) ?? null },
  };
  return <DataTable caption={caption} columns={columns.map((c) => all[c])} rows={rows} rowKey={(r) => r.id} empty={empty} />;
}
