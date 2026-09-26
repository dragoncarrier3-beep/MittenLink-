import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Building2, CalendarDays, ExternalLink, Globe, Mail, MapPinned, MessageSquareHeart, Phone, Sparkles, Star } from "lucide-react";
import { Breadcrumbs } from "@/components/common/page";
import { LastReviewed, ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/listings/save-button";
import { formatEventWhen } from "@/components/listings/result-card";
import {
  LocationCard,
  ReportOutdatedLink,
  TagList,
  TrustNote,
  VerificationInfo,
  VerificationNotice,
  ageRange,
  deliveryModes,
} from "@/components/listings/detail-parts";
import { getProviderProfile, type ProviderProfile } from "@/lib/data/profiles";
import { getSavedState } from "@/lib/data/saved";
import { track } from "@/lib/server/analytics";
import { EXPERIENCE_LABELS, ORG_TYPE_LABELS, RATING_LABELS, WAITLIST_LABELS, label } from "@/lib/labels";
import { directionsHref, formatDay, formatMonthYear, hostname, telHref } from "@/lib/format";
import { cn } from "@/lib/utils";

const load = cache((slug: string) => getProviderProfile(slug));

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await load(slug);
    if (!data) return { title: "Provider not found" };
    return { title: data.org.title, description: data.org.summary };
  } catch {
    return { title: "Provider" };
  }
}

const paragraphs = (text: string | null | undefined) =>
  (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export default async function ProviderPage({ params }: PageProps<"/providers/[slug]">) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { org, tax, locations, services, programs, events, guides, experiences, history } = data;
  const enhanced = org.listing_tier === "enhanced";
  const primary = locations.find((l) => l.is_primary) ?? locations[0] ?? null;
  const saved = await getSavedState([org.id]);
  await track("provider_viewed", { listingId: org.id, properties: { tier: org.listing_tier } });

  const payments = [...new Set(services.flatMap((s) => s.payments ?? []))];
  const insuranceNotes = [...new Set(services.map((s) => s.insurance_notes).filter(Boolean) as string[])];
  const paymentNotes = [...new Set(services.map((s) => s.payment_notes).filter(Boolean) as string[])];
  const anyFree = services.some((s) => s.is_free);

  const toc = [
    { id: "overview", label: "Overview" },
    { id: "services", label: `Services (${services.length})` },
    { id: "locations", label: `Locations (${locations.length})` },
    ...(programs.length || events.length || guides.length ? [{ id: "programs", label: "Programs & events" }] : []),
    { id: "populations", label: "Populations served" },
    { id: "accessibility", label: "Accessibility" },
    { id: "payment", label: "Insurance & payment" },
    { id: "contact", label: "Contact" },
    { id: "experiences", label: "Family experiences" },
    { id: "verification", label: "Verification information" },
  ];

  const logoOk = !!org.logo_path && /^(https?:\/\/|\/)/.test(org.logo_path);

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Providers", href: "/providers" }, { label: org.title }]} />

      <header className="mt-4 mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {enhanced &&
            (logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_path!} alt={org.logo_alt || `${org.title} logo`} className="size-20 shrink-0 rounded-xl border bg-card object-contain p-2" />
            ) : (
              <div aria-hidden className="grid size-20 shrink-0 place-items-center rounded-xl border bg-lake-soft text-2xl font-bold text-secondary-foreground">
                {org.title
                  .split(/\s+/)
                  .filter((w) => /^[A-Z]/.test(w))
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>
            ))}
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
              <Building2 className="size-4" aria-hidden /> {label(ORG_TYPE_LABELS, org.org_type)}
            </p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{org.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VerificationBadge status={org.verification_status} />
              <ListingTierBadge tier={org.listing_tier} />
              {tax.statewide && <StatusPill tone="neutral">Serves all of Michigan</StatusPill>}
              <LastReviewed date={org.last_verified_at} />
            </div>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{org.summary}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {org.website && (
            <a href={org.website} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              <Globe aria-hidden /> Website<span className="sr-only"> for {org.title} (opens in a new tab)</span>
            </a>
          )}
          {org.public_phone && (
            <a href={telHref(org.public_phone)} className={buttonVariants({ variant: "outline" })}>
              <Phone aria-hidden /> Call {org.public_phone}
            </a>
          )}
          {org.public_email && (
            <a href={`mailto:${org.public_email}`} className={buttonVariants({ variant: "outline" })}>
              <Mail aria-hidden /> Email<span className="sr-only"> {org.title}</span>
            </a>
          )}
          {primary && (
            <a
              href={directionsHref([primary.street, primary.city, primary.state, primary.zip])}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <MapPinned aria-hidden /> Directions<span className="sr-only"> to {primary.name} (opens OpenStreetMap in a new tab)</span>
            </a>
          )}
          <SaveButton listingId={org.id} title={org.title} initialSaved={saved.savedIds.includes(org.id)} signedIn={saved.signedIn} nextPath={`/providers/${org.slug}`} size="default" />
        </div>
      </header>

      <div className="mb-6">
        <VerificationNotice status={org.verification_status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="On this page" className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 text-lg font-bold">On this page</h2>
            <ul className="flex flex-col">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="flex min-h-10 items-center rounded-md px-2 text-primary underline-offset-4 hover:bg-muted hover:underline">
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden lg:block">
            <ClaimBox org={org} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-12">
          <DetailSection id="overview" title="Overview">
            <div className="prose-guide">
              {paragraphs(org.description).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {enhanced && org.expanded_description && (
              <div className="mt-4 rounded-xl border border-enhanced/30 bg-enhanced-soft/50 p-5">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                  <Sparkles className="size-5 text-enhanced" aria-hidden /> More about {org.title}
                </h3>
                <div className="prose-guide">
                  {paragraphs(org.expanded_description).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Provided by the organization as part of its Enhanced Listing and reviewed by MittenLink before publishing.</p>
              </div>
            )}
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">Provider type</dt>
              <dd>{label(ORG_TYPE_LABELS, org.org_type)}</dd>
              {org.founded_year && (
                <>
                  <dt className="font-semibold">Founded</dt>
                  <dd>{org.founded_year}</dd>
                </>
              )}
              <dt className="font-semibold">Areas served</dt>
              <dd>{tax.areas.length ? tax.areas.join(", ") : "See locations below"}</dd>
              <dt className="font-semibold">Languages</dt>
              <dd>{tax.languages.length ? tax.languages.join(", ") : "Not specified"}</dd>
              <dt className="font-semibold">Categories</dt>
              <dd>
                <TagList items={tax.categories.map((c) => c.name)} label="Categories" />
              </dd>
            </dl>
          </DetailSection>

          <DetailSection id="services" title="Services">
            {services.length === 0 ? (
              <p className="text-muted-foreground">No individual services are listed yet. Contact the organization for details.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {services.map((s) => (
                  <ServiceItem key={s.id} s={s} enhanced={enhanced} />
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection id="locations" title="Locations">
            {locations.length === 0 ? (
              <p className="text-muted-foreground">This organization does not list a public office location. Services may be offered virtually or in your community.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {locations.map((l) => (
                  <LocationCard key={l.id} loc={l} />
                ))}
              </div>
            )}
          </DetailSection>

          {(programs.length > 0 || events.length > 0 || guides.length > 0) && (
            <DetailSection id="programs" title="Programs & events">
              {programs.length > 0 && (
                <>
                  <h3 className="mb-2 text-xl font-bold">Programs</h3>
                  <ul className="mb-6 flex flex-col gap-3">
                    {programs.map((p) => (
                      <li key={p.id} className="rounded-xl border bg-card p-4">
                        <Link href={`/programs/${p.slug}`} className="text-lg font-bold text-primary underline">
                          {p.title}
                        </Link>
                        <p className="mt-1">{p.summary}</p>
                        <p className="mt-1 text-muted-foreground">
                          {[p.cost_text, p.start_date ? `Starts ${formatDay(p.start_date)}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {events.length > 0 && (
                <>
                  <h3 className="mb-2 text-xl font-bold">Upcoming events</h3>
                  <ul className="mb-6 flex flex-col gap-3">
                    {events.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                        <CalendarDays className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                        <div>
                          <Link href={`/events/${e.slug}`} className="text-lg font-bold text-primary underline">
                            {e.title}
                          </Link>
                          <p className="text-muted-foreground">
                            {formatEventWhen(new Date(e.starts_at).toISOString(), new Date(e.ends_at).toISOString())} · {e.is_in_person ? e.city ?? "In person" : "Online"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {guides.length > 0 && (
                <>
                  <h3 className="mb-2 text-xl font-bold">Guides from this organization</h3>
                  <ul className="flex flex-col gap-2">
                    {guides.map((g) => (
                      <li key={g.id}>
                        <Link href={`/guides/${g.slug}`} className="font-semibold text-primary underline">
                          {g.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </DetailSection>
          )}

          <DetailSection id="populations" title="Populations served">
            <h3 className="mb-2 text-lg font-bold">Who this organization serves</h3>
            <TagList items={tax.populations} label="Populations served" />
            <h3 className="mt-5 mb-2 text-lg font-bold">Disability experience</h3>
            <TagList items={tax.disabilities} label="Disability experience" />
          </DetailSection>

          <DetailSection id="accessibility" title="Accessibility">
            {org.accessibility_info ? <p className="max-w-prose">{org.accessibility_info}</p> : <p className="text-muted-foreground">The organization has not shared accessibility details yet. Please ask about your access needs when you contact them.</p>}
            {locations.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {locations.map((l) => (
                  <li key={l.id}>
                    <span className="font-semibold">{l.name}:</span>{" "}
                    {[
                      l.wheelchair_accessible === true ? "wheelchair accessible" : l.wheelchair_accessible === false ? "not wheelchair accessible" : "wheelchair access not confirmed",
                      l.accessible_parking ? "accessible parking" : null,
                      l.appointment_required ? "appointment required" : null,
                      l.virtual_services ? "virtual services available" : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection id="payment" title="Insurance & payment">
            {payments.length > 0 ? <TagList items={payments} label="Payment options accepted" /> : <p className="text-muted-foreground">Payment options are not listed. Contact the organization to ask about cost.</p>}
            {anyFree && <p className="mt-3">Some services are offered at no cost.</p>}
            {[...insuranceNotes, ...paymentNotes].map((n) => (
              <p key={n} className="mt-3 max-w-prose">
                {n}
              </p>
            ))}
            <div className="mt-3">
              <TrustNote />
            </div>
          </DetailSection>

          <DetailSection id="contact" title="Contact">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
              <dt className="font-semibold">Phone</dt>
              <dd>{org.public_phone ? <a className="underline" href={telHref(org.public_phone)}>{org.public_phone}</a> : "Not listed"}</dd>
              <dt className="font-semibold">Email</dt>
              <dd className="break-all">{org.public_email ? <a className="underline" href={`mailto:${org.public_email}`}>{org.public_email}</a> : "Not listed"}</dd>
              <dt className="font-semibold">Website</dt>
              <dd>
                {org.website ? (
                  <a className="inline-flex items-center gap-1 underline" href={org.website} target="_blank" rel="noopener noreferrer">
                    {hostname(org.website)} <ExternalLink className="size-4" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  "Not listed"
                )}
              </dd>
              {primary && (
                <>
                  <dt className="font-semibold">Main address</dt>
                  <dd>
                    {primary.street}
                    {primary.street2 ? `, ${primary.street2}` : ""}, {primary.city}, {primary.state} {primary.zip}
                  </dd>
                </>
              )}
            </dl>
          </DetailSection>

          <DetailSection id="experiences" title="Family experiences">
            <p className="mb-4 max-w-prose text-muted-foreground">
              These reports are shared by families and individuals, reviewed by MittenLink moderators before publishing, and always anonymous. They
              reflect individual experiences — not ratings or endorsements by MittenLink.
            </p>
            {experiences.length === 0 ? (
              <p className="mb-4">No family experiences have been published for this provider yet.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-4">
                {experiences.map((x) => (
                  <li key={x.id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={x.experience_category === "negative" ? "warning" : x.experience_category === "mixed" ? "neutral" : "success"} icon={<MessageSquareHeart className="size-4" aria-hidden />}>
                        {label(EXPERIENCE_LABELS, x.experience_category)} experience
                      </StatusPill>
                      <span className="text-muted-foreground">
                        {x.service_type}
                        {x.approx_service_month ? ` · around ${formatDay(x.approx_service_month, { month: "long", year: "numeric" })}` : ""}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr]">
                      <dt className="font-semibold">Accessibility</dt>
                      <dd>{label(RATING_LABELS, x.accessibility_rating)}</dd>
                      <dt className="font-semibold">Communication</dt>
                      <dd>{label(RATING_LABELS, x.communication_rating)}</dd>
                    </dl>
                    {x.accessibility_notes && <p className="mt-2">{x.accessibility_notes}</p>}
                    {x.comments && <blockquote className="mt-2 border-l-4 border-primary/40 pl-3">{x.comments}</blockquote>}
                    <p className="mt-2 text-sm text-muted-foreground">Published {formatMonthYear(x.published_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/providers/${org.slug}/experience`} className={buttonVariants({ variant: "outline" })}>
              <Star aria-hidden /> Share your experience<span className="sr-only"> with {org.title}</span>
            </Link>
          </DetailSection>

          <DetailSection id="verification" title="Verification information">
            <VerificationInfo status={org.verification_status} lastVerifiedAt={org.last_verified_at} history={history} listingId={org.id} />
          </DetailSection>

          <div className="lg:hidden">
            <ClaimBox org={org} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="mb-4 border-b pb-2 text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ServiceItem({ s, enhanced }: { s: ProviderProfile["services"][number]; enhanced: boolean }) {
  const featured = enhanced && s.is_featured;
  return (
    <li className={cn("rounded-xl border bg-card p-5", featured && "border-enhanced/40")}>
      <div className="flex flex-wrap items-center gap-2">
        {featured && <StatusPill tone="enhanced" icon={<Sparkles className="size-4" aria-hidden />}>Featured service</StatusPill>}
        <VerificationBadge status={s.verification_status} />
        <StatusPill tone={s.waitlist_status === "accepting" || s.waitlist_status === "short_wait" ? "success" : s.waitlist_status === "waitlist" ? "warning" : "danger"}>
          {label(WAITLIST_LABELS, s.waitlist_status)}
        </StatusPill>
      </div>
      <h3 className="mt-2 text-xl font-bold">
        <Link href={`/services/${s.slug}`} className="text-primary underline">
          {s.title}
        </Link>
      </h3>
      <p className="mt-1">{s.summary}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
        <dt className="font-semibold">Eligibility</dt>
        <dd>{s.eligibility || "Contact the organization"}</dd>
        <dt className="font-semibold">Ages</dt>
        <dd>{ageRange(s.age_min, s.age_max)}</dd>
        <dt className="font-semibold">How it’s offered</dt>
        <dd>{deliveryModes(s)}</dd>
        <dt className="font-semibold">Payment</dt>
        <dd>{[s.is_free ? "Free" : null, ...(s.payments ?? []).filter((p) => p !== "Free")].filter(Boolean).join(", ") || "Contact the organization"}</dd>
        <dt className="font-semibold">Locations served</dt>
        <dd>{[...(s.location_names ?? []), ...(s.areas ?? [])].join(", ") || "Contact the organization"}</dd>
        {s.referral_required && (
          <>
            <dt className="font-semibold">Referral</dt>
            <dd>Referral required</dd>
          </>
        )}
      </dl>
      <Link href={`/services/${s.slug}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline">
        View service details<span className="sr-only"> for {s.title}</span>
      </Link>
    </li>
  );
}

function ClaimBox({ org }: { org: ProviderProfile["org"] }) {
  return (
    <div className="rounded-xl border bg-sand p-4">
      {org.claimed_at ? (
        <>
          <h2 className="text-lg font-bold">This listing is managed by the organization</h2>
          <p className="mt-1">Updates from the organization are reviewed by MittenLink before they appear.</p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">Is this your organization?</h2>
          <p className="mt-1">Claim this free listing to keep your information accurate. Claims are reviewed by MittenLink.</p>
          <Link href={`/providers/${org.slug}/claim`} className={cn(buttonVariants(), "mt-3 w-full")}>
            Claim This Provider
          </Link>
        </>
      )}
      <ReportOutdatedLink listingId={org.id} className="mt-2" />
    </div>
  );
}
