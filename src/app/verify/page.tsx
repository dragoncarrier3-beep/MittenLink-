import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listTasks, queueFilterCounts, QUEUE_FILTERS } from "@/lib/data/staff";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { FilterNav } from "@/components/staff/filter-nav";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { TaskTable } from "@/components/staff/task-table";
import { VERIFY_RESULTS } from "./results";

export const metadata: Metadata = { title: "My Verification Queue" };

export default async function MyQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff("/verify");
  const sp = await searchParams;
  const filterKey = param(sp, "filter") ?? "all";
  const filter = QUEUE_FILTERS[filterKey] ?? QUEUE_FILTERS.all;
  const activeKey = QUEUE_FILTERS[filterKey] ? filterKey : "all";

  const [rows, counts] = await Promise.all([
    listTasks({ statuses: ["open", "in_progress"], assignee: user.id, reasons: filter.reasons, priorities: filter.priorities, order: "priority", limit: 200 }),
    queueFilterCounts({ assignee: user.id }),
  ]);
  const result = resultFor(sp, VERIFY_RESULTS);

  return (
    <>
      <PageHeader
        title="My Verification Queue"
        description="Records assigned to you that need review, sorted by priority and then due date."
        actions={
          <Link href="/verify/team" className={buttonVariants({ variant: "outline" })}>
            Find unassigned tasks
          </Link>
        }
      />
      <ResultBanner message={result.message} warning={result.warning} />
      <FilterNav
        label="Filter my queue"
        items={Object.entries(QUEUE_FILTERS).map(([key, f]) => ({
          href: key === "all" ? "/verify" : `/verify?filter=${key}`,
          label: f.label,
          count: counts[key] ?? 0,
          active: key === activeKey,
        }))}
      />
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        Showing {rows.length} {rows.length === 1 ? "task" : "tasks"}
        {activeKey !== "all" ? ` filtered by “${filter.label}”` : ""}.
      </p>
      <TaskTable
        caption={`My verification queue${activeKey !== "all" ? ` — ${filter.label}` : ""}`}
        rows={rows}
        columns={["resource", "type", "county", "status", "lastVerified", "reason", "priority", "due"]}
        empty={
          <EmptyState
            icon={ClipboardCheck}
            title={activeKey === "all" ? "Your queue is clear" : `No “${filter.label}” tasks assigned to you`}
            description={
              activeKey === "all"
                ? "Nothing is assigned to you right now. Pick up an unassigned task to keep records current."
                : "Try another filter, or pick up an unassigned task."
            }
            action={{ label: "View unassigned tasks", href: "/verify/team" }}
          />
        }
      />
    </>
  );
}
