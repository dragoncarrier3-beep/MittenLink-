import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Lightbulb } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/data/staff";
import { PageHeader, Section } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { DataTable } from "@/components/common/data-table";
import { VerificationBadge } from "@/components/common/badges";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ActionForm, DecisionForm } from "@/components/staff/action-form";
import { FilterNav } from "@/components/staff/filter-nav";
import { SUBMISSION_STATUS_LABELS, WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { KIND_LABELS, label } from "@/lib/labels";
import { communitySubmissionAction, rejectSubmissionAction } from "./actions";

export const metadata: Metadata = { title: "New Submissions" };

const RESULTS: Record<string, string> = {
  rejected: "Submission rejected and archived. Its open tasks were cancelled.",
  community_reviewed: "Suggestion marked as reviewed.",
  community_dismissed: "Suggestion dismissed.",
  community_added_to_source_watch: "Added to Source Watch as a new discovery for review.",
};

const COMMUNITY_FILTERS: Record<string, { label: string; statuses: string[] }> = {
  new: { label: "New", statuses: ["new"] },
  reviewed: { label: "Reviewed", statuses: ["reviewed"] },
  added_to_source_watch: { label: "Added to Source Watch", statuses: ["added_to_source_watch"] },
  dismissed: { label: "Dismissed", statuses: ["dismissed"] },
  all: { label: "All", statuses: ["new", "reviewed", "added_to_source_watch", "dismissed"] },
};

interface Pending {
  id: string; kind: string; title: string; summary: string; verification_status: string; created_at: Date;
  submitter_name: string | null; submitter_email: string | null; website: string | null; public_email: string | null; public_phone: string | null;
  parent_org: string | null; county: string | null; task_id: string | null; total: number;
}

interface Community {
  id: string; kind: string; name: string | null; url: string | null; description: string; city: string | null; county: string | null; category: string | null;
  email: string | null; status: string; created_at: Date; total: number;
}

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/submissions");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const cpage = parsePage(sp.cpage);
  const ckey = COMMUNITY_FILTERS[param(sp, "cstatus") ?? ""] ? param(sp, "cstatus")! : "new";

  const [pending, community, ccounts] = await asService(async (sql) => {
    const pending = await sql.query<Pending>(
      `select l.id, l.kind, l.title, l.summary, l.verification_status, l.created_at, p.full_name as submitter_name, p.email as submitter_email,
         o.website, o.public_email, o.public_phone, c.name as county,
         (select pl.title from listings pl where pl.id = app.listing_organization(l.id) and pl.id <> l.id) as parent_org,
         (select vt.id from verification_tasks vt where vt.listing_id = l.id and vt.status in ('open', 'in_progress', 'escalated')
            order by (vt.reason = 'new_submission') desc, vt.created_at limit 1) as task_id,
         (count(*) over ())::int as total
       from listings l left join organizations o on o.id = l.id left join profiles p on p.id = l.created_by left join counties c on c.id = l.primary_county_id
       where l.publication_status = 'pending'
       order by l.created_at asc limit $1 offset $2`,
      [PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    const community = await sql.query<Community>(
      `select s.id, s.kind, s.name, s.url, s.description, s.city, co.name as county, ca.name as category, coalesce(s.submitter_email, p.email) as email,
         s.status, s.created_at, (count(*) over ())::int as total
       from community_submissions s left join counties co on co.id = s.county_id left join categories ca on ca.id = s.category_id
       left join profiles p on p.id = s.submitter_user_id
       where s.status = any($1) order by s.created_at desc limit $2 offset $3`,
      [COMMUNITY_FILTERS[ckey].statuses, PAGE_SIZE, (cpage - 1) * PAGE_SIZE],
    );
    const counts = await sql.query<{ status: string; n: number }>("select status, count(*)::int as n from community_submissions group by status");
    return [pending, community, Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>] as const;
  });
  const result = resultFor(sp, RESULTS);
  const communityBase = ckey === "new" ? "/admin/submissions" : `/admin/submissions?cstatus=${ckey}`;

  return (
    <>
      <PageHeader title="New Submissions" description="New records waiting to be reviewed before they appear publicly, plus suggestions and unmet needs shared by the community." />
      <ResultBanner message={result.message} warning={result.warning} />

      <Section title="New provider submissions" id="pending" description="Records with a Pending publication status. Verifying the record on its task publishes it.">
        <DataTable
          caption="Pending provider submissions"
          rows={pending}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "title",
              header: "Record",
              primary: true,
              cell: (r) => (
                <span>
                  {r.title}
                  <span className="block text-sm font-normal text-muted-foreground">
                    {label(KIND_LABELS, r.kind)}
                    {r.parent_org ? ` · ${r.parent_org}` : ""}
                    {r.county ? ` · ${r.county} County` : ""}
                  </span>
                </span>
              ),
            },
            {
              key: "details",
              header: "Details",
              cell: (r) => (
                <span className="flex flex-col text-sm">
                  {r.summary && <span>{r.summary}</span>}
                  {r.website && <span className="break-all">Website: {r.website}</span>}
                  {r.public_phone && <span>Phone: {r.public_phone}</span>}
                  {r.public_email && <span className="break-all">Email: {r.public_email}</span>}
                </span>
              ),
            },
            {
              key: "submitter",
              header: "Submitted by",
              cell: (r) =>
                r.submitter_name ? (
                  <span>
                    {r.submitter_name}
                    <span className="block text-sm break-all text-muted-foreground">{r.submitter_email}</span>
                  </span>
                ) : (
                  "MittenLink staff import"
                ),
            },
            { key: "date", header: "Submitted", cell: (r) => formatShortDate(r.created_at) },
            { key: "status", header: "Verification", cell: (r) => <VerificationBadge status={r.verification_status} /> },
            {
              key: "actions",
              header: "Actions",
              srOnlyHeader: true,
              cell: (r) => (
                <div className="flex flex-col gap-2">
                  {r.task_id ? (
                    <Link href={`/verify/tasks/${r.task_id}?from=admin`} className={buttonVariants({ size: "sm" })}>
                      Open verification task<span className="sr-only"> for {r.title}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">No open task</span>
                  )}
                  <details className="rounded-lg border p-2">
                    <summary className="min-h-9 cursor-pointer font-semibold">
                      Reject submission<span className="sr-only"> {r.title}</span>
                    </summary>
                    <DecisionForm
                      className="mt-3"
                      action={rejectSubmissionAction}
                      hidden={{ listingId: r.id }}
                      showRequiredNote={false}
                      fields={[{ type: "textarea", name: "message", label: "Reason (sent to the submitter)", rows: 3, maxLength: 2000, hint: "Archives the record and cancels its open tasks." }]}
                      buttons={[{ label: "Reject and archive", variant: "destructive", pendingLabel: "Rejecting…" }]}
                    />
                  </details>
                </div>
              ),
            },
          ]}
          empty={<EmptyState icon={Inbox} title="No pending submissions" description="New organizations and records submitted for the directory will appear here." headingLevel={3} />}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={pending[0]?.total ?? 0} hrefFor={(p) => `/admin/submissions?page=${p}`} label="Pending submission pages" />
      </Section>

      <Section title="Community suggestions and unmet needs" id="community" className="mt-10" description="Resources the community suggested and needs they could not find help for. Contact emails are private.">
        <FilterNav
          label="Filter community submissions"
          items={Object.entries(COMMUNITY_FILTERS).map(([k, f]) => ({
            href: k === "new" ? "/admin/submissions#community" : `/admin/submissions?cstatus=${k}#community`,
            label: f.label,
            count: f.statuses.reduce((s, st) => s + (ccounts[st] ?? 0), 0),
            active: k === ckey,
          }))}
        />
        <DataTable
          caption={`Community submissions — ${COMMUNITY_FILTERS[ckey].label}`}
          rows={community}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "what",
              header: "Submission",
              primary: true,
              cell: (r) => (
                <span>
                  {r.name ?? (r.kind === "unmet_need" ? "Unmet need" : "Resource suggestion")}
                  <span className="block text-sm font-normal text-muted-foreground">{r.kind === "unmet_need" ? "Unmet need" : "Resource suggestion"}</span>
                </span>
              ),
            },
            {
              key: "desc",
              header: "Description",
              cell: (r) => (
                <span className="flex flex-col text-sm">
                  <span className="whitespace-pre-line">{r.description}</span>
                  {r.url && <span className="break-all">Link: {r.url}</span>}
                </span>
              ),
            },
            { key: "where", header: "Location / category", cell: (r) => [r.city, r.county ? `${r.county} County` : null, r.category].filter(Boolean).join(" · ") || "—" },
            { key: "email", header: "Contact (private)", cell: (r) => <span className="break-all">{r.email ?? "Not provided"}</span> },
            { key: "date", header: "Received", cell: (r) => formatShortDate(r.created_at) },
            { key: "status", header: "Status", cell: (r) => <WorkflowStatus kind="submission" status={r.status} /> },
            {
              key: "actions",
              header: "Actions",
              srOnlyHeader: true,
              cell: (r) =>
                r.status === "added_to_source_watch" ? (
                  <Link href="/admin/source-watch" className="text-sm font-semibold text-primary underline">
                    View in Source Watch
                  </Link>
                ) : (
                  <ActionForm
                    action={communitySubmissionAction}
                    hidden={{ submissionId: r.id, returnTo: communityBase }}
                    buttons={[
                      ...(r.status !== "reviewed" ? [{ label: "Mark reviewed", value: "reviewed" }] : []),
                      { label: "Add to Source Watch", value: "added_to_source_watch" },
                      ...(r.status !== "dismissed" ? [{ label: "Dismiss", value: "dismissed" }] : []),
                    ]}
                  />
                ),
            },
          ]}
          empty={
            <EmptyState
              icon={Lightbulb}
              title={`No ${SUBMISSION_STATUS_LABELS[ckey] ? `“${SUBMISSION_STATUS_LABELS[ckey]}” ` : ""}community submissions`}
              description="Suggestions from the “Tell us what you were looking for” form appear here."
              headingLevel={3}
            />
          }
        />
        <Pagination
          page={cpage}
          pageSize={PAGE_SIZE}
          total={community[0]?.total ?? 0}
          hrefFor={(p) => `${communityBase}${communityBase.includes("?") ? "&" : "?"}cpage=${p}#community`}
          label="Community submission pages"
        />
      </Section>
    </>
  );
}
