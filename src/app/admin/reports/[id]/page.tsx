import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { DecisionForm } from "@/components/staff/action-form";
import { InternalNotes } from "@/components/staff/internal-notes";
import { WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { resultFor, type SearchParams } from "@/components/staff/result";
import { formatDateTime, formatDay } from "@/lib/format";
import { EXPERIENCE_LABELS, RATING_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { moderateReportAction } from "../actions";

export const metadata: Metadata = { title: "Moderate Family Report" };

const RESULTS: Record<string, string> = {
  under_review: "Report marked Under Review.",
  approved: "Report approved.",
  rejected: "Report rejected. The submitter was notified with your message.",
  needs_clarification: "Clarification requested. The submitter was notified with your message.",
};

interface Report {
  id: string; org_title: string; org_slug: string; org_published: boolean; service_title: string | null; service_type: string; approx_service_month: Date | string | null;
  experience_category: string; accessibility_rating: string; accessibility_notes: string | null; communication_rating: string; comments: string | null;
  publish_anonymously: boolean; contact_email: string | null; status: string; moderation_message: string | null; moderated_at: Date | null;
  moderator_name: string | null; published_at: Date | null; created_at: Date; submitter_name: string | null; submitter_email: string | null;
}

export default async function ReportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/reports");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const [r] = await asService((sql) =>
    sql.query<Report>(
      `select r.id, l.title as org_title, l.slug as org_slug, l.publication_status = 'published' as org_published, sl.title as service_title, r.service_type,
         r.approx_service_month, r.experience_category, r.accessibility_rating, r.accessibility_notes, r.communication_rating, r.comments, r.publish_anonymously,
         r.contact_email, r.status, r.moderation_message, r.moderated_at, mp.full_name as moderator_name, r.published_at, r.created_at,
         sp.full_name as submitter_name, sp.email as submitter_email
       from family_experience_reports r join listings l on l.id = r.organization_id left join listings sl on sl.id = r.service_id
       left join profiles mp on mp.id = r.moderator_id left join profiles sp on sp.id = r.submitted_by
       where r.id = $1`,
      [id],
    ),
  );
  if (!r) notFound();
  const result = resultFor(sp, {
    ...RESULTS,
    approved: r.publish_anonymously ? "Report approved and published anonymously on the provider's profile." : "Report approved. It will not be published because the family did not give permission.",
  });

  return (
    <>
      <PageHeader
        eyebrow="Family experience report"
        title={r.org_title}
        breadcrumbs={[{ label: "Family Reports", href: "/admin/reports" }, { label: r.org_title }]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-base">
            <WorkflowStatus kind="report" status={r.status} /> Received {formatDateTime(r.created_at)}
          </span>
        }
      />
      <ResultBanner message={result.message} warning={result.warning} />
      <p className="mb-6 rounded-lg border border-warning/40 bg-warning-soft p-4">
        <strong>Before approving:</strong> make sure the report contains no private medical information, no names of other people, and nothing that could
        identify the family. Reports are always published anonymously.
      </p>

      <div className="flex flex-col gap-8">
        <Section title="Report" id="report">
          <Panel>
            <DetailList
              items={[
                {
                  label: "Provider",
                  value: r.org_published ? (
                    <Link href={listingHref("organization", r.org_slug)} className="text-primary underline underline-offset-2">
                      {r.org_title}
                      <span className="sr-only"> (public profile)</span>
                    </Link>
                  ) : (
                    r.org_title
                  ),
                },
                { label: "Service", value: r.service_title ? `${r.service_title} (${r.service_type})` : r.service_type },
                { label: "Approximate month", value: r.approx_service_month ? formatDay(r.approx_service_month, { month: "long", year: "numeric" }) : null },
                { label: "Overall experience", value: label(EXPERIENCE_LABELS, r.experience_category) },
                { label: "Accessibility", value: label(RATING_LABELS, r.accessibility_rating) },
                { label: "Accessibility notes", value: r.accessibility_notes },
                { label: "Communication", value: label(RATING_LABELS, r.communication_rating) },
                { label: "Comments", value: r.comments ? <span className="whitespace-pre-line">{r.comments}</span> : null },
                { label: "Permission to publish", value: r.publish_anonymously ? "Yes — may be published anonymously" : "No — must not be published" },
                { label: "Published", value: r.published_at ? formatDateTime(r.published_at) : "Not published" },
              ]}
            />
          </Panel>
        </Section>

        <Section title="Private contact details" id="contact" description="Staff only. Use only to ask clarifying questions about this report.">
          <Panel>
            <DetailList
              items={[
                { label: "Account", value: r.submitter_name ? `${r.submitter_name} (${r.submitter_email})` : "Submitted without an account" },
                { label: "Contact email", value: r.contact_email ?? "Not provided" },
                ...(r.moderated_at ? [{ label: "Last moderated", value: `${formatDateTime(r.moderated_at)} by ${r.moderator_name ?? "a moderator"}` }] : []),
                ...(r.moderation_message ? [{ label: "Last message to submitter", value: r.moderation_message }] : []),
              ]}
            />
            {!r.submitter_name && (
              <p className="mt-3 text-sm text-muted-foreground">
                This report was submitted without an account, so messages cannot be delivered in the app. Use the contact email if one was provided.
              </p>
            )}
          </Panel>
        </Section>

        <InternalNotes entityType="family_report" entityId={r.id} revalidate={`/admin/reports/${r.id}`} title="Internal notes for this report" />

        <section aria-labelledby="moderation-heading" className="rounded-xl border-2 border-primary/30 bg-card p-5">
          <h2 id="moderation-heading" className="text-2xl font-bold">
            Moderation decision
          </h2>
          <p className="mt-1 mb-5 text-muted-foreground">
            {r.publish_anonymously
              ? "Approving publishes this report anonymously on the provider's public profile."
              : "The family did not give permission to publish. Approving records the review but the report stays private."}
          </p>
          <DecisionForm
            action={moderateReportAction}
            hidden={{ reportId: r.id }}
            fields={[
              {
                type: "textarea",
                name: "moderationMessage",
                label: "Message to the submitter",
                hint: "Required when rejecting or asking for clarification. Do not repeat private details from the report.",
                rows: 4,
                maxLength: 2000,
              },
            ]}
            buttons={[
              ...(r.status !== "under_review" ? [{ label: "Mark Under Review", value: "under_review", variant: "outline" as const }] : []),
              ...(r.status !== "approved" ? [{ label: r.publish_anonymously ? "Approve & Publish" : "Approve (keep private)", value: "approved", variant: "default" as const }] : []),
              ...(r.status !== "needs_clarification" ? [{ label: "Needs Clarification", value: "needs_clarification", variant: "outline" as const }] : []),
              ...(r.status !== "rejected" ? [{ label: "Reject", value: "rejected", variant: "destructive" as const }] : []),
            ]}
          />
        </section>
      </div>
    </>
  );
}
