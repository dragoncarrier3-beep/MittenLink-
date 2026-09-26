import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Info, Plus, Radar } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getLookups, listCandidates, listResearchTasks, listSources, type CandidateRow, type ResearchTaskRow, type SourceRow } from "@/lib/data/operations";
import { CANDIDATE_STATUS_LABELS, SOURCE_TYPE_LABELS, label } from "@/lib/labels";
import { formatDate, formatShortDate, hostname } from "@/lib/format";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { LinkTabs, FilterLinks } from "@/components/operations/link-tabs";
import { CandidateStatusPill, DuplicateConfidence, SourceStatusPill, TaskStatusPill } from "@/components/operations/status";
import { ActionButton } from "@/components/operations/action-button";
import { ResearchTaskForm, TaskUpdateForm } from "@/components/operations/source-watch-forms";
import { markSourceCheckedAction, setSourceStatusAction } from "./actions";

export const metadata: Metadata = { title: "Source Watch" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SourceWatchPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("/admin/source-watch");
  const sp = await searchParams;
  const tab = one(sp.tab) === "sources" ? "sources" : one(sp.tab) === "tasks" ? "tasks" : "candidates";
  const statusParam = one(sp.status);
  const status = statusParam && statusParam in CANDIDATE_STATUS_LABELS ? statusParam : null;

  const [{ rows: candidates, counts }, sources, tasks] = await Promise.all([listCandidates(tab === "candidates" ? status : null), listSources(), listResearchTasks()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <>
      <PageHeader
        title="Source Watch"
        description="Discover potential new disability resources from trusted public sources. Every candidate is reviewed by a person before anything is imported, and imported records stay private until verified."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Source Watch" }]}
        actions={
          <>
            <Link href="/admin/source-watch/candidates/new" className={buttonVariants()}>
              <Plus aria-hidden /> Add Candidate Manually
            </Link>
            <Link href="/admin/source-watch/sources/new" className={buttonVariants({ variant: "outline" })}>
              <Plus aria-hidden /> Add Source
            </Link>
          </>
        }
      />

      <LinkTabs
        label="Source Watch sections"
        items={[
          { href: "/admin/source-watch", label: "Candidates", count: total, current: tab === "candidates" },
          { href: "/admin/source-watch?tab=sources", label: "Watched Sources", count: sources.length, current: tab === "sources" },
          { href: "/admin/source-watch?tab=tasks", label: "Research Tasks", count: openTasks, current: tab === "tasks" },
        ]}
      />

      {tab === "candidates" && <CandidatesTab rows={candidates} counts={counts} total={total} status={status} />}
      {tab === "sources" && <SourcesTab sources={sources} />}
      {tab === "tasks" && <TasksTab tasks={tasks} />}
    </>
  );
}

function CandidatesTab({ rows, counts, total, status }: { rows: CandidateRow[]; counts: Record<string, number>; total: number; status: string | null }) {
  return (
    <Section title="Candidates" description="Possible new resources found on watched sources or added by staff. Filter by review status.">
      <FilterLinks
        label="Filter candidates by status"
        items={[
          { href: "/admin/source-watch", label: "All", count: total, current: !status },
          ...Object.entries(CANDIDATE_STATUS_LABELS).map(([key, text]) => ({ href: `/admin/source-watch?status=${key}`, label: text, count: counts[key] ?? 0, current: status === key })),
        ]}
      />
      <DataTable
        caption={status ? `Source Watch candidates with status ${label(CANDIDATE_STATUS_LABELS, status)}` : "All Source Watch candidates"}
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Radar}
            title={status ? `No candidates marked ${label(CANDIDATE_STATUS_LABELS, status)}` : "No candidates yet"}
            description="When staff find a possible resource on a watched source, add it here for review."
            action={{ label: "Add Candidate Manually", href: "/admin/source-watch/candidates/new" }}
          />
        }
        columns={[
          {
            key: "name",
            header: "Candidate",
            primary: true,
            cell: (r) => (
              <div className="flex flex-col gap-1">
                <Link href={`/admin/source-watch/candidates/${r.id}`} className="font-semibold text-primary underline">
                  {r.name}
                </Link>
                {r.url && <span className="text-sm font-normal break-all text-muted-foreground">{hostname(r.url)}</span>}
              </div>
            ),
          },
          { key: "category", header: "Possible category", cell: (r) => r.category_name ?? <span className="text-muted-foreground">Not set</span> },
          { key: "location", header: "Possible location", cell: (r) => [r.possible_city, r.county_name ? `${r.county_name} County` : null].filter(Boolean).join(", ") || <span className="text-muted-foreground">Unknown</span> },
          { key: "source", header: "Source", cell: (r) => r.source_name ?? <span className="text-muted-foreground">Added by staff</span> },
          { key: "discovered", header: "Discovered", cell: (r) => formatShortDate(r.discovered_at) },
          { key: "dup", header: "Duplicate confidence", cell: (r) => <DuplicateConfidence value={r.duplicate_confidence} /> },
          { key: "status", header: "Review status", cell: (r) => <CandidateStatusPill status={r.status} /> },
        ]}
      />
    </Section>
  );
}

function SourcesTab({ sources }: { sources: SourceRow[] }) {
  return (
    <Section title="Watched Sources" description="Trusted public pages and directories staff review for new resources.">
      <Panel className="mb-5 flex gap-3 bg-info-soft">
        <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
        <div className="text-foreground">
          <p className="font-semibold">MittenLink does not scrape third-party websites.</p>
          <p className="mt-1">
            Staff review these sources and add what they find with <Link href="/admin/source-watch/candidates/new" className="underline">Add Candidate Manually</Link>. Automated retrieval
            would run only for sources whose owners have explicitly authorized it — no automated retrieval runs in this demonstration.
          </p>
        </div>
      </Panel>
      {sources.length === 0 ? (
        <EmptyState title="No watched sources yet" description="Add a trusted public source to start tracking it." action={{ label: "Add Source", href: "/admin/source-watch/sources/new" }} />
      ) : (
        <ul className="flex flex-col gap-4">
          {sources.map((s) => {
            const due = s.check_due;
            return (
              <li key={s.id}>
                <article className="rounded-xl border bg-card p-5" aria-labelledby={`src-${s.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id={`src-${s.id}`} className="text-lg font-bold">
                        {s.name}
                      </h3>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm break-all text-primary underline">
                        {s.url} <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SourceStatusPill status={s.status} />
                      {due && s.status !== "paused" && <StatusPill tone="warning">Check due</StatusPill>}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Item label="Source type" value={label(SOURCE_TYPE_LABELS, s.source_type)} />
                    <Item label="Coverage" value={s.coverage} />
                    <Item label="Last checked" value={s.last_checked_at ? formatDate(s.last_checked_at) : "Never"} />
                    <Item label="Check frequency" value={`Every ${s.check_frequency_days} days`} />
                    <Item label="Automated checks authorized" value={s.automated_checks_authorized ? "Yes" : "No"} />
                    <Item label="Candidates found" value={String(s.candidate_count)} />
                  </dl>
                  {s.notes && <p className="mt-3 text-sm text-muted-foreground">Notes: {s.notes}</p>}
                  <div className="mt-4 flex flex-wrap items-start gap-2">
                    <ActionButton action={markSourceCheckedAction} hidden={{ id: s.id }} label="Mark Checked Today" size="sm" srContext={`for ${s.name}`} pendingLabel="Saving…" />
                    <ActionButton
                      action={setSourceStatusAction}
                      hidden={{ id: s.id, status: s.status === "paused" ? "active" : "paused" }}
                      label={s.status === "paused" ? "Resume" : "Pause"}
                      size="sm"
                      srContext={s.name}
                    />
                    <Link href={`/admin/source-watch/sources/${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Edit<span className="sr-only"> {s.name}</span>
                    </Link>
                    <Link href={`/admin/source-watch/candidates/new?source=${s.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <Plus aria-hidden /> Add Candidate<span className="sr-only"> found on {s.name}</span>
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Item({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{l}</dt>
      <dd>{value}</dd>
    </div>
  );
}

async function TasksTab({ tasks }: { tasks: ResearchTaskRow[] }) {
  const lookups = await getLookups();
  const staff = lookups.staff.map((s) => ({ value: s.id, label: s.full_name }));
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
      <Section title="Research Tasks" description="Focused research assignments, often created from resource-gap indicators.">
        {tasks.length === 0 ? (
          <EmptyState title="No research tasks" description="Create a task here or from a resource-gap indicator in Search Analytics." />
        ) : (
          <ul className="flex flex-col gap-4">
            {tasks.map((t) => (
              <li key={t.id}>
                <article className="rounded-xl border bg-card p-5" aria-labelledby={`task-${t.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 id={`task-${t.id}`} className="text-lg font-bold">
                      {t.title}
                    </h3>
                    <TaskStatusPill status={t.status} />
                  </div>
                  {t.details && <p className="mt-2">{t.details}</p>}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[t.county_name ? `${t.county_name} County` : null, t.category_name, `Assigned to ${t.assignee_name ?? "no one yet"}`, `Created ${formatShortDate(t.created_at)}${t.created_by_name ? ` by ${t.created_by_name}` : ""}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {t.gap_flag_id && (
                    <p className="mt-1 text-sm">
                      From gap indicator:{" "}
                      <Link href={`/admin/search-analytics/gaps/${t.gap_flag_id}`} className="text-primary underline">
                        {t.gap_title}
                      </Link>
                    </p>
                  )}
                  <div className="mt-4 border-t pt-4">
                    <TaskUpdateForm id={t.id} title={t.title} status={t.status} assignedTo={t.assigned_to} staff={staff} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Panel as="section" className="self-start">
        <h2 className="mb-3 text-xl font-bold">Add a research task</h2>
        <ResearchTaskForm
          staff={staff}
          counties={lookups.counties.map((c) => ({ value: String(c.id), label: `${c.name} County` }))}
          categories={lookups.categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />
      </Panel>
    </div>
  );
}
