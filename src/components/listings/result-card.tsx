import Link from "next/link";
import { BookOpen, Building2, CalendarDays, ClipboardList, Globe2, HandHeart, MapPin, Monitor, Navigation, Users } from "lucide-react";
import { LastReviewed, ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABELS, KIND_LABELS, RESOURCE_TYPE_LABELS, label } from "@/lib/labels";
import { formatDate, formatMiles, formatTime } from "@/lib/format";
import { listingHref } from "@/lib/links";
import type { ListingCardData } from "@/lib/search/types";
import { SaveButton } from "./save-button";

export const KIND_ICONS = {
  organization: Building2,
  service: HandHeart,
  program: ClipboardList,
  resource: BookOpen,
  event: CalendarDays,
} as const;

/** "Tue, Oct 14, 2026 · 6 p.m. – 8 p.m." in America/Detroit. */
export function formatEventWhen(startsAt: string, endsAt: string) {
  const sameDay = formatDate(startsAt, { year: "numeric", month: "2-digit", day: "2-digit" }) === formatDate(endsAt, { year: "numeric", month: "2-digit", day: "2-digit" });
  const day = formatDate(startsAt, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (sameDay) return `${day} · ${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  return `${day}, ${formatTime(startsAt)} – ${formatDate(endsAt, { weekday: "short", month: "short", day: "numeric" })}, ${formatTime(endsAt)}`;
}

/**
 * Result card used by search, browse pages and the homepage. Rendering order
 * never depends on listing tier; the Enhanced badge is informational only.
 */
export function ResultCard({
  item,
  headingLevel = 3,
  saved = false,
  signedIn = false,
  nextPath = "/search",
  showSave = true,
  active = false,
  mapAction,
  compact = false,
}: {
  item: ListingCardData;
  headingLevel?: 2 | 3 | 4;
  saved?: boolean;
  signedIn?: boolean;
  nextPath?: string;
  showSave?: boolean;
  active?: boolean;
  /** Rendered by client search UI ("Show on map" button). */
  mapAction?: React.ReactNode;
  compact?: boolean;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const href = listingHref(item.kind, item.slug);
  const KindIcon = KIND_ICONS[item.kind];
  const headingId = `card-${item.id}`;
  const distance = item.matchScope === "nearby" || item.matchScope === "serves_area" ? formatMiles(item.distanceMiles) : null;
  const place = [item.city, item.county ? `${item.county} County` : null].filter(Boolean).join(" • ");
  const kindLabel =
    item.kind === "resource" && item.resourceType
      ? label(RESOURCE_TYPE_LABELS, item.resourceType)
      : item.kind === "event" && item.event
        ? label(EVENT_TYPE_LABELS, item.event.eventType)
        : KIND_LABELS[item.kind];
  const statewideLabel = item.matchScope === "statewide" || (item.statewide && item.matchScope !== "nearby");

  return (
    <article
      aria-labelledby={headingId}
      data-listing-id={item.id}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow sm:p-5",
        active && "border-primary ring-3 ring-primary/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="lake" icon={<KindIcon className="size-4" aria-hidden />}>
          {kindLabel}
        </StatusPill>
        <ListingTierBadge tier={item.tier} />
        {statewideLabel && (
          <StatusPill tone="neutral" icon={<Globe2 className="size-4" aria-hidden />}>
            Serves all of Michigan
          </StatusPill>
        )}
        {item.virtual && (
          <StatusPill tone="neutral" icon={<Monitor className="size-4" aria-hidden />}>
            Virtual
          </StatusPill>
        )}
      </div>

      <div>
        <H id={headingId} className="text-xl font-bold leading-snug">
          <Link href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary">
            {item.title}
          </Link>
        </H>
        {item.parent && (
          <p className="mt-1 text-base text-muted-foreground">
            Offered by{" "}
            <Link href={listingHref("organization", item.parent.slug)} className="font-semibold text-foreground underline">
              {item.parent.title}
            </Link>
          </p>
        )}
        {item.event && (
          <p className="mt-1 flex items-start gap-1.5 font-semibold text-foreground">
            <CalendarDays className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              {formatEventWhen(item.event.startsAt, item.event.endsAt)}
            </span>
          </p>
        )}
      </div>

      {item.summary && <p className={cn("text-foreground", compact ? "line-clamp-2" : "line-clamp-3")}>{item.summary}</p>}

      {(place || distance) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
          {place && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {item.event?.venue && item.event.isInPerson ? `${item.event.venue}, ` : ""}
              {place}
            </span>
          )}
          {distance && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Navigation className="size-4 shrink-0" aria-hidden />
              {distance}
            </span>
          )}
        </p>
      )}

      {!compact && (item.categories.length > 0 || item.populations.length > 0) && (
        <div className="flex flex-col gap-2 text-sm">
          {item.categories.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
              {item.categories.slice(0, 4).map((c) => (
                <li key={c.slug} className="rounded-md bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          {item.populations.length > 0 && (
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">Serves:</span> {item.populations.slice(0, 6).join(", ")}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerificationBadge status={item.verificationStatus} />
          <LastReviewed date={item.lastVerifiedAt} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mapAction}
          {showSave && <SaveButton listingId={item.id} title={item.title} initialSaved={saved} signedIn={signedIn} nextPath={nextPath} />}
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-[#08486b]"
          >
            View details<span className="sr-only"> for {item.title}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
