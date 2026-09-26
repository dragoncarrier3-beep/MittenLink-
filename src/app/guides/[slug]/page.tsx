import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookOpen, Clock, ExternalLink, Info } from "lucide-react";
import { Breadcrumbs } from "@/components/common/page";
import { LastReviewed, StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { SaveButton } from "@/components/listings/save-button";
import { DetailSection, TagList, VerificationInfo, VerificationNotice, splitParagraphs } from "@/components/listings/detail-parts";
import { getGuideDetail } from "@/lib/data/profiles";
import { getSavedState } from "@/lib/data/saved";
import { RESOURCE_TYPE_LABELS, label } from "@/lib/labels";
import { formatDate, hostname } from "@/lib/format";

const load = cache((slug: string) => getGuideDetail(slug));

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await load(slug);
    return d ? { title: d.guide.title, description: d.guide.summary } : { title: "Guide not found" };
  } catch {
    return { title: "Guide" };
  }
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { guide: g, tax, history, related } = d;
  const saved = await getSavedState([g.id]);
  const body = splitParagraphs(g.body || g.description);

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }, { label: g.title }]} />
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article aria-labelledby="guide-title" className="min-w-0">
          <header className="mb-6 flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary uppercase">
              <BookOpen className="size-4" aria-hidden /> {label(RESOURCE_TYPE_LABELS, g.resource_type)}
            </p>
            <h1 id="guide-title" className="text-3xl font-bold tracking-tight md:text-4xl">
              {g.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={g.verification_status} />
              {g.reading_minutes && (
                <StatusPill tone="neutral" icon={<Clock className="size-4" aria-hidden />}>
                  {g.reading_minutes} minute read
                </StatusPill>
              )}
              <LastReviewed date={g.last_verified_at} />
            </div>
            <p className="max-w-3xl text-lg text-muted-foreground">{g.summary}</p>
            <div className="flex flex-wrap gap-2">
              {g.url && (
                <a href={g.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <ExternalLink aria-hidden /> Open the full resource<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <SaveButton listingId={g.id} title={g.title} initialSaved={saved.savedIds.includes(g.id)} signedIn={saved.signedIn} nextPath={`/guides/${g.slug}`} size="default" />
            </div>
          </header>
          <div className="mb-6">
            <VerificationNotice status={g.verification_status} />
          </div>
          <p className="mb-6 flex max-w-prose items-start gap-2 rounded-lg bg-info-soft p-3">
            <Info className="mt-1 size-4 shrink-0 text-info" aria-hidden />
            <span>This is general, plain-language information — not legal, medical, or financial advice. Please confirm details with the official source.</span>
          </p>
          <div className="prose-guide text-lg">
            {body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <DetailSection id="verification" title="Verification information" className="mt-10">
            <VerificationInfo status={g.verification_status} lastVerifiedAt={g.last_verified_at} history={history} listingId={g.id} />
          </DetailSection>
        </article>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-lg font-bold">About this guide</h2>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="font-semibold">Source</dt>
                <dd>
                  {g.source_url ? (
                    <a href={g.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {g.source_name || hostname(g.source_url)}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    g.source_name || (g.org_title ?? "MittenLink")
                  )}
                </dd>
              </div>
              {g.org_slug && g.org_title && (
                <div>
                  <dt className="font-semibold">Published with</dt>
                  <dd>
                    <Link href={`/providers/${g.org_slug}`} className="text-primary underline">
                      {g.org_title}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-semibold">Last verified</dt>
                <dd>{g.last_verified_at ? formatDate(g.last_verified_at) : "Not yet reviewed"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Audience</dt>
                <dd>{tax.populations.length ? tax.populations.join(", ") : "Everyone"}</dd>
              </div>
              {tax.categories.length > 0 && (
                <div>
                  <dt className="mb-1 font-semibold">Topics</dt>
                  <dd>
                    <TagList items={tax.categories.map((c) => c.name)} label="Topics" />
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {related.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-2 text-lg font-bold">Related guides</h2>
              <ul className="flex flex-col gap-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/guides/${r.slug}`} className="font-semibold text-primary underline">
                      {r.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{r.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
