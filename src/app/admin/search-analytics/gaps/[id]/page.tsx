import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getGapFlag, getLookups } from "@/lib/data/operations";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { label } from "@/lib/labels";
import { DetailList, PageHeader, Panel } from "@/components/common/page";
import { InternalNotes } from "@/components/staff/internal-notes";
import { ActionButton } from "@/components/operations/action-button";
import { AssignResearchForm, GapTaskForm } from "@/components/operations/gap-forms";
import { GapStatusPill, INDICATOR_LABELS, LevelPill, TaskStatusPill } from "@/components/operations/status";
import { setGapStatusAction } from "../../actions";

export const metadata: Metadata = { title: "Resource-Gap Indicator" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function GapFlagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/search-analytics/gaps/${id}`);
  if (!UUID.test(id)) notFound();
  const [data, lookups] = await Promise.all([getGapFlag(id), getLookups()]);
  if (!data) notFound();
  const { flag: f, tasks } = data;
  const staff = lookups.staff.map((s) => ({ value: s.id, label: s.full_name }));
  const closed = f.status === "resolved" || f.status === "dismissed";
  const area = f.county_name ? `${f.county_name} County` : (f.region ?? "Michigan");

  return (
    <>
      <PageHeader
        title={f.title}
        eyebrow="Resource-gap indicator"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Search Analytics", href: "/admin/search-analytics#indicators" }, { label: "Gap indicator" }]}
        actions={
          <>
            <LevelPill level={f.severity} prefix="Severity" />
            <GapStatusPill status={f.status} />
          </>
        }
      />
      <p className="mb-6 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-foreground">
        <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        These are operational indicators, not claims that no such service exists.
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-2 text-xl font-bold">Details</h2>
            <p className="mb-4">{f.description}</p>
            <DetailList
              items={[
                { label: "Indicator type", value: label(INDICATOR_LABELS, f.indicator_type) },
                { label: "Category", value: f.category_name ?? "Any category" },
                { label: "Area", value: area },
                { label: "Region", value: f.region },
                { label: "Unsuccessful searches", value: String(f.search_count) },
                { label: "Listed resources", value: String(f.resource_count) },
                { label: "Assigned to", value: f.assignee_name ?? "Unassigned" },
                { label: "Created", value: formatDateTime(f.created_at) },
                { label: "Last updated", value: formatDateTime(f.updated_at) },
              ]}
            />
          </Panel>

          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Linked research tasks</h2>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground">No research tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {tasks.map((t) => (
                  <li key={t.id} className="rounded-lg bg-muted p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{t.title}</span>
                      <TaskStatusPill status={t.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.assignee_name ? `Assigned to ${t.assignee_name}` : "Unassigned"} · Created {formatShortDate(t.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm">
              <Link href="/admin/source-watch?tab=tasks" className="text-primary underline">
                Manage all research tasks in Source Watch
              </Link>
            </p>
          </Panel>

          <InternalNotes entityType="gap_flag" entityId={f.id} revalidate={`/admin/search-analytics/gaps/${f.id}`} />
        </div>

        <aside className="flex flex-col gap-6" aria-label="Indicator actions">
          <Panel as="section" className="scroll-mt-24" >
            <h2 id="task" className="mb-3 scroll-mt-24 text-xl font-bold">
              Create Source Watch task
            </h2>
            <GapTaskForm flagId={f.id} staff={staff} defaultTitle={`Research ${f.category_name ? f.category_name.toLowerCase() : "resources"} in ${area}`} />
          </Panel>
          <Panel as="section">
            <h2 id="assign" className="mb-3 scroll-mt-24 text-xl font-bold">
              Assign research
            </h2>
            <AssignResearchForm flagId={f.id} staff={staff} current={f.assigned_to} title={f.title} />
          </Panel>
          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Status</h2>
            <div className="flex flex-col gap-3">
              {closed ? (
                <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "open" }} label="Reopen Indicator" />
              ) : (
                <>
                  <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "resolved" }} label="Mark Resolved" variant="default" />
                  <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "dismissed" }} label="Dismiss" />
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
