import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { InternalNotes } from "@/components/staff/internal-notes";
import { AdminActionForm } from "@/components/admin/action-form";
import { PublicationControl, VerificationControl } from "@/components/admin/listing-controls";
import { ContactProvenanceForm, OrgEditForm } from "@/components/admin/org-forms";
import { DemoFlag, PublicationPill, PublicPageLink, SuccessBanner, VerificationHistoryList, YesNo } from "@/components/admin/record-parts";
import {
  sp, type SearchParams, CONFIDENCE_LABELS, CONTACT_KIND_LABELS, CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS, LOCATION_STATUS_LABELS, MEMBER_ROLE_LABELS,
} from "@/components/admin/admin-labels";
import { getOrganizationAdmin } from "@/lib/data/admin-records";
import { mediaUrl } from "@/lib/integrations/storage";
import { formatCents, formatDateTime, formatDay, formatShortDate } from "@/lib/format";
import { CLAIM_RELATIONSHIP_LABELS, CLAIM_STATUS_LABELS, KIND_LABELS, label, ORG_TYPE_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { moderateMediaAction, saveContactAction, setMemberAccessAction, updateOrganizationAction } from "../actions";

export const metadata: Metadata = { title: "Manage organization" };

const CHILD_BASE: Record<string, string> = { service: "/admin/services", program: "/admin/programs", event: "/admin/events" };

const NOTICES: Record<string, string> = {
  "logo-approved": "Logo approved. It now appears on the Enhanced Listing and the provider was notified.",
  "logo-rejected": "Upload rejected. The provider was notified and can upload a new image.",
};

export default async function AdminOrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const saved = sp((await searchParams).saved);
  await requireAdmin(`/admin/organizations/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getOrganizationAdmin(id);
  if (!data) notFound();
  const { org, locations, children, managers, claims, subscription, contacts, pendingMedia, history } = data;
  const self = `/admin/organizations/${org.id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organizations", href: "/admin/organizations" }, { label: org.title }]}
        eyebrow="Organization"
        title={org.title}
        description={org.summary || undefined}
      />
      <SuccessBanner message={saved ? NOTICES[saved] : undefined} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <VerificationBadge status={org.verification_status} />
        <PublicationPill status={org.publication_status} />
        <ListingTierBadge tier={org.listing_tier} showFree />
        <StatusPill tone={org.claimed_at ? "lake" : "neutral"}>{org.claimed_at ? "Claimed" : "Unclaimed"}</StatusPill>
        <DemoFlag show={org.is_demo} />
      </div>

      <nav aria-label="On this page" className="mb-6 rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-bold">On this page</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[
            ["overview", "Overview"],
            ["edit", "Edit details"],
            ["locations", "Locations"],
            ["records", "Services, programs & events"],
            ["managers", "Managers"],
            ["claims", "Claims"],
            ["contacts", "Contact provenance"],
            ["history", "Verification history"],
          ].map(([anchor, text]) => (
            <li key={anchor}>
              <a href={`#${anchor}`} className="inline-flex min-h-11 items-center text-primary underline">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section id="overview" title="Overview">
            <Panel>
              <DetailList
                items={[
                  { label: "Organization type", value: label(ORG_TYPE_LABELS, org.org_type) },
                  { label: "Website", value: org.website ? <a href={org.website} className="break-all text-primary underline" target="_blank" rel="noopener noreferrer">{org.website}</a> : null },
                  { label: "Public phone", value: org.public_phone },
                  { label: "Public email", value: org.public_email },
                  { label: "Primary city", value: [org.primary_city, org.county ? `${org.county} County` : null].filter(Boolean).join(", ") || null },
                  { label: "Accessibility", value: org.accessibility_info },
                  { label: "Claimed", value: org.claimed_at ? `Yes, on ${formatShortDate(org.claimed_at)}` : "No" },
                  { label: "Last verified", value: org.last_verified_at ? formatDateTime(org.last_verified_at) : "Never" },
                  { label: "Next review", value: org.next_review_at ? formatDay(org.next_review_at) : "Not scheduled" },
                  { label: "Created", value: formatDateTime(org.created_at) },
                  { label: "Last updated", value: formatDateTime(org.updated_at) },
                ]}
              />
              {org.description && (
                <div className="mt-5">
                  <h3 className="font-bold">Description</h3>
                  <p className="mt-1 whitespace-pre-line">{org.description}</p>
                </div>
              )}
              <div className="mt-4">
                <PublicPageLink href={listingHref("organization", org.slug)} published={org.publication_status === "published"} title={org.title} />
              </div>
            </Panel>
          </Section>

          <Section id="edit" title="Edit details" description="Administrators edit directly. Every change is recorded in the audit log with the previous and new values.">
            <Panel>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Open the edit form</summary>
                <div className="mt-4">
                  <OrgEditForm
                    action={updateOrganizationAction}
                    defaults={{
                      id: org.id, title: org.title, summary: org.summary, description: org.description, orgType: org.org_type, website: org.website,
                      publicPhone: org.public_phone, publicEmail: org.public_email, accessibilityInfo: org.accessibility_info,
                    }}
                  />
                </div>
              </details>
            </Panel>
          </Section>

          <Section id="locations" title="Locations" description={`${locations.length} location${locations.length === 1 ? "" : "s"}.`}>
            <DataTable
              caption={`Locations for ${org.title}`}
              rows={locations}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No physical locations. This organization serves people virtually or by service area.</p>}
              columns={[
                { key: "name", header: "Location", primary: true, cell: (r) => <span>{r.name}{r.is_primary && <span className="ml-2 text-sm font-normal text-muted-foreground">(Primary)</span>}</span> },
                { key: "address", header: "Address", cell: (r) => `${r.street}${r.street2 ? `, ${r.street2}` : ""}, ${r.city} ${r.zip}` },
                { key: "county", header: "County", cell: (r) => `${r.county} County` },
                { key: "access", header: "Wheelchair accessible", cell: (r) => <YesNo value={r.wheelchair_accessible} /> },
                { key: "status", header: "Status", cell: (r) => label(LOCATION_STATUS_LABELS, r.status) },
              ]}
            />
          </Section>

          <Section id="records" title="Services, programs & events">
            <DataTable
              caption={`Services, programs and events for ${org.title}`}
              rows={children}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No services, programs or events are linked to this organization yet.</p>}
              columns={[
                { key: "title", header: "Title", primary: true, cell: (r) => <Link href={`${CHILD_BASE[r.kind]}/${r.id}`} className="text-primary underline">{r.title}</Link> },
                { key: "kind", header: "Type", cell: (r) => (r.kind === "event" && r.starts_at ? `${KIND_LABELS[r.kind]} · ${formatShortDate(r.starts_at)}` : KIND_LABELS[r.kind]) },
                { key: "verification", header: "Verification", cell: (r) => <VerificationBadge status={r.verification_status} /> },
                { key: "publication", header: "Publication", cell: (r) => <PublicationPill status={r.publication_status} /> },
              ]}
            />
          </Section>

          <Section id="managers" title="Managers" description="People who can propose updates for this organization. Revoking access takes effect immediately.">
            <DataTable
              caption={`Managers of ${org.title}`}
              rows={managers}
              rowKey={(r) => r.user_id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No one manages this organization yet.</p>}
              columns={[
                { key: "name", header: "Name", primary: true, cell: (r) => <Link href={`/admin/users/${r.user_id}`} className="text-primary underline">{r.full_name}</Link> },
                { key: "email", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> },
                { key: "role", header: "Role", cell: (r) => label(MEMBER_ROLE_LABELS, r.member_role) },
                { key: "status", header: "Access", cell: (r) => <StatusPill tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "Active" : "Revoked"}</StatusPill> },
                { key: "since", header: "Since", cell: (r) => formatShortDate(r.created_at) },
                {
                  key: "action",
                  header: "Action",
                  srOnlyHeader: true,
                  cell: (r) => (
                    <AdminActionForm
                      action={setMemberAccessAction}
                      hidden={{ organizationId: org.id, userId: r.user_id, decision: r.status === "active" ? "revoke" : "restore" }}
                      label={r.status === "active" ? <>Revoke access<span className="sr-only"> for {r.full_name}</span></> : <>Restore access<span className="sr-only"> for {r.full_name}</span></>}
                      size="sm"
                      variant={r.status === "active" ? "destructive" : "outline"}
                      pendingLabel="Updating…"
                      confirm={
                        r.status === "active"
                          ? { title: `Revoke ${r.full_name}'s access?`, description: `${r.full_name} will no longer be able to manage ${org.title}. They will be notified.`, confirmLabel: "Revoke access", destructive: true }
                          : { title: `Restore ${r.full_name}'s access?`, description: `${r.full_name} will again be able to propose updates for ${org.title}.`, confirmLabel: "Restore access" }
                      }
                    />
                  ),
                },
              ]}
            />
          </Section>

          <Section id="claims" title="Claims history">
            <DataTable
              caption={`Claims for ${org.title}`}
              rows={claims}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No claims have been submitted for this organization.</p>}
              columns={[
                { key: "claimant", header: "Claimant", primary: true, cell: (r) => <span>{r.claimant_name}<span className="block text-sm font-normal text-muted-foreground">{r.claimant_title} · {label(CLAIM_RELATIONSHIP_LABELS, r.relationship)}</span></span> },
                { key: "email", header: "Work email", cell: (r) => <span className="break-all">{r.work_email}</span> },
                { key: "status", header: "Status", cell: (r) => label(CLAIM_STATUS_LABELS, r.status) },
                { key: "submitted", header: "Submitted", cell: (r) => formatShortDate(r.submitted_at) },
                { key: "reviewed", header: "Reviewed", cell: (r) => (r.reviewed_at ? `${formatShortDate(r.reviewed_at)}${r.reviewer ? ` by ${r.reviewer}` : ""}` : "—") },
              ]}
            />
          </Section>

          <Section id="contacts" title="Contact provenance" description="Where each public contact detail came from and how confident we are in it. Staff only.">
            <div className="flex flex-col gap-3">
              {contacts.length === 0 && <p className="rounded-xl border bg-card p-4 text-muted-foreground">No contact provenance has been recorded yet.</p>}
              {contacts.map((c) => (
                <Panel key={c.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-all">
                        {label(CONTACT_KIND_LABELS, c.kind)}
                        {c.label ? ` (${c.label})` : ""}: {c.value}
                      </p>
                      {c.location_name && <p className="text-sm text-muted-foreground">Location: {c.location_name}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={c.status === "active" ? "success" : c.status === "outdated" ? "danger" : "warning"}>{label(CONTACT_STATUS_LABELS, c.status)}</StatusPill>
                      <StatusPill tone={c.confidence === "high" ? "success" : c.confidence === "low" ? "warning" : "info"}>{label(CONFIDENCE_LABELS, c.confidence)} confidence</StatusPill>
                      {!c.is_public && <StatusPill>Not public</StatusPill>}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="font-semibold">Source</dt>
                    <dd>
                      {label(CONTACT_SOURCE_LABELS, c.source_type)}
                      {c.source_url && (
                        <>
                          {" — "}
                          <a href={c.source_url} className="break-all text-primary underline" target="_blank" rel="noopener noreferrer">{c.source_url}</a>
                        </>
                      )}
                    </dd>
                    <dt className="font-semibold">Discovered</dt>
                    <dd>{formatShortDate(c.discovered_at)}</dd>
                    <dt className="font-semibold">Last verified</dt>
                    <dd>{c.last_verified_at ? `${formatShortDate(c.last_verified_at)}${c.verified_by_name ? ` by ${c.verified_by_name}` : ""}` : "Not yet verified"}</dd>
                  </dl>
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">
                      Edit this record<span className="sr-only">: {c.value}</span>
                    </summary>
                    <div className="mt-3">
                      <ContactProvenanceForm
                        action={saveContactAction}
                        organizationId={org.id}
                        defaults={{ contactId: c.id, kind: c.kind, label: c.label, value: c.value, sourceType: c.source_type, sourceUrl: c.source_url, confidence: c.confidence, status: c.status, isPublic: c.is_public }}
                      />
                    </div>
                  </details>
                </Panel>
              ))}
              <Panel>
                <h3 className="mb-3 text-lg font-bold">Add a provenance record</h3>
                <ContactProvenanceForm action={saveContactAction} organizationId={org.id} />
              </Panel>
            </div>
          </Section>

          <Section id="history" title="Verification history" description="Includes staff-only notes and sources. Only the public summary appears on public pages.">
            <VerificationHistoryList history={history} />
          </Section>

          <InternalNotes entityType="listing" entityId={org.id} revalidate={self} />
        </div>

        <div className="flex flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-1 text-xl font-bold">Verification</h2>
            <p className="mb-4 text-sm text-muted-foreground">Verification is independent of listing tier or payment.</p>
            <VerificationControl listingId={org.id} current={org.verification_status} />
          </Panel>
          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Publication</h2>
            <PublicationControl listingId={org.id} current={org.publication_status} title={org.title} />
          </Panel>
          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Enhanced Listing</h2>
            {subscription ? (
              <DetailList
                items={[
                  { label: "Status", value: label(SUBSCRIPTION_STATUS_LABELS, subscription.status) },
                  { label: "Provider", value: subscription.billing_provider === "demo" ? "Demo (no charges)" : "Stripe (test mode)" },
                  { label: "Price", value: formatCents(subscription.price_cents, subscription.currency) },
                  { label: "Period ends", value: subscription.current_period_end ? formatShortDate(subscription.current_period_end) : "—" },
                  { label: "Started", value: formatShortDate(subscription.created_at) },
                ]}
              />
            ) : (
              <p className="text-muted-foreground">No subscription. This is a Free Listing.</p>
            )}
            <Link href="/admin/billing" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline">
              View all Enhanced Listings
            </Link>
          </Panel>
          <Panel as="section">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <ImageIcon className="size-5" aria-hidden /> Logo moderation
            </h2>
            {org.logo_path && (
              <div className="mb-4">
                <p className="text-sm font-semibold">Current logo</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(org.logo_path) ?? ""} alt={org.logo_alt ?? `${org.title} logo`} className="mt-2 max-h-24 rounded border bg-white p-2" />
              </div>
            )}
            {pendingMedia.length === 0 ? (
              <p className="text-muted-foreground">No uploads are waiting for review.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {pendingMedia.map((m) => (
                  <li key={m.id} className="rounded-lg border p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(m.storage_path) ?? ""} alt={m.alt_text} className="max-h-32 rounded border bg-white p-2" />
                    <p className="mt-2 text-sm break-all text-muted-foreground">File: {m.storage_path}</p>
                    <p className="text-sm">
                      <span className="font-semibold">Alt text:</span> {m.alt_text}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Uploaded {formatShortDate(m.created_at)}
                      {m.uploader ? ` by ${m.uploader}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminActionForm
                        action={moderateMediaAction}
                        hidden={{ mediaId: m.id, decision: "approve" }}
                        label="Approve"
                        variant="default"
                        size="sm"
                        confirm={{ title: "Approve this logo?", description: "It will replace the current logo on the organization's Enhanced Listing.", confirmLabel: "Approve logo" }}
                      />
                      <AdminActionForm
                        action={moderateMediaAction}
                        hidden={{ mediaId: m.id, decision: "reject" }}
                        label="Reject"
                        variant="destructive"
                        size="sm"
                        confirm={{ title: "Reject this upload?", description: "The provider will be notified and can upload a new image.", confirmLabel: "Reject upload", destructive: true }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
