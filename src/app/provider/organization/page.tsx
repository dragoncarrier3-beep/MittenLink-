import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ImageIcon } from "lucide-react";
import { PageHeader, Panel, Section, DetailList } from "@/components/common/page";
import { ListingTierBadge, StatusPill, VerificationBadge, LastReviewed } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getOrganization, getReferenceOptions, listChangeRequests, listLogoMedia, loadProviderContext } from "@/lib/data/provider";
import { mediaUrl } from "@/lib/integrations/storage";
import { formatDate } from "@/lib/format";
import { ORG_TYPE_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { withdrawChangeRequest } from "../change-actions";
import { firstParam, openRequestFor, s, withProposal } from "../_lib/prefill";
import { OrganizationForm } from "./organization-form";
import { LogoUploadForm, WithdrawLogoButton } from "./logo-form";

export const metadata: Metadata = { title: "Organization Profile" };

const MEDIA_STATUS: Record<string, { text: string; tone: "info" | "success" | "danger" }> = {
  pending_review: { text: "Pending review", tone: "info" },
  approved: { text: "Approved", tone: "success" },
  rejected: { text: "Not approved", tone: "danger" },
};

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/organization");
  const [org, ref, requests, logos] = await Promise.all([
    getOrganization(ctx.org.id),
    getReferenceOptions(),
    listChangeRequests(ctx.org.id),
    listLogoMedia(ctx.org.id),
  ]);
  if (!org) {
    return <EmptyState title="Organization not found" description="We couldn't load this organization. Please choose another organization or contact MittenLink support." />;
  }
  const isEnhanced = org.listing_tier === "enhanced";
  const pending = openRequestFor(requests, "organization", org.id, firstParam(sp.revise));
  const current = {
    title: org.title,
    summary: org.summary,
    description: org.description,
    website: s(org.website),
    public_phone: s(org.public_phone),
    public_email: s(org.public_email),
    accessibility_info: s(org.accessibility_info),
    org_type: org.org_type,
    expanded_description: s(org.expanded_description),
    categories: org.categories,
    populations: org.populations,
    languages: org.languages,
  };
  const merged = withProposal(current, pending);
  const values = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : s(v)])) as typeof current;
  const catName = Object.fromEntries(ref.categories.map((o) => [o.value, o.label]));
  const pendingLogo = logos.find((l) => l.status === "pending_review");

  return (
    <>
      <PageHeader
        title="Organization Profile"
        description="Update how your organization appears on MittenLink. Every change is reviewed by a MittenLink verifier before it is published."
        actions={
          org.publication_status === "published" ? (
            <Link href={listingHref("organization", org.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 font-semibold hover:bg-muted">
              View public listing <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-8">
        <Section title="Currently published" description="This is what families see today.">
          <Panel>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <VerificationBadge status={org.verification_status} />
              <ListingTierBadge tier={org.listing_tier} showFree />
              <LastReviewed date={org.last_verified_at} />
            </div>
            <DetailList
              items={[
                { label: "Name", value: org.title },
                { label: "Organization type", value: label(ORG_TYPE_LABELS, org.org_type) },
                { label: "Short description", value: org.summary || null },
                { label: "Website", value: org.website },
                { label: "Public phone", value: org.public_phone },
                { label: "Public email", value: org.public_email },
                { label: "Accessibility", value: org.accessibility_info },
                { label: "Categories", value: org.categories.length ? org.categories.map((c) => catName[c] ?? c).join(", ") : null },
                ...(isEnhanced ? [{ label: "Expanded description", value: org.expanded_description ? <span className="line-clamp-3">{org.expanded_description}</span> : null }] : []),
              ]}
            />
          </Panel>
        </Section>

        <Section title={pending ? "Revise your pending update" : "Propose changes"} id="edit">
          {pending && (
            <PendingNotice request={pending} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} className="mb-4" />
          )}
          {pending && (
            <p className="mb-4 text-muted-foreground">
              The form below includes the changes you already submitted. Submitting again replaces your pending update.
            </p>
          )}
          <Panel>
            <OrganizationForm
              values={values}
              replaces={pending?.id ?? null}
              isEnhanced={isEnhanced}
              options={{ categories: ref.categories, populations: ref.populations, languages: ref.languages }}
              orgTypeOptions={Object.entries(ORG_TYPE_LABELS).map(([value, l]) => ({ value, label: l }))}
              fieldLabels={FIELD_LABELS}
            />
          </Panel>
        </Section>

        <Section id="logo" title="Logo" description="Logos are an Enhanced Listing feature and are reviewed before they appear publicly.">
          <Panel className="flex flex-col gap-5">
            {org.logo_path ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(org.logo_path)!} alt={org.logo_alt ?? `${org.title} logo`} className="size-24 rounded-lg border bg-white object-contain p-1" />
                <p className="text-muted-foreground">This logo is currently published on your listing.</p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="size-5" aria-hidden /> No logo is published yet.
              </p>
            )}

            {logos.length > 0 && (
              <div>
                <h3 className="mb-2 text-lg font-bold">Recent uploads</h3>
                <ul className="flex flex-col gap-3">
                  {logos.map((m) => {
                    const st = MEDIA_STATUS[m.status] ?? MEDIA_STATUS.pending_review;
                    return (
                      <li key={m.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(m.storage_path)!} alt={m.alt_text} className="size-16 rounded border bg-white object-contain p-1" />
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone={st.tone}>Logo status: {st.text}</StatusPill>
                            <span className="text-sm text-muted-foreground">Uploaded {formatDate(m.created_at)}</span>
                          </div>
                          <p className="text-sm">
                            <span className="font-semibold">Alt text:</span> {m.alt_text}
                          </p>
                          {m.status === "pending_review" && <WithdrawLogoButton mediaId={m.id} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {isEnhanced ? (
              pendingLogo ? (
                <p className="rounded-lg border border-info/30 bg-info-soft p-3">
                  Your new logo is waiting for review. You can upload a different file after it is reviewed or withdrawn.
                </p>
              ) : (
                <LogoUploadForm defaultAlt={org.logo_alt ?? `${org.title} logo`} />
              )
            ) : (
              <div className="rounded-lg border border-enhanced/30 bg-enhanced-soft p-4">
                <p className="font-semibold">Add your logo with MittenLink Enhanced.</p>
                <p className="mt-1 text-muted-foreground">
                  Enhanced adds a logo, expanded description, featured services and profile analytics. Verification is free and never depends on payment.
                </p>
                <Link href="/provider/plan" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline">
                  Compare listing plans
                </Link>
              </div>
            )}
          </Panel>
        </Section>
      </div>
    </>
  );
}
