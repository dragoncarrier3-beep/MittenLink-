import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Building2, HandHeart, Mail, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/common/page";
import { LastReviewed, ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/listings/save-button";
import {
  DetailSection,
  LocationCard,
  ReportOutdatedLink,
  TagList,
  TrustNote,
  VerificationInfo,
  VerificationNotice,
  ageRange,
  deliveryModes,
  splitParagraphs,
} from "@/components/listings/detail-parts";
import { getServiceDetail } from "@/lib/data/profiles";
import { getSavedState } from "@/lib/data/saved";
import { track } from "@/lib/server/analytics";
import { WAITLIST_LABELS, label } from "@/lib/labels";
import { telHref } from "@/lib/format";

const load = cache((slug: string) => getServiceDetail(slug));

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await load(slug);
    if (!d) return { title: "Service not found" };
    return { title: d.org ? `${d.base.title} — ${d.org.title}` : d.base.title, description: d.base.summary };
  } catch {
    return { title: "Service" };
  }
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d || !d.service) notFound();
  const { base, service: s, org, locations, tax, history, related } = d;
  const saved = await getSavedState([base.id]);
  await track("service_viewed", { listingId: base.id });
  const phone = base.contact_phone ?? org?.public_phone ?? null;
  const email = base.contact_email ?? org?.public_email ?? null;
  const accepting = s.waitlist_status === "accepting" || s.waitlist_status === "short_wait";

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(org ? [{ label: org.title, href: `/providers/${org.slug}` }] : [{ label: "Search", href: "/search" }]),
          { label: base.title },
        ]}
      />
      <header className="mt-4 mb-6 flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
          <HandHeart className="size-4" aria-hidden /> Service
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{base.title}</h1>
        {org && (
          <p className="text-lg">
            Offered by{" "}
            <Link href={`/providers/${org.slug}`} className="font-semibold text-primary underline">
              {org.title}
            </Link>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={base.verification_status} />
          {org && <ListingTierBadge tier={org.listing_tier} />}
          <StatusPill tone={accepting ? "success" : s.waitlist_status === "waitlist" ? "warning" : "danger"}>{label(WAITLIST_LABELS, s.waitlist_status)}</StatusPill>
          <LastReviewed date={base.last_verified_at} />
        </div>
        <p className="max-w-3xl text-lg text-muted-foreground">{base.summary}</p>
        <div className="flex flex-wrap gap-2">
          {phone && (
            <a href={telHref(phone)} className={buttonVariants()}>
              <Phone aria-hidden /> Call {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className={buttonVariants({ variant: "outline" })}>
              <Mail aria-hidden /> Email<span className="sr-only"> about {base.title}</span>
            </a>
          )}
          <SaveButton listingId={base.id} title={base.title} initialSaved={saved.savedIds.includes(base.id)} signedIn={saved.signedIn} nextPath={`/services/${base.slug}`} size="default" />
        </div>
      </header>
      <div className="mb-8">
        <VerificationNotice status={base.verification_status} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <DetailSection id="details" title="Service details">
            <div className="prose-guide">
              {splitParagraphs(base.description).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">Eligibility</dt>
              <dd>{s.eligibility || "Contact the organization"}</dd>
              <dt className="font-semibold">Ages</dt>
              <dd>{ageRange(s.age_min, s.age_max)}</dd>
              <dt className="font-semibold">How it’s offered</dt>
              <dd>{deliveryModes(s)}</dd>
              <dt className="font-semibold">Availability</dt>
              <dd>{label(WAITLIST_LABELS, s.waitlist_status)}</dd>
              <dt className="font-semibold">Referral</dt>
              <dd>{s.referral_required ? "Referral required" : "No referral needed"}</dd>
              <dt className="font-semibold">Areas served</dt>
              <dd>{tax.areas.length ? tax.areas.join(", ") : locations.length ? "At the locations below" : "Contact the organization"}</dd>
              <dt className="font-semibold">Languages</dt>
              <dd>{tax.languages.length ? tax.languages.join(", ") : "Not specified"}</dd>
            </dl>
          </DetailSection>

          <DetailSection id="payment" title="Cost & payment">
            {s.is_free && <p className="mb-3 font-semibold">This service is offered at no cost.</p>}
            {(s.payments ?? []).length > 0 ? <TagList items={s.payments ?? []} label="Payment options" /> : !s.is_free && <p className="text-muted-foreground">Payment options are not listed.</p>}
            {s.insurance_notes && <p className="mt-3 max-w-prose">{s.insurance_notes}</p>}
            {s.payment_notes && <p className="mt-3 max-w-prose">{s.payment_notes}</p>}
            <div className="mt-3">
              <TrustNote />
            </div>
          </DetailSection>

          <DetailSection id="who" title="Who this service is for">
            <TagList items={tax.populations} label="Populations served" />
            {tax.disabilities.length > 0 && (
              <>
                <h3 className="mt-4 mb-2 text-lg font-bold">Disability experience</h3>
                <TagList items={tax.disabilities} label="Disability experience" />
              </>
            )}
            {tax.categories.length > 0 && (
              <>
                <h3 className="mt-4 mb-2 text-lg font-bold">Categories</h3>
                <TagList items={tax.categories.map((c) => c.name)} label="Categories" />
              </>
            )}
          </DetailSection>

          <DetailSection id="locations" title="Where it’s offered">
            {locations.length ? (
              <div className="flex flex-col gap-4">
                {locations.map((l) => (
                  <LocationCard key={l.id} loc={l} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {s.home_based || base.virtual_available ? "This service is provided at home or virtually rather than at an office." : "Contact the organization for location details."}
              </p>
            )}
          </DetailSection>

          <DetailSection id="verification" title="Verification information">
            <VerificationInfo status={base.verification_status} lastVerifiedAt={base.last_verified_at} history={history} listingId={base.id} />
          </DetailSection>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {org && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Building2 className="size-5 text-primary" aria-hidden /> About the provider
              </h2>
              <p className="mt-2 font-semibold">{org.title}</p>
              <div className="mt-1">
                <VerificationBadge status={org.verification_status} />
              </div>
              <p className="mt-2">{org.summary}</p>
              <Link href={`/providers/${org.slug}`} className={`${buttonVariants({ variant: "outline" })} mt-3 w-full`}>
                View provider profile<span className="sr-only"> for {org.title}</span>
              </Link>
            </div>
          )}
          {related.length > 0 && org && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold">Other services from {org.title}</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/services/${r.slug}`} className="inline-flex min-h-10 items-center text-primary underline">
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-xl border bg-sand p-5">
            <h2 className="text-lg font-bold">See something wrong?</h2>
            <p className="mt-1">Help keep this information accurate for families across Michigan.</p>
            <ReportOutdatedLink listingId={base.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
