import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Accessibility, CalendarDays, CalendarPlus, Clock, ExternalLink, Mail, MapPin, Monitor, Phone, Ticket, UserRound } from "lucide-react";
import { Breadcrumbs } from "@/components/common/page";
import { LastReviewed, StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/listings/save-button";
import { DetailSection, TagList, VerificationInfo, VerificationNotice, splitParagraphs } from "@/components/listings/detail-parts";
import { getEventDetail } from "@/lib/data/profiles";
import { getSavedState } from "@/lib/data/saved";
import { EVENT_TYPE_LABELS, label } from "@/lib/labels";
import { directionsHref, formatDate, formatTime, telHref } from "@/lib/format";

const load = cache((slug: string) => getEventDetail(slug));

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await load(slug);
    return d ? { title: d.event.title, description: d.event.summary } : { title: "Event not found" };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { event: e, tax, history } = d;
  const saved = await getSavedState([e.id]);
  const past = new Date(e.ends_at).getTime() < Date.now();
  const address = [e.street, e.city ? `${e.city}, MI${e.zip ? ` ${e.zip}` : ""}` : null].filter(Boolean) as string[];

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: e.title }]} />
      <header className="mt-4 mb-6 flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
          <CalendarDays className="size-4" aria-hidden /> {label(EVENT_TYPE_LABELS, e.event_type)}
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{e.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={e.verification_status} />
          <StatusPill tone="neutral" icon={e.is_in_person ? <MapPin className="size-4" aria-hidden /> : <Monitor className="size-4" aria-hidden />}>
            {e.is_in_person ? "In person" : "Virtual"}
          </StatusPill>
          {e.is_free && <StatusPill tone="success">Free</StatusPill>}
          <LastReviewed date={e.last_verified_at} />
        </div>
        <p className="max-w-3xl text-lg text-muted-foreground">{e.summary}</p>
        {past && (
          <p role="note" className="rounded-lg border border-warning/30 bg-warning-soft p-3 font-semibold">
            This event has already taken place.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {e.registration_url && !past && (
            <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              <Ticket aria-hidden /> Register<span className="sr-only"> for {e.title} (opens in a new tab)</span>
            </a>
          )}
          {!past && (
            <a href={`/events/${e.slug}/ics`} download className={buttonVariants({ variant: "outline" })}>
              <CalendarPlus aria-hidden /> Add to calendar<span className="sr-only"> (downloads a calendar file)</span>
            </a>
          )}
          <SaveButton listingId={e.id} title={e.title} initialSaved={saved.savedIds.includes(e.id)} signedIn={saved.signedIn} nextPath={`/events/${e.slug}`} size="default" />
        </div>
      </header>
      <div className="mb-8">
        <VerificationNotice status={e.verification_status} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <DetailSection id="about" title="About this event">
            <div className="prose-guide">
              {splitParagraphs(e.description).map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
            {tax.populations.length > 0 && (
              <>
                <h3 className="mt-2 mb-2 text-lg font-bold">Who it’s for</h3>
                <TagList items={tax.populations} label="Who it's for" />
              </>
            )}
            {tax.categories.length > 0 && (
              <>
                <h3 className="mt-4 mb-2 text-lg font-bold">Topics</h3>
                <TagList items={tax.categories.map((c) => c.name)} label="Topics" />
              </>
            )}
          </DetailSection>
          <DetailSection id="accessibility" title="Accessibility & accommodations">
            <p className="flex max-w-prose items-start gap-2">
              <Accessibility className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>{e.accommodations || "Accommodation details are not listed. Contact the organizer to request what you need."}</span>
            </p>
          </DetailSection>
          <DetailSection id="verification" title="Verification information">
            <VerificationInfo status={e.verification_status} lastVerifiedAt={e.last_verified_at} history={history} listingId={e.id} />
          </DetailSection>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-bold">Event details</h2>
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold">{formatDate(e.starts_at, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-4" aria-hidden /> {formatTime(e.starts_at)} – {formatTime(e.ends_at)} (Eastern Time)
                </span>
              </span>
            </p>
            <div className="flex items-start gap-2">
              {e.is_in_person ? <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden /> : <Monitor className="mt-1 size-5 shrink-0 text-primary" aria-hidden />}
              {e.is_in_person ? (
                <address className="not-italic">
                  {e.venue_name && <span className="block font-semibold">{e.venue_name}</span>}
                  {address.map((a) => (
                    <span key={a} className="block">
                      {a}
                    </span>
                  ))}
                  {e.county && <span className="block text-muted-foreground">{e.county} County</span>}
                  {address.length > 0 && (
                    <a href={directionsHref([e.venue_name, ...address])} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                      Get directions<span className="sr-only"> (opens OpenStreetMap in a new tab)</span>
                    </a>
                  )}
                </address>
              ) : (
                <span>Online event. The link is shared after registration.</span>
              )}
            </div>
            <p className="flex items-start gap-2">
              <Ticket className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold">Cost: </span>
                {e.cost_text || (e.is_free ? "Free" : "Contact the organizer")}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <UserRound className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold">Organizer: </span>
                {e.org_slug && e.org_title ? (
                  <Link href={`/providers/${e.org_slug}`} className="text-primary underline">
                    {e.organizer_name}
                  </Link>
                ) : (
                  e.organizer_name
                )}
              </span>
            </p>
            {e.contact_phone && (
              <p className="flex items-center gap-2">
                <Phone className="size-5 shrink-0 text-primary" aria-hidden />
                <a href={telHref(e.contact_phone)} className="underline">
                  {e.contact_phone}
                </a>
              </p>
            )}
            {e.contact_email && (
              <p className="flex items-center gap-2 break-all">
                <Mail className="size-5 shrink-0 text-primary" aria-hidden />
                <a href={`mailto:${e.contact_email}`} className="underline">
                  {e.contact_email}
                </a>
              </p>
            )}
            {e.registration_url && !past && (
              <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline">
                Registration page <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
