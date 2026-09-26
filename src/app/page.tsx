import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ClipboardCheck, HandCoins, MessageSquarePlus, RefreshCw, SearchCheck, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { VerificationBadge } from "@/components/common/badges";
import { HomeSearchForm } from "@/components/search/home-search-form";
import { ResultCard } from "@/components/listings/result-card";
import { CategoryIcon } from "@/components/listings/category-icon";
import { getCategoryCounts, getRecentlyVerified, getUpcomingEvents, type CategoryCount } from "@/lib/data/listings";
import { getSavedState } from "@/lib/data/saved";
import { searchHref } from "@/lib/search/params";
import { VERIFICATION_DESCRIPTIONS, type VerificationStatus } from "@/lib/labels";
import type { ListingCardData } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const QUICK_CATEGORIES: [string, string][] = [
  ["autism-services", "Autism Services"],
  ["employment", "Employment Support"],
  ["transportation", "Transportation"],
  ["housing", "Housing"],
  ["mental-health", "Mental Health"],
  ["assistive-technology", "Assistive Technology"],
  ["education", "Education"],
  ["recreation", "Recreation"],
  ["independent-living", "Independent Living"],
  ["caregiver-support", "Caregiver Support"],
  ["legal-advocacy", "Legal & Advocacy"],
  ["financial-assistance", "Financial Assistance"],
];

const STATUSES: VerificationStatus[] = ["verified", "pending_review", "needs_update", "unverified", "unable_to_verify"];

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("[home] section failed", err);
    return null;
  }
}

export default async function HomePage() {
  const [categories, recent, events] = [
    await safe(getCategoryCounts),
    await safe(() => getRecentlyVerified(6)),
    await safe(() => getUpcomingEvents(4)),
  ];
  const cards: ListingCardData[] = [...(recent ?? []), ...(events?.cards ?? [])];
  const saved = await getSavedState(cards.map((c) => c.id));
  const countFor = (slug: string) => categories?.find((c) => c.slug === slug)?.count;
  const popular = (categories ?? [])
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="border-b bg-gradient-to-b from-lake-soft to-background">
        <div className="container-page py-10 md:py-16">
          <div className="max-w-3xl">
            <h1 id="hero-heading" className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Find disability resources across Michigan.
            </h1>
            <p className="mt-4 text-xl text-foreground">
              Search providers, programs, services, events, and practical resources for individuals with disabilities, families, caregivers, and
              professionals.
            </p>
          </div>
          <div className="mt-8">
            <HomeSearchForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/search" className={cn(buttonVariants({ size: "lg" }), "bg-pine hover:bg-[#184a3a]")}>
              Find Support in Michigan <ArrowRight aria-hidden />
            </Link>
            <span className="text-muted-foreground">Browse every provider, service, program, and guide.</span>
          </div>
          <nav aria-labelledby="quick-heading" className="mt-8">
            <h2 id="quick-heading" className="mb-3 text-lg font-bold">
              Browse by category
            </h2>
            <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {QUICK_CATEGORIES.map(([slug, name]) => {
                const icon = categories?.find((c) => c.slug === slug)?.icon;
                return (
                  <li key={slug}>
                    <Link
                      href={searchHref({ category: [slug] })}
                      className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-3 py-2 font-semibold text-foreground shadow-sm hover:border-primary hover:bg-secondary"
                    >
                      <CategoryIcon name={icon} className="size-5 shrink-0 text-primary" />
                      <span>{name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </section>

      <div className="container-page flex flex-col gap-16 py-12">
        {/* Popular categories */}
        <section aria-labelledby="popular-heading">
          <SectionHeading id="popular-heading" title="Popular categories" description="Live counts of published listings in each category." />
          {categories === null ? (
            <LoadProblem />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((c) => (
                <PopularCategory key={c.slug} c={c} count={countFor(c.slug) ?? 0} />
              ))}
            </ul>
          )}
        </section>

        {/* Recently verified */}
        <section aria-labelledby="recent-heading">
          <SectionHeading
            id="recent-heading"
            title="Recently verified resources"
            description="Listings MittenLink reviewed most recently."
            action={{ href: searchHref({ verified: true, sort: "recent" }), label: "See all verified resources" }}
          />
          {recent === null ? (
            <LoadProblem />
          ) : recent.length === 0 ? (
            <p className="text-muted-foreground">No recently verified resources to show yet.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recent.map((r) => (
                <li key={r.id} className="flex">
                  <div className="flex w-full">
                    <ResultCard item={r} compact saved={saved.savedIds.includes(r.id)} signedIn={saved.signedIn} nextPath="/" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming events */}
        <section aria-labelledby="events-heading">
          <SectionHeading id="events-heading" title="Upcoming events" description="Workshops, support groups, and community events around Michigan." action={{ href: "/events", label: "See all events" }} />
          {events === null ? (
            <LoadProblem />
          ) : events.cards.length === 0 ? (
            <p className="text-muted-foreground">No upcoming events are listed right now. Check back soon.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {events.cards.map((e) => (
                <li key={e.id} className="flex">
                  <div className="flex w-full">
                    <ResultCard item={e} compact saved={saved.savedIds.includes(e.id)} signedIn={saved.signedIn} nextPath="/" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Verification */}
        <section aria-labelledby="verification-heading" className="rounded-2xl border bg-card p-6 md:p-8">
          <SectionHeading id="verification-heading" title="How MittenLink verification works" />
          <ol className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: SearchCheck, title: "We check the details", text: "Verifiers confirm contact information, hours, services, and eligibility using official websites, government sources, and direct contact." },
              { icon: ClipboardCheck, title: "We record what we checked", text: "Each listing shows its status and when it was last reviewed, with a public summary of how it was verified." },
              { icon: RefreshCw, title: "We review again", text: "Verified listings are re-reviewed on a schedule, and anyone can report outdated information." },
            ].map((s, i) => (
              <li key={s.title} className="rounded-xl bg-secondary p-5">
                <s.icon className="mb-2 size-7 text-primary" aria-hidden />
                <h3 className="text-lg font-bold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-1">{s.text}</p>
              </li>
            ))}
          </ol>
          <h3 className="mb-3 text-xl font-bold">What each status means</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            {STATUSES.map((s) => (
              <div key={s} className="flex flex-col gap-2 rounded-xl border p-4">
                <dt>
                  <VerificationBadge status={s} />
                </dt>
                <dd>{VERIFICATION_DESCRIPTIONS[s]}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <p className="flex items-start gap-2 rounded-lg bg-info-soft p-4">
              <ShieldCheck className="mt-1 size-5 shrink-0 text-info" aria-hidden />
              <span>
                <strong>Verification is not a medical endorsement.</strong> It confirms listing information only — not the quality of care.
              </span>
            </p>
            <p className="flex items-start gap-2 rounded-lg bg-info-soft p-4">
              <HandCoins className="mt-1 size-5 shrink-0 text-info" aria-hidden />
              <span>
                <strong>Payment never affects verification.</strong> Enhanced Listings are never verified faster or ranked higher in search.
              </span>
            </p>
          </div>
          <Link href="/about#verification" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline">
            <BadgeCheck className="size-5" aria-hidden /> Read the full verification policy
          </Link>
        </section>

        {/* CTAs */}
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="provider-cta-heading" className="flex flex-col rounded-2xl bg-pine p-6 text-white md:p-8">
            <Building2 className="mb-3 size-8" aria-hidden />
            <h2 id="provider-cta-heading" className="text-2xl font-bold">
              Do you serve people with disabilities in Michigan?
            </h2>
            <p className="mt-2 text-lg">
              Claim your organization’s free listing to keep your information accurate, or add your organization if it isn’t listed yet.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link href="/claim" className={cn(buttonVariants({ size: "lg" }), "bg-white text-pine hover:bg-sand")}>
                Claim your listing
              </Link>
              <Link href="/list-your-organization" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-white bg-transparent text-white hover:bg-white/10 hover:text-white")}>
                List your organization
              </Link>
            </div>
          </section>
          <section aria-labelledby="gap-cta-heading" className="flex flex-col rounded-2xl border bg-sand p-6 md:p-8">
            <MessageSquarePlus className="mb-3 size-8 text-primary" aria-hidden />
            <h2 id="gap-cta-heading" className="text-2xl font-bold">
              Can’t find what you need? Tell us.
            </h2>
            <p className="mt-2 text-lg">
              Let MittenLink know what you were looking for, or suggest a resource we should add. Your input helps us find gaps in support across Michigan.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link href="/suggest?type=need" className={buttonVariants({ size: "lg" })}>
                Tell us what you need
              </Link>
              <Link href="/suggest?type=resource" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Suggest a resource
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function SectionHeading({ id, title, description, action }: { id: string; title: string; description?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-3xl font-bold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-1 text-lg text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline">
          {action.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function PopularCategory({ c, count }: { c: CategoryCount; count: number }) {
  return (
    <li>
      <Link href={searchHref({ category: [c.slug] })} className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm hover:border-primary">
        <span className="flex items-center justify-between gap-2">
          <CategoryIcon name={c.icon} className="size-8 text-primary" />
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-bold text-secondary-foreground">
            {count} {count === 1 ? "listing" : "listings"}
          </span>
        </span>
        <span className="text-lg font-bold text-primary underline decoration-primary/30 group-hover:decoration-primary">{c.name}</span>
        {c.description && <span className="text-muted-foreground">{c.description}</span>}
      </Link>
    </li>
  );
}

function LoadProblem() {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
      <p className="font-semibold">We’re having trouble loading resources right now. Please try again.</p>
      <a href="/" className={buttonVariants({ variant: "outline" })}>
        <RefreshCw aria-hidden /> Try again
      </a>
    </div>
  );
}

export const dynamic = "force-dynamic";
