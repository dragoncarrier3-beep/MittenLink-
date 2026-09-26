import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { KIND_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { VerificationBadge } from "@/components/common/badges";
import { firstParam, UUID_RE, type SearchParams } from "@/components/community/server";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Report Outdated Information",
  description: "Let MittenLink know when a listing has incorrect or outdated information.",
};

export default async function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const listingId = firstParam(params.listing);
  const listing = UUID_RE.test(listingId)
    ? (
        await asPublic((sql) =>
          sql.query<{ id: string; kind: string; slug: string; title: string; verification_status: string; primary_city: string | null }>(
            `select id, kind, slug, title, verification_status, primary_city from public.listings
             where id = $1 and publication_status = 'published'`,
            [listingId],
          ),
        )
      )[0]
    : undefined;

  if (!listing) {
    return (
      <div className="container-page py-8">
        <PageHeader title="Report outdated information" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Report outdated information" }]} />
        <EmptyState
          icon={SearchX}
          title="We couldn't tell which listing you want to report"
          description={
            <>
              To report outdated information, open the listing on MittenLink and choose <strong>Report outdated information</strong>. You
              can find it on every provider, service, program, and event page.
            </>
          }
          action={{ label: "Search MittenLink", href: "/search" }}
        >
          <Link href="/suggest?type=resource" className="font-semibold text-primary underline">
            Suggest a resource we&apos;re missing instead
          </Link>
        </EmptyState>
      </div>
    );
  }

  const user = await getCurrentUser();
  const href = listingHref(listing.kind, listing.slug);
  return (
    <div className="container-page py-8">
      <PageHeader
        title="Report outdated information"
        description="Spotted a wrong phone number, changed hours, or a closed location? Tell us and a MittenLink verifier will check it. No account needed."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: listing.title, href }, { label: "Report outdated information" }]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-2xl">
          <ReportForm listingId={listing.id} listingTitle={listing.title} listingHref={href} signedIn={!!user} defaultEmail={user?.email} />
        </div>
        <aside aria-labelledby="report-record-heading" className="order-first lg:order-none">
          <Panel>
            <h2 id="report-record-heading" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              You are reporting
            </h2>
            <p className="mt-2 text-xl font-bold">{listing.title}</p>
            <p className="mt-1 text-muted-foreground">
              {KIND_LABELS[listing.kind] ?? "Listing"}
              {listing.primary_city ? ` · ${listing.primary_city}` : ""}
            </p>
            <VerificationBadge status={listing.verification_status} className="mt-3" />
            <p className="mt-4">
              <Link href={href} className="font-semibold text-primary underline">
                View the listing<span className="sr-only">: {listing.title}</span>
              </Link>
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
