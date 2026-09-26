import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { listTasks, PAGE_SIZE } from "@/lib/data/staff";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterNav } from "@/components/staff/filter-nav";
import { param, type SearchParams } from "@/components/staff/result";
import { TaskTable } from "@/components/staff/task-table";

export const metadata: Metadata = { title: "Recently Completed" };

export default async function CompletedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff("/verify/completed");
  const sp = await searchParams;
  const scope = param(sp, "scope") === "team" ? "team" : "mine";
  const page = parsePage(sp.page);
  const rows = await listTasks({
    statuses: ["completed", "cancelled"],
    completedBy: scope === "mine" ? user.id : undefined,
    order: "completed",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const total = rows[0]?.total ?? 0;
  const base = scope === "team" ? "/verify/completed?scope=team" : "/verify/completed";

  return (
    <>
      <PageHeader title="Recently Completed" description="Verification tasks that have been resolved, most recent first, with the outcome recorded." />
      <FilterNav
        label="Whose completed tasks"
        items={[
          { href: "/verify/completed", label: "Completed by me", active: scope === "mine" },
          { href: "/verify/completed?scope=team", label: "Whole team", active: scope === "team" },
        ]}
      />
      <TaskTable
        caption={scope === "mine" ? "Tasks completed by me" : "Tasks completed by the team"}
        rows={rows}
        columns={["resource", "type", "reason", "resolution", "status", "completedBy", "completedAt"]}
        empty={
          <EmptyState
            icon={History}
            title="No completed tasks yet"
            description={scope === "mine" ? "Tasks you resolve will be listed here." : "Resolved tasks from the team will be listed here."}
          />
        }
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        hrefFor={(p) => (p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
        label="Completed tasks pages"
      />
    </>
  );
}
