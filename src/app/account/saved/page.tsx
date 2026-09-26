import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { KIND_LABELS } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge, LastReviewed } from "@/components/common/badges";
import { SubmitButton } from "@/components/forms/fields";
import { firstParam, type SearchParams } from "@/components/community/server";
import { removeSavedResourceAction } from "../actions";

export const metadata: Metadata = { title: "Saved Resources" };

interface SavedRow {
  listing_id: string;
  saved_at: Date;
  kind: string | null;
  slug: string | null;
  title: string | null;
  summary: string | null;
  primary_city: string | null;
  verification_status: string | null;
  last_verified_at: Date | null;
}

export default async function SavedResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/account/saved");
  const params = await searchParams;
  const rows = await asCurrentUser((sql) =>
    sql.query<SavedRow>(
      `select s.listing_id, s.created_at as saved_at, l.kind, l.slug, l.title, l.summary, l.primary_city, l.verification_status, l.last_verified_at
       from public.saved_resources s left join public.listings l on l.id = s.listing_id
       where s.user_id = auth.uid() order by s.created_at desc`,
    ),
  );

  return (
    <>
      <PageHeader title="Saved resources" description="Providers, services, programs, events, and guides you've saved for later." />
      {firstParam(params.removed) === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-success/40 bg-success-soft p-3 font-semibold text-success">
          The resource was removed from your saved list.
        </p>
      )}
      {firstParam(params.error) === "1" && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft p-3 font-semibold text-danger">
          We couldn&apos;t remove that resource. Please try again.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Bookmark} title="NO SAVED RESOURCES" description="Resources you save will appear here." action={{ label: "FIND RESOURCES", href: "/search" }} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const available = r.title && r.kind && r.slug;
            return (
              <li key={r.listing_id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {available ? (
                    <>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {KIND_LABELS[r.kind!] ?? "Listing"}
                        {r.primary_city ? ` · ${r.primary_city}` : ""}
                      </p>
                      <h2 className="text-lg font-bold">
                        <Link href={listingHref(r.kind!, r.slug!)} className="underline-offset-4 hover:underline">
                          {r.title}
                        </Link>
                      </h2>
                      {r.summary && <p className="mt-1 line-clamp-2 text-muted-foreground">{r.summary}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <VerificationBadge status={r.verification_status ?? "unverified"} />
                        <LastReviewed date={r.last_verified_at} />
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold">This resource is no longer available</h2>
                      <StatusPill tone="neutral" className="mt-2">
                        Unavailable
                      </StatusPill>
                    </>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">Saved {formatDate(r.saved_at)}</p>
                </div>
                <form action={removeSavedResourceAction} className="shrink-0">
                  <input type="hidden" name="listingId" value={r.listing_id} />
                  <SubmitButton variant="outline" pendingLabel="Removing…">
                    <Trash2 aria-hidden /> Remove<span className="sr-only"> {r.title ?? "this resource"} from saved resources</span>
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
