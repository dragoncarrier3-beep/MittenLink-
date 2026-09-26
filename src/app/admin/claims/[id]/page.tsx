import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { VerificationBadge } from "@/components/common/badges";
import { DataTable } from "@/components/common/data-table";
import { DecisionForm } from "@/components/staff/action-form";
import { DomainMatch } from "@/components/staff/domain-match";
import { InternalNotes } from "@/components/staff/internal-notes";
import { WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { resultFor, type SearchParams } from "@/components/staff/result";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { CLAIM_RELATIONSHIP_LABELS, CLAIM_STATUS_LABELS, ROLE_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { reviewClaimAction } from "../actions";

export const metadata: Metadata = { title: "Review Claim" };

const RESULTS: Record<string, string> = {
  under_review: "Claim marked Under Review. The claimant was notified.",
  more_info_required: "More information requested. The claimant was notified with your message.",
  approved: "Claim approved. The claimant can now manage this organization from the Provider Dashboard.",
  rejected: "Claim rejected. The claimant was notified with your message.",
};

interface Claim {
  id: string; organization_id: string; claimant_user_id: string; relationship: string; claimant_name: string; claimant_title: string; work_email: string;
  work_phone: string | null; verification_details: string; evidence_url: string | null; status: string; message_to_claimant: string | null;
  reviewed_at: Date | null; reviewer_name: string | null; submitted_at: Date | null; created_at: Date;
  org_title: string; org_slug: string; org_publication: string; org_verification: string; website: string | null; public_email: string | null; public_phone: string | null;
  claimed_at: Date | null;
  account_email: string; account_name: string; account_created: Date; account_active: boolean; account_roles: string[] | null;
}

export default async function ClaimDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/claims");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const data = await asService(async (sql) => {
    const [claim] = await sql.query<Claim>(
      `select c.*, rp.full_name as reviewer_name, l.title as org_title, l.slug as org_slug, l.publication_status as org_publication,
         l.verification_status as org_verification, o.website, o.public_email, o.public_phone, o.claimed_at,
         p.email as account_email, p.full_name as account_name, p.created_at as account_created, p.is_active as account_active,
         (select array_agg(role_key order by role_key) from user_roles ur where ur.user_id = c.claimant_user_id) as account_roles
       from provider_claims c join listings l on l.id = c.organization_id join organizations o on o.id = c.organization_id
       join profiles p on p.id = c.claimant_user_id left join profiles rp on rp.id = c.reviewed_by
       where c.id = $1 and c.status <> 'draft'`,
      [id],
    );
    if (!claim) return null;
    const others = await sql.query<{ id: string; claimant_name: string; claimant_title: string; status: string; submitted_at: Date | null }>(
      `select id, claimant_name, claimant_title, status, submitted_at from provider_claims
       where organization_id = $1 and id <> $2 and status <> 'draft' order by submitted_at desc nulls last`,
      [claim.organization_id, claim.id],
    );
    const managers = await sql.query<{ full_name: string; email: string; member_role: string }>(
      `select p.full_name, p.email, m.member_role from provider_members m join profiles p on p.id = m.user_id
       where m.organization_id = $1 and m.status = 'active' order by p.full_name`,
      [claim.organization_id],
    );
    return { claim, others, managers };
  });
  if (!data) notFound();
  const { claim, others, managers } = data;
  const decided = ["approved", "rejected"].includes(claim.status);
  const result = resultFor(sp, RESULTS);
  const evidence = claim.evidence_url && /^https?:\/\//i.test(claim.evidence_url) ? claim.evidence_url : null;

  return (
    <>
      <PageHeader
        eyebrow="Provider claim"
        title={claim.org_title}
        breadcrumbs={[{ label: "Provider Claims", href: "/admin/claims" }, { label: claim.org_title }]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-base">
            <WorkflowStatus kind="claim" status={claim.status} /> Claim by {claim.claimant_name}
          </span>
        }
      />
      <ResultBanner message={result.message} warning={result.warning} />

      <div className="flex flex-col gap-8">
        <Section title="Claim details" id="claim">
          <Panel>
            <DetailList
              items={[
                { label: "Relationship", value: label(CLAIM_RELATIONSHIP_LABELS, claim.relationship) },
                { label: "Name", value: claim.claimant_name },
                { label: "Title", value: claim.claimant_title },
                {
                  label: "Work email",
                  value: (
                    <span className="flex flex-col gap-1">
                      <span className="break-all">{claim.work_email}</span>
                      <DomainMatch email={claim.work_email} website={claim.website} />
                    </span>
                  ),
                },
                { label: "Work phone", value: claim.work_phone },
                { label: "How to verify their role", value: <span className="whitespace-pre-line">{claim.verification_details}</span> },
                {
                  label: "Evidence link",
                  value: evidence ? (
                    <a href={evidence} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline underline-offset-2">
                      {evidence} <ExternalLink className="size-4 shrink-0" aria-hidden />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    "None provided"
                  ),
                },
                { label: "Submitted", value: claim.submitted_at ? formatDateTime(claim.submitted_at) : "—" },
                ...(claim.reviewed_at ? [{ label: "Last reviewed", value: `${formatDateTime(claim.reviewed_at)} by ${claim.reviewer_name ?? "an administrator"}` }] : []),
                ...(claim.message_to_claimant ? [{ label: "Last message to claimant", value: <span className="whitespace-pre-line">{claim.message_to_claimant}</span> }] : []),
              ]}
            />
          </Panel>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Organization" id="org">
            <Panel>
              <DetailList
                items={[
                  {
                    label: "Name",
                    value:
                      claim.org_publication === "published" ? (
                        <Link href={listingHref("organization", claim.org_slug)} className="text-primary underline underline-offset-2">
                          {claim.org_title}
                          <span className="sr-only"> (public profile)</span>
                        </Link>
                      ) : (
                        claim.org_title
                      ),
                  },
                  { label: "Verification", value: <VerificationBadge status={claim.org_verification} /> },
                  { label: "Claimed", value: claim.claimed_at ? `Yes, since ${formatShortDate(claim.claimed_at)}` : "Not claimed yet" },
                  { label: "Website", value: claim.website },
                  { label: "Public email", value: claim.public_email },
                  { label: "Public phone", value: claim.public_phone },
                  {
                    label: "Current managers",
                    value: managers.length ? managers.map((m) => `${m.full_name} (${m.email}, ${m.member_role})`).join("; ") : "No one manages this organization yet",
                  },
                ]}
              />
            </Panel>
          </Section>
          <Section title="Claimant's account" id="account">
            <Panel>
              <DetailList
                items={[
                  { label: "Account name", value: claim.account_name },
                  { label: "Sign-in email", value: <span className="break-all">{claim.account_email}</span> },
                  { label: "Member since", value: formatShortDate(claim.account_created) },
                  { label: "Account status", value: claim.account_active ? "Active" : "Deactivated" },
                  { label: "Roles", value: (claim.account_roles ?? []).map((r) => label(ROLE_LABELS, r)).join(", ") || "None" },
                ]}
              />
            </Panel>
          </Section>
        </div>

        <Section title="Other claims for this organization" id="others">
          <DataTable
            caption="Other claims for this organization"
            rows={others}
            rowKey={(r) => r.id}
            empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No other claims have been submitted for this organization.</p>}
            columns={[
              {
                key: "who",
                header: "Claimant",
                primary: true,
                cell: (r) => (
                  <Link href={`/admin/claims/${r.id}`} className="text-primary underline underline-offset-2">
                    {r.claimant_name}
                  </Link>
                ),
              },
              { key: "title", header: "Title", cell: (r) => r.claimant_title },
              { key: "submitted", header: "Submitted", cell: (r) => (r.submitted_at ? formatShortDate(r.submitted_at) : "—") },
              { key: "status", header: "Status", cell: (r) => label(CLAIM_STATUS_LABELS, r.status) },
            ]}
          />
        </Section>

        <InternalNotes entityType="claim" entityId={claim.id} revalidate={`/admin/claims/${claim.id}`} title="Internal notes for this claim" />

        {decided ? (
          <p className="rounded-xl border bg-card p-4">
            This claim was <strong>{label(CLAIM_STATUS_LABELS, claim.status).toLowerCase()}</strong>
            {claim.reviewed_at ? ` on ${formatShortDate(claim.reviewed_at)}` : ""} and can no longer be changed.
          </p>
        ) : (
          <section aria-labelledby="decision-heading" className="rounded-xl border-2 border-primary/30 bg-card p-5">
            <h2 id="decision-heading" className="text-2xl font-bold">
              Decision
            </h2>
            <div className="mt-3 mb-5 flex gap-3 rounded-lg bg-info-soft p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
              <p>
                <strong>Approving grants provider management access.</strong> {claim.claimant_name} will be able to manage {claim.org_title} from the Provider
                Dashboard and submit updates. Their changes to public information are still reviewed by a verifier before publishing.
              </p>
            </div>
            <DecisionForm
              action={reviewClaimAction}
              hidden={{ claimId: claim.id }}
              fields={[
                {
                  type: "textarea",
                  name: "messageToClaimant",
                  label: "Message to claimant",
                  hint: "Required when requesting more information or rejecting. Sent to the claimant by email and in their account.",
                  rows: 4,
                  maxLength: 2000,
                },
                { type: "textarea", name: "internalNote", label: "Internal note", hint: "Optional. Visible to MittenLink staff only.", rows: 3, maxLength: 4000 },
              ]}
              buttons={[
                ...(claim.status === "submitted" ? [{ label: "Mark Under Review", value: "under_review", variant: "outline" as const }] : []),
                { label: "Request More Information", value: "more_info_required", variant: "outline" as const },
                { label: "Approve Claim", value: "approved", variant: "default" as const },
                { label: "Reject Claim", value: "rejected", variant: "destructive" as const },
              ]}
            />
          </section>
        )}
      </div>
    </>
  );
}
