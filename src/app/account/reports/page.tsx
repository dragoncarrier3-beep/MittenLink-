import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MessageSquareWarning, Lightbulb, Users } from "lucide-react";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { CORRECTION_ISSUE_LABELS, EXPERIENCE_LABELS, REPORT_STATUS_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { formatDate, formatDay } from "@/lib/format";
import { PageHeader, Section } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { StatusPill, type Tone } from "@/components/common/badges";

export const metadata: Metadata = { title: "My Reports" };

const REPORT_TONE: Record<string, Tone> = { submitted: "info", under_review: "info", approved: "success", rejected: "danger", needs_clarification: "warning" };
const CORRECTION_LABELS: Record<string, string> = { new: "Received", in_review: "Under Review", resolved: "Resolved", dismissed: "Closed" };
const CORRECTION_TONE: Record<string, Tone> = { new: "info", in_review: "info", resolved: "success", dismissed: "neutral" };
const SUBMISSION_LABELS: Record<string, string> = { new: "Received", reviewed: "Reviewed", added_to_source_watch: "Being Researched", dismissed: "Closed" };
const SUBMISSION_TONE: Record<string, Tone> = { new: "info", reviewed: "success", added_to_source_watch: "success", dismissed: "neutral" };

interface FamilyRow {
  id: string;
  org_title: string | null;
  org_slug: string | null;
  service_type: string;
  experience_category: string;
  approx_service_month: string | Date | null;
  publish_anonymously: boolean;
  status: string;
  moderation_message: string | null;
  created_at: Date;
}
interface CorrectionRow {
  id: string;
  title: string | null;
  kind: string | null;
  slug: string | null;
  issue_type: string;
  details: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}
interface SubmissionRow {
  id: string;
  kind: string;
  name: string | null;
  description: string;
  city: string | null;
  county: string | null;
  status: string;
  created_at: Date;
}

export default async function MyReportsPage() {
  await requireUser("/account/reports");
  const { family, corrections, submissions } = await asCurrentUser(async (sql) => ({
    family: await sql.query<FamilyRow>(
      `select r.id, l.title as org_title, l.slug as org_slug, r.service_type, r.experience_category, r.approx_service_month,
              r.publish_anonymously, r.status, r.moderation_message, r.created_at
       from public.family_experience_reports r left join public.listings l on l.id = r.organization_id
       where r.submitted_by = auth.uid() order by r.created_at desc`,
    ),
    corrections: await sql.query<CorrectionRow>(
      `select c.id, l.title, l.kind, l.slug, c.issue_type, c.details, c.status, c.created_at, c.resolved_at
       from public.community_corrections c left join public.listings l on l.id = c.listing_id
       where c.submitter_user_id = auth.uid() order by c.created_at desc`,
    ),
    submissions: await sql.query<SubmissionRow>(
      `select s.id, s.kind, s.name, s.description, s.city, co.name as county, s.status, s.created_at
       from public.community_submissions s left join public.counties co on co.id = s.county_id
       where s.submitter_user_id = auth.uid() order by s.created_at desc`,
    ),
  }));
  const total = family.length + corrections.length + submissions.length;

  return (
    <>
      <PageHeader title="My reports" description="Family experience reports, corrections, and suggestions you've sent to MittenLink, with their current status." />
      {total === 0 ? (
        <EmptyState
          icon={FileText}
          title="You haven't sent any reports yet"
          description="When you report outdated information, share a family experience, or suggest a resource while signed in, you can follow it here."
          action={{ label: "Suggest a Resource", href: "/suggest" }}
        />
      ) : (
        <div className="flex flex-col gap-10">
          <Section title="Family experience reports" id="family-reports" description="Every report is reviewed by a moderator before anything is published.">
            {family.length === 0 ? (
              <EmptyState icon={Users} headingLevel={3} title="No family experience reports" description="You can share your experience from any provider's page." />
            ) : (
              <ul className="flex flex-col gap-3">
                {family.map((r) => (
                  <li key={r.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">
                        {r.org_slug && r.org_title ? (
                          <Link href={listingHref("organization", r.org_slug)} className="underline-offset-4 hover:underline">
                            {r.org_title}
                          </Link>
                        ) : (
                          (r.org_title ?? "Provider no longer listed")
                        )}
                      </h3>
                      <StatusPill tone={REPORT_TONE[r.status] ?? "neutral"}>{REPORT_STATUS_LABELS[r.status] ?? r.status}</StatusPill>
                    </div>
                    <p className="text-muted-foreground">
                      {r.service_type} · {EXPERIENCE_LABELS[r.experience_category] ?? r.experience_category} experience
                      {r.approx_service_month ? ` · around ${formatDay(r.approx_service_month, { month: "long", year: "numeric" })}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Submitted {formatDate(r.created_at)} · {r.publish_anonymously ? "May be published anonymously" : "Internal use only"}
                    </p>
                    {r.moderation_message && (
                      <div className="mt-3 rounded-lg border border-info/30 bg-info-soft p-3">
                        <p className="text-sm font-bold">Message from MittenLink</p>
                        <p>{r.moderation_message}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Corrections" id="corrections" description="Reports of outdated information on listings.">
            {corrections.length === 0 ? (
              <EmptyState icon={MessageSquareWarning} headingLevel={3} title="No corrections" description="Use “Report outdated information” on any listing to send a correction." />
            ) : (
              <ul className="flex flex-col gap-3">
                {corrections.map((c) => (
                  <li key={c.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">
                        {c.title && c.kind && c.slug ? (
                          <Link href={listingHref(c.kind, c.slug)} className="underline-offset-4 hover:underline">
                            {c.title}
                          </Link>
                        ) : (
                          "Listing no longer available"
                        )}
                      </h3>
                      <StatusPill tone={CORRECTION_TONE[c.status] ?? "neutral"}>{CORRECTION_LABELS[c.status] ?? c.status}</StatusPill>
                    </div>
                    <p className="font-semibold">{CORRECTION_ISSUE_LABELS[c.issue_type] ?? c.issue_type}</p>
                    <p className="line-clamp-3 text-muted-foreground">{c.details}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent {formatDate(c.created_at)}
                      {c.resolved_at ? ` · Closed ${formatDate(c.resolved_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Suggestions and requests" id="suggestions" description="Resources you suggested and things you told us you were looking for.">
            {submissions.length === 0 ? (
              <EmptyState icon={Lightbulb} headingLevel={3} title="No suggestions" action={{ label: "Suggest a Resource", href: "/suggest" }} />
            ) : (
              <ul className="flex flex-col gap-3">
                {submissions.map((s) => (
                  <li key={s.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">{s.kind === "resource_suggestion" ? (s.name ?? "Suggested resource") : "Request for help finding a resource"}</h3>
                      <StatusPill tone={SUBMISSION_TONE[s.status] ?? "neutral"}>{SUBMISSION_LABELS[s.status] ?? s.status}</StatusPill>
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">{s.description}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sent {formatDate(s.created_at)}
                      {s.city || s.county ? ` · ${[s.city, s.county ? `${s.county} County` : null].filter(Boolean).join(", ")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
