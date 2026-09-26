import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ResultCard } from "@/components/listings/result-card";
import { getUpcomingEvents } from "@/lib/data/listings";
import { getSavedState } from "@/lib/data/saved";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming disability workshops, support groups, webinars, recreation, and resource fairs across Michigan.",
};

const PAGE_SIZE = 10;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const type = one(sp.type) in EVENT_TYPE_LABELS ? one(sp.type) : "";
  const format = ["virtual", "in_person"].includes(one(sp.format)) ? one(sp.format) : "";
  let result: Awaited<ReturnType<typeof getUpcomingEvents>>;
  try {
    result = await getUpcomingEvents(PAGE_SIZE, {
      type: type || undefined,
      virtualOnly: format === "virtual",
      inPersonOnly: format === "in_person",
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (err) {
    console.error("[events] failed", err);
    return (
      <div className="container-page py-8">
        <PageHeader title="Upcoming events" />
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
          <p className="font-semibold">We’re having trouble loading resources right now. Please try again.</p>
          <a href="/events" className={buttonVariants({ variant: "outline" })}>
            <RefreshCw aria-hidden /> Try again
          </a>
        </div>
      </div>
    );
  }
  const saved = await getSavedState(result.cards.map((c) => c.id));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (format) q.set("format", format);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };
  const filtered = !!(type || format);

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Upcoming events"
        description="Workshops, support groups, webinars, and community events, listed in date order. Times are Eastern Time."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Events" }]}
      />
      <form method="get" action="/events" className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-type" className="font-semibold">
            Event type
          </label>
          <select id="e-type" name="type" defaultValue={type} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">All event types</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-format" className="font-semibold">
            Format
          </label>
          <select id="e-format" name="format" defaultValue={format} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">In person and virtual</option>
            <option value="in_person">In person only</option>
            <option value="virtual">Virtual only</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonVariants()}>
            Apply filters
          </button>
          {filtered && (
            <Link href="/events" className={buttonVariants({ variant: "outline" })}>
              Clear
            </Link>
          )}
        </div>
      </form>
      <p role="status" className="mb-4 text-lg font-semibold">
        {pluralize(result.total, "upcoming event")}
      </p>
      {result.cards.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events match" description="Try a different event type or format.">
          {filtered && (
            <Link href="/events" className={buttonVariants({ variant: "outline" })}>
              Show all events
            </Link>
          )}
          <Link href="/suggest?type=resource" className={buttonVariants()}>
            Suggest an event
          </Link>
        </EmptyState>
      ) : (
        <>
          <h2 className="sr-only">Event list</h2>
          <ol className="flex flex-col gap-4">
            {result.cards.map((c) => (
              <li key={c.id}>
                <ResultCard item={c} saved={saved.savedIds.includes(c.id)} signedIn={saved.signedIn} nextPath={href(page)} />
              </li>
            ))}
          </ol>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} hrefFor={href} label="Event pages" />
        </>
      )}
    </div>
  );
}
