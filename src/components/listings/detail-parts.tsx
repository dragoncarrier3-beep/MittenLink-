import Link from "next/link";
import { Accessibility, AlertTriangle, Bus, CalendarCheck, Car, Check, Clock, Flag, Mail, MapPin, Monitor, Phone, ShieldCheck, X } from "lucide-react";
import { LastReviewed, VerificationBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { formatDate, formatHours, telHref, directionsHref } from "@/lib/format";
import { METHOD_LABELS, VERIFICATION_DESCRIPTIONS, VERIFICATION_LABELS, label, type VerificationStatus } from "@/lib/labels";
import type { LocationInfo, VerificationEntry } from "@/lib/data/profiles";

/** Notice shown for listings that are not currently verified. */
export function VerificationNotice({ status }: { status: string }) {
  if (status === "verified") return null;
  const s = (status in VERIFICATION_DESCRIPTIONS ? status : "unverified") as VerificationStatus;
  const tone = s === "needs_update" ? "warning" : s === "unable_to_verify" ? "danger" : "info";
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-foreground",
        tone === "warning" && "border-warning/30 bg-warning-soft",
        tone === "danger" && "border-danger/30 bg-danger-soft",
        tone === "info" && "border-info/30 bg-info-soft",
      )}
    >
      <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-info")} aria-hidden />
      <div>
        <p className="font-bold">{VERIFICATION_LABELS[s]}</p>
        <p>{VERIFICATION_DESCRIPTIONS[s]}</p>
      </div>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  verified: "Verified",
  status_change: "Status updated",
  change_approved: "Update approved",
  update_requested: "Update requested",
  unable_to_verify: "Could not be verified",
};

/** Public verification information (never internal notes). */
export function VerificationInfo({
  status,
  lastVerifiedAt,
  history,
  listingId,
  headingId = "verification-heading",
}: {
  status: string;
  lastVerifiedAt: Date | string | null;
  history: VerificationEntry[];
  listingId: string;
  headingId?: string;
}) {
  const s = (status in VERIFICATION_DESCRIPTIONS ? status : "unverified") as VerificationStatus;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <VerificationBadge status={s} />
        <LastReviewed date={lastVerifiedAt} />
      </div>
      <p>{VERIFICATION_DESCRIPTIONS[s]}</p>
      {s === "verified" && lastVerifiedAt && (
        <p className="font-semibold">This information was reviewed by MittenLink on {formatDate(lastVerifiedAt)}.</p>
      )}
      <p className="text-muted-foreground">
        Verification confirms listing details such as contact information, hours, and services. It is not a medical or professional endorsement, and
        payment for an Enhanced Listing never affects verification.{" "}
        <Link href="/about#verification" className="font-semibold text-primary underline">
          How verification works
        </Link>
      </p>
      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-lg font-bold" id={`${headingId}-history`}>
            Review history
          </h3>
          <ol className="flex flex-col gap-3" aria-labelledby={`${headingId}-history`}>
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border bg-card p-3">
                <p className="font-semibold">
                  {formatDate(h.created_at)} — {ACTION_LABELS[h.action] ?? label(VERIFICATION_LABELS, h.new_status)}
                </p>
                {h.method && <p className="text-muted-foreground">Method: {label(METHOD_LABELS, h.method)}</p>}
                {h.public_summary && <p className="mt-1">{h.public_summary}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <ReportOutdatedLink listingId={listingId} />
    </div>
  );
}

export function ReportOutdatedLink({ listingId, className }: { listingId: string; className?: string }) {
  return (
    <p className={className}>
      <Link href={`/report?listing=${listingId}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline">
        <Flag className="size-4" aria-hidden /> Report outdated information
      </Link>
    </p>
  );
}

function Feature({ value, yes, no, unknown, icon: Icon }: { value: boolean | null; yes: string; no: string; unknown?: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }) {
  if (value === null && !unknown) return null;
  const text = value === null ? unknown : value ? yes : no;
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        {value === true && <Check className="mr-1 inline size-4 text-success" aria-hidden />}
        {value === false && <X className="mr-1 inline size-4 text-danger" aria-hidden />}
        {text}
      </span>
    </li>
  );
}

export function HoursTable({ hours, caption }: { hours: LocationInfo["hours"]; caption: string }) {
  const rows = formatHours(Array.isArray(hours) ? hours : []);
  if (!rows.length) return <p className="text-muted-foreground">Hours not listed. Please call ahead.</p>;
  return (
    <table className="w-full max-w-sm border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Hours</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.day} className="border-b last:border-b-0">
            <th scope="row" className="py-1.5 pr-4 font-semibold">
              {r.day}
            </th>
            <td className="py-1.5">{r.hours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LocationCard({ loc, headingLevel = 3 }: { loc: LocationInfo; headingLevel?: 3 | 4 }) {
  const H = `h${headingLevel}` as "h3" | "h4";
  const address = [loc.street, loc.street2, `${loc.city}, ${loc.state} ${loc.zip}`].filter(Boolean);
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-label={loc.name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <H className="text-xl font-bold">{loc.name}</H>
          {loc.is_primary && <p className="text-sm font-semibold text-primary">Main location</p>}
          {loc.status === "temporarily_closed" && <p className="font-semibold text-danger">Temporarily closed</p>}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <address className="flex items-start gap-2 not-italic">
            <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              {address.map((a) => (
                <span key={a} className="block">
                  {a}
                </span>
              ))}
              <span className="block text-muted-foreground">{loc.county} County</span>
            </span>
          </address>
          {loc.phone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-primary" aria-hidden />
              <a href={telHref(loc.phone)} className="underline">
                {loc.phone}
              </a>
            </p>
          )}
          {loc.email && (
            <p className="flex items-center gap-2 break-all">
              <Mail className="size-4 shrink-0 text-primary" aria-hidden />
              <a href={`mailto:${loc.email}`} className="underline">
                {loc.email}
              </a>
            </p>
          )}
          <p>
            <a href={directionsHref([loc.street, loc.city, loc.state, loc.zip])} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              Get directions<span className="sr-only"> to {loc.name} (opens OpenStreetMap in a new tab)</span>
            </a>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            <Feature value={loc.wheelchair_accessible} yes="Wheelchair accessible" no="Not wheelchair accessible" unknown="Wheelchair access not confirmed — please call ahead" icon={Accessibility} />
            <Feature value={loc.accessible_parking} yes="Accessible parking available" no="No accessible parking" icon={Car} />
            <Feature value={loc.appointment_required} yes="Appointment required" no="No appointment required" icon={CalendarCheck} />
            <Feature value={loc.virtual_services ? true : null} yes="Virtual services available" no="" icon={Monitor} />
            {loc.transit_info && (
              <li className="flex items-start gap-2">
                <Bus className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span>{loc.transit_info}</span>
              </li>
            )}
          </ul>
          {loc.service_area_note && <p className="text-muted-foreground">{loc.service_area_note}</p>}
        </div>
        <div>
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-primary" aria-hidden /> Hours
          </p>
          <HoursTable hours={loc.hours} caption={`Hours for ${loc.name}`} />
          {loc.hours_note && <p className="mt-2 text-muted-foreground">{loc.hours_note}</p>}
        </div>
      </div>
    </article>
  );
}

export function TagList({ items, label: listLabel }: { items: string[]; label: string }) {
  if (!items.length) return <p className="text-muted-foreground">Not specified.</p>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={listLabel}>
      {items.map((i) => (
        <li key={i} className="rounded-md bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">
          {i}
        </li>
      ))}
    </ul>
  );
}

export function TrustNote() {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>Always confirm eligibility, cost, and availability directly with the organization.</span>
    </p>
  );
}

export function ageRange(min: number | null, max: number | null) {
  if (min === null && max === null) return "All ages";
  if (min !== null && max !== null) return `Ages ${min}–${max}`;
  if (min !== null) return `Ages ${min} and older`;
  return `Up to age ${max}`;
}

export function deliveryModes(s: { in_person: boolean; home_based: boolean; virtual_available: boolean }) {
  const modes = [s.in_person && "In person", s.virtual_available && "Virtual", s.home_based && "Home based"].filter(Boolean) as string[];
  return modes.length ? modes.join(", ") : "Contact the organization";
}

export function DetailSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-24", className)}>
      <h2 id={`${id}-heading`} className="mb-4 border-b pb-2 text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function splitParagraphs(text: string | null | undefined) {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
