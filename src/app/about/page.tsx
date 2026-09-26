import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, BadgeCheck, Database, FlaskConical, HandHeart, Lock, Scale, Sparkles, Tag } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { VERIFICATION_DESCRIPTIONS, type VerificationStatus } from "@/lib/labels";

export const metadata: Metadata = {
  title: "About MittenLink",
  description: "MittenLink's mission, how resource verification works, Free and Enhanced listings, accessibility, privacy, and data ownership.",
};

const STATUSES: VerificationStatus[] = ["verified", "pending_review", "needs_update", "unverified", "unable_to_verify", "archived"];

const TOC = [
  { id: "mission", label: "Our mission" },
  { id: "verification", label: "How verification works" },
  { id: "listings", label: "Free and Enhanced listings" },
  { id: "demo", label: "About the demonstration data" },
  { id: "accessibility", label: "Accessibility statement" },
  { id: "privacy", label: "Privacy" },
  { id: "ownership", label: "Ownership" },
];

export default function AboutPage() {
  return (
    <div className="container-page py-8">
      <PageHeader
        title="About MittenLink"
        description="MittenLink — the Michigan Disability Resource Network — helps people with disabilities, families, caregivers, and professionals find trustworthy local and statewide resources."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
      />
      <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="rounded-xl border bg-card p-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 text-lg font-bold">On this page</h2>
          <ul>
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="flex min-h-10 items-center rounded-md px-2 text-primary hover:bg-muted hover:underline">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex max-w-3xl min-w-0 flex-col gap-12 text-lg">
          <AboutSection id="mission" title="Our mission" icon={HandHeart}>
            <p>
              Finding disability services in Michigan too often means calling outdated phone numbers, searching dozens of websites, and starting over in
              every county. MittenLink brings providers, services, programs, events, and plain-language guides together in one accessible place — and
              keeps that information current through human review.
            </p>
            <p>
              We are built for people with disabilities, families, caregivers, and the professionals who support them. Statewide and virtual resources are
              always included, so people in rural areas are never left with an empty result.
            </p>
          </AboutSection>

          <AboutSection id="verification" title="How verification works" icon={BadgeCheck}>
            <p>
              MittenLink verifiers confirm listing details — contact information, hours, locations, services, eligibility, and cost — using official
              websites, government sources, and direct confirmation by phone or email with the organization. Each check is recorded with the method used and
              a public summary, and verified listings are reviewed again on a regular schedule.
            </p>
            <h3 className="text-xl font-bold">What each status means</h3>
            <dl className="flex flex-col gap-3">
              {STATUSES.map((s) => (
                <div key={s} className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:gap-4">
                  <dt className="shrink-0 sm:w-44">
                    <VerificationBadge status={s} />
                  </dt>
                  <dd className="text-base">{VERIFICATION_DESCRIPTIONS[s]}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-xl border border-info/30 bg-info-soft p-4">
              <p className="font-bold">Verification is not an endorsement.</p>
              <p className="text-base">
                A Verified badge means MittenLink confirmed the listing information. It is not a medical, clinical, or professional endorsement, and it does
                not rate the quality of care. Please contact providers directly to decide what is right for you.
              </p>
            </div>
            <div className="rounded-xl border border-info/30 bg-info-soft p-4">
              <p className="font-bold">Payment never affects verification.</p>
              <p className="text-base">
                Verification status is decided only by our review process. Organizations cannot pay to be verified, to be verified faster, or to change a
                status.
              </p>
            </div>
            <p>
              See something out of date? Every listing has a <strong>Report outdated information</strong> link, and reports go straight to our verification
              queue.
            </p>
          </AboutSection>

          <AboutSection id="listings" title="Free and Enhanced listings" icon={Tag}>
            <p>Every organization can be listed on MittenLink for free, and every listing is reviewed the same way.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <StatusPill tone="neutral" icon={<Tag className="size-4" aria-hidden />}>
                  Free Listing
                </StatusPill>
                <p className="mt-2 text-base">Name, description, services, locations, hours, contact details, accessibility information, and verification history.</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <StatusPill tone="enhanced" icon={<Sparkles className="size-4" aria-hidden />}>
                  Enhanced Listing
                </StatusPill>
                <p className="mt-2 text-base">
                  Adds an expanded description, logo, and featured services on the organization’s profile. Enhanced content is reviewed before it is
                  published.
                </p>
              </div>
            </div>
            <p>
              <strong>Enhanced Listings are never ranked higher in search results</strong> and never receive a different verification status. Search order
              is based only on how well a listing matches what you searched for and where you are.
            </p>
          </AboutSection>

          <AboutSection id="demo" title="About the demonstration data" icon={FlaskConical}>
            <p>
              This site is a Phase I demonstration. <strong>All organizations, services, programs, events, and people shown are fictional samples</strong>{" "}
              placed in real Michigan cities and counties so the search can be tested realistically.
            </p>
            <p>
              Contact details are intentionally unusable: websites and emails use reserved example domains (such as <code>.example</code>), and phone numbers
              use the 555-01xx range set aside for fiction. Please do not contact them, and do not rely on this demo for real services.
            </p>
          </AboutSection>

          <AboutSection id="accessibility" title="Accessibility statement" icon={Accessibility}>
            <p>
              MittenLink is designed to meet the <strong>Web Content Accessibility Guidelines (WCAG) 2.2 at level AA</strong>. We use a highly legible
              typeface, strong color contrast, visible keyboard focus, screen reader labels, and layouts that work at 320 pixels wide and when zoomed to
              400%. Status is never shown by color alone, and the map is optional — every result is always available in the list.
            </p>
            <p>
              If something on MittenLink is hard to use with your device, assistive technology, or way of browsing, please tell us. Describe the page and
              what happened using our{" "}
              <Link href="/suggest?type=need&q=Accessibility%20barrier" className="font-semibold text-primary underline">
                feedback form
              </Link>
              . We treat accessibility barriers as high-priority bugs and will follow up if you share a way to reach you.
            </p>
          </AboutSection>

          <AboutSection id="privacy" title="Privacy" icon={Lock}>
            <ul className="flex list-disc flex-col gap-2 pl-6">
              <li>
                <strong>Search analytics are anonymous.</strong> To find gaps in services, we record the words searched, the general location (city or
                county), filters used, and how many results were found. We do not store names, account IDs, or IP addresses with searches.
              </li>
              <li>
                <strong>Family experience reports are moderated.</strong> Reports are reviewed before publishing and always appear anonymously. An optional
                contact email is used only if a moderator needs clarification and is never shown publicly.
              </li>
              <li>
                <strong>Please don’t share medical information.</strong> Forms on MittenLink are not a place for diagnoses, health records, or other private
                medical details.
              </li>
              <li>
                <strong>Saved resources and searches</strong> are visible only to you when you are signed in.
              </li>
            </ul>
          </AboutSection>

          <AboutSection id="ownership" title="Ownership" icon={Scale}>
            <p className="flex items-start gap-2">
              <Database className="mt-1.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                The nonprofit that operates MittenLink owns the platform’s source code, directory data, and every service account (hosting, database, email,
                maps, and payments). No vendor holds the data or the accounts, so the nonprofit can change partners at any time without losing its work.
              </span>
            </p>
          </AboutSection>
        </div>
      </div>
    </div>
  );
}

function AboutSection({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-24 flex-col gap-4">
      <h2 id={`${id}-heading`} className="flex items-center gap-2 border-b pb-2 text-2xl font-bold">
        <Icon className="size-6 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
