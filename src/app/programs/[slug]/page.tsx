import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ClipboardList, ExternalLink, Globe2, Mail, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/common/page";
import { LastReviewed, StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/listings/save-button";
import { DetailSection, TagList, TrustNote, VerificationInfo, VerificationNotice, splitParagraphs } from "@/components/listings/detail-parts";
import { getProgramDetail } from "@/lib/data/profiles";
import { getSavedState } from "@/lib/data/saved";
import { formatDay, telHref } from "@/lib/format";

const load = cache((slug: string) => getProgramDetail(slug));

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await load(slug);
    return d ? { title: d.program.title, description: d.program.summary } : { title: "Program not found" };
  } catch {
    return { title: "Program" };
  }
}

export default async function ProgramPage({ params }: PageProps<"/programs/[slug]">) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { program: p, tax, history } = d;
  const saved = await getSavedState([p.id]);
  const dates = p.start_date ? `${formatDay(p.start_date)}${p.end_date ? ` – ${formatDay(p.end_date)}` : ""}` : "Ongoing";

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Programs", href: "/programs" }, { label: p.title }]} />
      <header className="mt-4 mb-6 flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
          <ClipboardList className="size-4" aria-hidden /> Program
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{p.title}</h1>
        {p.org_slug && p.org_title && (
          <p className="text-lg">
            Offered by{" "}
            <Link href={`/providers/${p.org_slug}`} className="font-semibold text-primary underline">
              {p.org_title}
            </Link>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={p.verification_status} />
          {tax.statewide && <StatusPill tone="neutral" icon={<Globe2 className="size-4" aria-hidden />}>Serves all of Michigan</StatusPill>}
          {p.virtual_available && <StatusPill tone="neutral">Virtual option</StatusPill>}
          <LastReviewed date={p.last_verified_at} />
        </div>
        <p className="max-w-3xl text-lg text-muted-foreground">{p.summary}</p>
        <div className="flex flex-wrap gap-2">
          {p.website && (
            <a href={p.website} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              <ExternalLink aria-hidden /> Program website<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {p.contact_phone && (
            <a href={telHref(p.contact_phone)} className={buttonVariants({ variant: "outline" })}>
              <Phone aria-hidden /> Call {p.contact_phone}
            </a>
          )}
          {p.contact_email && (
            <a href={`mailto:${p.contact_email}`} className={buttonVariants({ variant: "outline" })}>
              <Mail aria-hidden /> Email<span className="sr-only"> about {p.title}</span>
            </a>
          )}
          <SaveButton listingId={p.id} title={p.title} initialSaved={saved.savedIds.includes(p.id)} signedIn={saved.signedIn} nextPath={`/programs/${p.slug}`} size="default" />
        </div>
      </header>
      <div className="mb-8">
        <VerificationNotice status={p.verification_status} />
      </div>
      <div className="flex max-w-4xl flex-col gap-10">
        <DetailSection id="about" title="About this program">
          <div className="prose-guide">
            {splitParagraphs(p.description).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            <dt className="font-semibold">Eligibility</dt>
            <dd>{p.eligibility || "Contact the program"}</dd>
            <dt className="font-semibold">Cost</dt>
            <dd>{p.cost_text || (p.is_free ? "Free" : "Contact the program")}</dd>
            <dt className="font-semibold">Dates</dt>
            <dd>{dates}</dd>
            <dt className="font-semibold">Areas served</dt>
            <dd>{tax.areas.length ? tax.areas.join(", ") : "Contact the program"}</dd>
            <dt className="font-semibold">Who it serves</dt>
            <dd>{tax.populations.length ? tax.populations.join(", ") : "Not specified"}</dd>
          </dl>
          {tax.categories.length > 0 && (
            <div className="mt-4">
              <TagList items={tax.categories.map((c) => c.name)} label="Categories" />
            </div>
          )}
        </DetailSection>
        <DetailSection id="apply" title="How to apply">
          <p className="max-w-prose">{p.application_instructions || "Contact the program for application details."}</p>
          <div className="mt-3">
            <TrustNote />
          </div>
        </DetailSection>
        <DetailSection id="verification" title="Verification information">
          <VerificationInfo status={p.verification_status} lastVerifiedAt={p.last_verified_at} history={history} listingId={p.id} />
        </DetailSection>
      </div>
    </div>
  );
}
