import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { InternalNotes } from "@/components/staff/internal-notes";
import { getListingAdmin, type ChildKind } from "@/lib/data/admin-records";
import { formatDateTime, formatDay } from "@/lib/format";
import { EVENT_TYPE_LABELS, KIND_LABELS, label, RESOURCE_TYPE_LABELS, WAITLIST_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { PublicationControl, VerificationControl } from "./listing-controls";
import { KIND_BASE } from "./listing-list";
import { DemoFlag, PublicationPill, PublicPageLink, SuccessBanner, VerificationHistoryList, YesNo } from "./record-parts";

const SECTION: Record<ChildKind, string> = { service: "Services", program: "Programs", resource: "Resources", event: "Events" };

const text = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

function kindDetails(kind: ChildKind, d: Record<string, unknown>) {
  switch (kind) {
    case "service":
      return [
        { label: "Ages", value: d.age_min != null || d.age_max != null ? `${d.age_min ?? 0} – ${d.age_max ?? "any"}` : "All ages" },
        { label: "Eligibility", value: text(d.eligibility) },
        { label: "Availability", value: label(WAITLIST_LABELS, d.waitlist_status as string) },
        { label: "Free", value: <YesNo value={d.is_free as boolean} /> },
        { label: "Referral required", value: <YesNo value={d.referral_required as boolean} /> },
        { label: "In person / home-based", value: `${d.in_person ? "In person" : "Not in person"} · ${d.home_based ? "Home-based available" : "No home visits"}` },
        { label: "Contact", value: [text(d.contact_phone), text(d.contact_email)].filter(Boolean).join(" · ") || null },
      ];
    case "program":
      return [
        { label: "Eligibility", value: text(d.eligibility) },
        { label: "Cost", value: d.is_free ? "Free" : text(d.cost_text) },
        { label: "Dates", value: d.start_date ? `${formatDay(d.start_date as string)}${d.end_date ? ` – ${formatDay(d.end_date as string)}` : ""}` : "Ongoing" },
        { label: "How to apply", value: text(d.application_instructions) },
        { label: "Website", value: text(d.website) },
        { label: "Contact", value: [text(d.contact_phone), text(d.contact_email)].filter(Boolean).join(" · ") || null },
      ];
    case "resource":
      return [
        { label: "Type", value: label(RESOURCE_TYPE_LABELS, d.resource_type as string) },
        { label: "Link", value: text(d.url) },
        { label: "Source", value: [text(d.source_name), text(d.source_url)].filter(Boolean).join(" — ") || null },
        { label: "Reading time", value: d.reading_minutes ? `${d.reading_minutes} minutes` : null },
      ];
    case "event":
      return [
        { label: "Type", value: label(EVENT_TYPE_LABELS, d.event_type as string) },
        { label: "Organizer", value: text(d.organizer_name) },
        { label: "Starts", value: formatDateTime(d.starts_at as Date) },
        { label: "Ends", value: formatDateTime(d.ends_at as Date) },
        { label: "Where", value: d.is_in_person ? [text(d.venue_name), text(d.street), text(d.city)].filter(Boolean).join(", ") || "In person" : "Online" },
        { label: "Cost", value: d.is_free ? "Free" : text(d.cost_text) },
        { label: "Registration", value: text(d.registration_url) },
        { label: "Accommodations", value: text(d.accommodations) },
      ];
  }
}

/** Admin detail for a service, program, resource or event. */
export async function ListingDetail({ kind, id, notice }: { kind: ChildKind; id: string; notice?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getListingAdmin(kind, id);
  if (!data) notFound();
  const { listing: l, details, categories, history } = data;
  const base = KIND_BASE[kind];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: SECTION[kind], href: base }, { label: l.title }]}
        eyebrow={KIND_LABELS[kind]}
        title={l.title}
        description={l.summary || undefined}
        actions={
          kind === "resource" ? (
            <Link href={`${base}/${l.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden /> Edit guide
            </Link>
          ) : undefined
        }
      />
      <SuccessBanner message={notice} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <VerificationBadge status={l.verification_status} />
        <PublicationPill status={l.publication_status} />
        <DemoFlag show={l.is_demo} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-4 text-xl font-bold">Record details</h2>
            <DetailList
              items={[
                {
                  label: "Organization",
                  value: l.org_id ? (
                    <Link href={`/admin/organizations/${l.org_id}`} className="text-primary underline">
                      {l.org_title}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{kind === "resource" ? "Published by MittenLink" : "Not linked to an organization"}</span>
                  ),
                },
                ...kindDetails(kind, details),
                { label: "Categories", value: categories.length ? categories.join(", ") : null },
                { label: "Primary city", value: [l.primary_city, l.county ? `${l.county} County` : null].filter(Boolean).join(", ") || null },
                { label: "Virtual option", value: <YesNo value={l.virtual_available} /> },
                { label: "Last verified", value: l.last_verified_at ? formatDateTime(l.last_verified_at) : "Never" },
                { label: "Next review", value: l.next_review_at ? formatDay(l.next_review_at) : "Not scheduled" },
                { label: "Created", value: formatDateTime(l.created_at) },
                { label: "Last updated", value: formatDateTime(l.updated_at) },
              ]}
            />
            {l.description && (
              <div className="mt-5">
                <h3 className="font-bold">Description</h3>
                <p className="mt-1 whitespace-pre-line">{l.description}</p>
              </div>
            )}
            {kind === "resource" && typeof details.body === "string" && details.body && (
              <details className="mt-5 rounded-lg border p-3">
                <summary className="min-h-11 cursor-pointer font-semibold">Guide text</summary>
                <div className="mt-2 flex flex-col gap-3">
                  {details.body.split(/\n\s*\n/).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            )}
            <div className="mt-4">
              <PublicPageLink href={listingHref(kind, l.slug)} published={l.publication_status === "published"} title={l.title} />
            </div>
          </Panel>

          <Section title="Verification history" description="Includes staff-only notes and sources. Only the public summary appears on public pages.">
            <VerificationHistoryList history={history} />
          </Section>

          <InternalNotes entityType="listing" entityId={l.id} revalidate={`${base}/${l.id}`} />
        </div>

        <div className="flex flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-1 text-xl font-bold">Verification</h2>
            <p className="mb-4 text-sm text-muted-foreground">Verification is independent of listing tier or payment.</p>
            <VerificationControl listingId={l.id} current={l.verification_status} />
          </Panel>
          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Publication</h2>
            <PublicationControl listingId={l.id} current={l.publication_status} title={l.title} />
          </Panel>
        </div>
      </div>
    </>
  );
}
