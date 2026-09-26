import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { getQueueCounts } from "@/lib/data/admin-counts";
import { PageHeader, Section } from "@/components/common/page";
import { PriorityPill } from "@/components/staff/pills";
import { formatDateTime, formatRelative } from "@/lib/format";
import { TASK_REASON_LABELS, label } from "@/lib/labels";

export const metadata: Metadata = { title: "Admin Dashboard" };

interface Extra {
  organizations: number;
  verified: number;
  newDiscoveries: number;
  failedSearches: number;
  gaps: number;
  enhanced: number;
}

async function loadDashboard() {
  const [counts, extra, activity, escalated] = await Promise.all([
    getQueueCounts(),
    asService((sql) =>
      sql.query<Extra>(`
        select
          (select count(*)::int from listings l join organizations o on o.id = l.id where l.publication_status <> 'archived') as "organizations",
          (select count(*)::int from listings where publication_status = 'published' and verification_status = 'verified') as "verified",
          (select count(*)::int from source_watch_candidates where status = 'new') as "newDiscoveries",
          (select count(*)::int from search_logs where outcome in ('zero', 'low') and created_at >= now() - interval '30 days') as "failedSearches",
          (select count(*)::int from resource_gap_flags where status in ('open', 'researching')) as "gaps",
          (select count(*)::int from organizations o join listings l on l.id = o.id where o.listing_tier = 'enhanced' and l.publication_status <> 'archived') as "enhanced"
      `),
    ).then((r) => r[0]),
    asService((sql) =>
      sql.query<{ id: number; actor_label: string | null; action: string; entity_type: string; entity_label: string | null; created_at: Date }>(
        "select id, actor_label, action, entity_type, entity_label, created_at from audit_logs order by created_at desc, id desc limit 10",
      ),
    ),
    asService((sql) =>
      sql.query<{ id: string; title: string; reason: string; priority: string; details: string | null; updated_at: Date }>(
        `select vt.id, l.title, vt.reason, vt.priority, vt.details, vt.updated_at from verification_tasks vt join listings l on l.id = vt.listing_id
         where vt.status = 'escalated' order by vt.updated_at desc limit 5`,
      ),
    ),
  ]);
  return { counts, extra, activity, escalated };
}

const ACTION_LABELS: Record<string, string> = {
  "claim.submitted": "submitted a provider claim",
  "claim.approved": "approved a provider claim",
  "claim.rejected": "rejected a provider claim",
  "claim.more_info_requested": "requested more information on a claim",
  "claim.status_changed": "changed a claim's status",
  "verification.changed": "changed verification status",
  "verification.escalated": "escalated a verification task",
  "verification.task_assigned": "assigned a verification task",
  "verification.task_unassigned": "unassigned a verification task",
  "verification.task_started": "started a verification review",
  "provider_update.submitted": "submitted a provider update",
  "provider_update.published": "published a provider update",
  "provider_update.rejected": "rejected a provider update",
  "provider_update.more_info_requested": "asked a provider for more information",
  "family_report.moderated": "moderated a family experience report",
  "resource.merged": "merged duplicate records",
  "duplicate.kept_separate": "kept two records separate",
  "duplicate.ignored": "ignored a duplicate suggestion",
  "duplicate.scan": "ran a duplicate scan",
  "internal_note.added": "added an internal note",
  "role.changed": "changed a user's roles",
  "provider.created": "created a provider",
};

function describe(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  let data: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  try {
    data = await loadDashboard();
  } catch (err) {
    console.error("[admin-dashboard]", err);
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Admin Dashboard" />
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-6">
          <h2 className="text-xl font-bold">We couldn&apos;t load the dashboard numbers</h2>
          <p className="mt-2">
            Please refresh the page. The review queues are still available from the menu.{" "}
            <Link href="/admin" className="font-semibold underline">
              Reload dashboard
            </Link>
          </p>
        </div>
      </>
    );
  }
  const { counts: c, extra: x, activity, escalated } = data;

  const overview = [
    { label: "Total organizations", value: x.organizations, href: "/admin/organizations", note: "Providers not archived" },
    { label: "Verified resources", value: x.verified, href: "/admin/verification", note: "Published and verified" },
    { label: "Pending verifications", value: c.verification, href: "/admin/verification", note: "Open, in progress, or escalated tasks" },
    { label: "Provider claims awaiting review", value: c.claims, href: "/admin/claims", note: "Submitted or under review" },
    { label: "Updates awaiting review", value: c.changes, href: "/admin/changes", note: "Provider edit requests" },
    { label: "Family reports awaiting moderation", value: c.familyReports, href: "/admin/reports", note: "Submitted or under review" },
    { label: "New Source Watch discoveries", value: x.newDiscoveries, href: "/admin/source-watch", note: "Not yet reviewed" },
    { label: "Failed searches (last 30 days)", value: x.failedSearches, href: "/admin/search-analytics", note: "Zero or low results" },
    { label: "Potential resource gaps", value: x.gaps, href: "/admin/search-analytics", note: "Open or being researched" },
    { label: "Enhanced providers", value: x.enhanced, href: "/admin/billing", note: "Enhanced Listing tier" },
  ];

  const queues = [
    { label: "New provider submissions", value: c.submissions, href: "/admin/submissions" },
    { label: "Provider claims", value: c.claims, href: "/admin/claims" },
    { label: "Provider edits", value: c.changes, href: "/admin/changes" },
    { label: "Verification renewals (due within 14 days)", value: c.renewalsDue, href: "/admin/verification#renewals" },
    { label: "Community corrections", value: c.corrections, href: "/admin/corrections" },
    { label: "Family reports", value: c.familyReports, href: "/admin/reports" },
    { label: "Source Watch discoveries", value: c.sourceWatch, href: "/admin/source-watch" },
    { label: "Potential duplicates", value: c.duplicates, href: "/admin/duplicates" },
  ];

  return (
    <>
      <PageHeader title="Admin Dashboard" description="An overview of the directory and the work waiting for review." />

      {escalated.length > 0 && (
        <section aria-labelledby="escalated-heading" className="mb-8 rounded-xl border border-warning/40 bg-warning-soft p-5">
          <h2 id="escalated-heading" className="flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="size-5 text-warning" aria-hidden /> {escalated.length === 1 ? "1 task escalated" : `${c.escalated} tasks escalated`} to administrators
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {escalated.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-3">
                <Link href={`/verify/tasks/${t.id}?from=admin`} className="font-semibold text-primary underline underline-offset-2">
                  {t.title}
                </Link>
                <span className="text-sm text-muted-foreground">{label(TASK_REASON_LABELS, t.reason)} · escalated {formatRelative(t.updated_at)}</span>
                <PriorityPill priority={t.priority} />
                {t.details && <p className="w-full text-sm">{t.details.split("\n")[0]}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section title="Overview" id="overview">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overview.map((o) => (
            <li key={o.label}>
              <Link href={o.href} className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm hover:border-primary hover:bg-muted/40">
                <span className="text-sm font-semibold text-muted-foreground">{o.label}</span>
                <span className="mt-1 text-4xl font-bold text-foreground">{o.value.toLocaleString("en-US")}</span>
                <span className="mt-1 text-sm text-muted-foreground">{o.note}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  View<span className="sr-only"> {o.label}</span> <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <Section title="Review queues" id="queues" description="Every queue that needs a human decision.">
          <ul className="divide-y rounded-xl border bg-card">
            {queues.map((q) => (
              <li key={q.label}>
                <Link href={q.href} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 font-semibold hover:bg-muted/40">
                  <span>{q.label}</span>
                  <span className={q.value > 0 ? "rounded-full bg-primary px-3 py-0.5 text-primary-foreground" : "rounded-full bg-muted px-3 py-0.5"}>
                    {q.value}
                    <span className="sr-only"> waiting</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Recent activity"
          id="activity"
          actions={
            <Link href="/admin/audit" className="font-semibold text-primary underline underline-offset-2">
              View full audit log
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="divide-y rounded-xl border bg-card">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <p>
                    <span className="font-semibold">{a.actor_label ?? "System"}</span> {describe(a.action)}
                    {a.entity_label ? <>: <span className="font-semibold">{a.entity_label}</span></> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <time dateTime={new Date(a.created_at).toISOString()}>{formatDateTime(a.created_at)}</time>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
