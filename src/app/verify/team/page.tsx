import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listTasks, queueFilterCounts, QUEUE_FILTERS } from "@/lib/data/staff";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { ActionForm } from "@/components/staff/action-form";
import { FilterNav } from "@/components/staff/filter-nav";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { TaskTable } from "@/components/staff/task-table";
import { taskAssignmentAction } from "../actions";
import { VERIFY_RESULTS } from "../results";

export const metadata: Metadata = { title: "Unassigned Tasks" };

export default async function TeamQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("/verify/team");
  const sp = await searchParams;
  const filterKey = param(sp, "filter") ?? "all";
  const activeKey = QUEUE_FILTERS[filterKey] ? filterKey : "all";
  const filter = QUEUE_FILTERS[activeKey];
  const [rows, counts] = await Promise.all([
    listTasks({ statuses: ["open", "in_progress"], assignee: "unassigned", reasons: filter.reasons, priorities: filter.priorities, order: "priority", limit: 200 }),
    queueFilterCounts({ assignee: "unassigned" }),
  ]);
  const result = resultFor(sp, {
    ...VERIFY_RESULTS,
    assigned: "Task assigned to you. It now appears in My Verification Queue.",
  });
  const returnTo = activeKey === "all" ? "/verify/team" : `/verify/team?filter=${activeKey}`;

  return (
    <>
      <PageHeader
        title="Unassigned Tasks"
        description="Open verification tasks that no one has picked up yet. Assign a task to yourself to add it to your queue."
      />
      <ResultBanner message={result.message} warning={result.warning} />
      <FilterNav
        label="Filter unassigned tasks"
        items={Object.entries(QUEUE_FILTERS).map(([key, f]) => ({
          href: key === "all" ? "/verify/team" : `/verify/team?filter=${key}`,
          label: f.label,
          count: counts[key] ?? 0,
          active: key === activeKey,
        }))}
      />
      <TaskTable
        caption="Unassigned verification tasks"
        rows={rows}
        columns={["resource", "type", "county", "status", "reason", "priority", "due", "actions"]}
        actions={(r) => (
          <ActionForm
            action={taskAssignmentAction}
            hidden={{ taskId: r.id, intent: "assign", returnTo }}
            buttons={[{ label: "Assign to me", pendingLabel: "Assigning…", variant: "default" }]}
          />
        )}
        empty={
          <EmptyState
            icon={Users}
            title="No unassigned tasks"
            description={activeKey === "all" ? "Every open task has an owner." : `No unassigned “${filter.label}” tasks right now.`}
            action={{ label: "Back to my queue", href: "/verify" }}
          />
        }
      />
    </>
  );
}
