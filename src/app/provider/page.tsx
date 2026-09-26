import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, CircleDashed, ExternalLink, HeartHandshake, Info, MapPin } from "lucide-react";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { ListingTierBadge, StatusPill, VerificationBadge, LastReviewed } from "@/components/common/badges";
import { PUBLICATION_LABELS } from "@/components/provider/constants";
import {
  getOrganization,
  getOverviewCounts,
  getRecentNotifications,
  listChangeRequests,
  listLocations,
  loadProviderContext,
  profileCompleteness,
} from "@/lib/data/provider";
import { formatDate, formatDay, formatRelative, pluralize } from "@/lib/format";
import { CHANGE_STATUS_LABELS, VERIFICATION_DESCRIPTIONS, label, type VerificationStatus } from "@/lib/labels";
import { listingHref } from "@/lib/links";

export const metadata: Metadata = { title: { absolute: "Provider Dashboard | MittenLink" } };

function daysUntil(d: Date | string | null) {
  if (!d) return null;
  const iso = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const target = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel as="section" className={`flex flex-col gap-2 ${className ?? ""}`}>
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </Panel>
  );
}

export default async function ProviderOverviewPage() {
  const ctx = await loadProviderContext("/provider");
  const [org, counts, locations, pending, notifications] = await Promise.all([
    getOrganization(ctx.org.id),
    getOverviewCounts(ctx.org.id),
    listLocations(ctx.org.id),
    listChangeRequests(ctx.org.id, { openOnly: true, limit: 8 }),
    getRecentNotifications(5),
  ]);
  if (!org) return <EmptyState title="Organization not found" description="We couldn't load this organization. Try switching organizations." />;

  const completeness = profileCompleteness(org, locations, counts.services);
  const status = org.verification_status as VerificationStatus;
  const dueIn = daysUntil(org.next_review_at);
  const dueSoon = dueIn !== null && dueIn <= 14;

  return (
    <>
      <PageHeader
        eyebrow="Provider Dashboard"
        title={org.title}
        description={`Welcome back, ${ctx.user.fullName.split(" ")[0]}. Here's how your listing looks today.`}
        actions={
          org.publication_status === "published" ? (
            <Link href={listingHref("organization", org.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 font-semibold hover:bg-muted">
              View public listing <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {dueSoon && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            <strong>{dueIn! < 0 ? "Your verification review is overdue." : dueIn === 0 ? "Your verification review is due today." : `Your verification review is due in ${pluralize(dueIn!, "day")}.`}</strong>{" "}
            Please check that your{" "}
            <Link href="/provider/organization" className="font-semibold underline">
              organization details
            </Link>
            ,{" "}
            <Link href="/provider/locations" className="font-semibold underline">
              locations
            </Link>{" "}
            and{" "}
            <Link href="/provider/services" className="font-semibold underline">
              services
            </Link>{" "}
            are current.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Listing status">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={org.publication_status === "published" ? "success" : "neutral"}>{label(PUBLICATION_LABELS, org.publication_status)}</StatusPill>
            <ListingTierBadge tier={org.listing_tier} showFree />
          </div>
          <p className="text-sm text-muted-foreground">{org.listing_tier === "enhanced" ? "Enhanced Listing" : "Free Listing"}</p>
          <Link href="/provider/plan" className="mt-auto text-sm font-semibold text-primary underline">
            Manage listing plan
          </Link>
        </Card>

        <Card title="Verification status">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={status} />
            <LastReviewed date={org.last_verified_at} />
          </div>
          <p className="text-sm text-muted-foreground">{VERIFICATION_DESCRIPTIONS[status]}</p>
          <Link href="/provider/verification" className="mt-auto text-sm font-semibold text-primary underline">
            Verification &amp; updates
          </Link>
        </Card>

        <Card title="Next verification">
          <p className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="size-6 text-primary" aria-hidden />
            {org.next_review_at ? formatDay(org.next_review_at) : "Not scheduled"}
          </p>
          {dueSoon ? (
            <StatusPill tone="warning" className="self-start" icon={<AlertTriangle className="size-4" aria-hidden />}>
              {dueIn! < 0 ? "Overdue" : "Due within 14 days"}
            </StatusPill>
          ) : (
            <p className="text-sm text-muted-foreground">MittenLink reviews listings about every six months.</p>
          )}
        </Card>

        <Card title="Locations">
          <p className="flex items-center gap-2 text-3xl font-bold">
            <MapPin className="size-6 text-primary" aria-hidden /> {counts.locations}
          </p>
          <Link href="/provider/locations" className="mt-auto text-sm font-semibold text-primary underline">
            Manage locations
          </Link>
        </Card>

        <Card title="Services">
          <p className="flex items-center gap-2 text-3xl font-bold">
            <HeartHandshake className="size-6 text-primary" aria-hidden /> {counts.services}
          </p>
          <p className="text-sm text-muted-foreground">
            {pluralize(counts.programs, "program")} · {pluralize(counts.events, "upcoming event")}
          </p>
          <Link href="/provider/services" className="mt-auto text-sm font-semibold text-primary underline">
            Manage services
          </Link>
        </Card>

        <Card title="Profile completeness">
          <p className="text-3xl font-bold">{completeness.percent}%</p>
          <div className="h-3 rounded-full bg-muted" role="progressbar" aria-valuenow={completeness.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div className="h-3 rounded-full bg-primary" style={{ width: `${completeness.percent}%` }} />
          </div>
          {completeness.missing.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Your profile is complete.
            </p>
          ) : (
            <div className="text-sm">
              <p className="font-semibold">Still missing:</p>
              <ul className="mt-1 flex flex-col gap-1">
                {completeness.missing.map((m) => (
                  <li key={m.key} className="flex items-start gap-2">
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Link href={m.href} className="text-primary underline">
                      Add {m.label.charAt(0).toLowerCase() + m.label.slice(1)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
        <p>
          <strong>Verification and Enhanced are separate.</strong> Verification is free and based only on whether your information can be confirmed. Payment never
          affects verification, and Enhanced Listings are always labeled.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Section title="Pending updates" actions={<Link href="/provider/verification" className="font-semibold text-primary underline">View all</Link>}>
          {pending.length === 0 ? (
            <EmptyState title="No updates waiting for review" description="Changes you submit appear here until a MittenLink verifier reviews them." headingLevel={3} />
          ) : (
            <ul className="flex flex-col gap-3">
              {pending.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={r.status === "more_info_required" ? "warning" : "info"}>{label(CHANGE_STATUS_LABELS, r.status)}</StatusPill>
                    <span className="text-sm text-muted-foreground">Submitted {formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-2 font-semibold">{r.summary}</p>
                  {r.status === "more_info_required" && r.review_message && <p className="mt-1 text-sm">Verifier asked: {r.review_message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent notifications">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" headingLevel={3} />
          ) : (
            <ul className="flex flex-col gap-3">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {n.link_url ? (
                      <Link href={n.link_url} className="underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">{formatRelative(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Quick links" className="mt-10">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/provider/organization", label: "Edit organization profile" },
            { href: "/provider/services/new", label: "Add a service" },
            { href: "/provider/events/new", label: "Add an event" },
            { href: "/provider/locations/new", label: "Add a location" },
            { href: "/provider/verification", label: "Verification & updates" },
            { href: "/provider/analytics", label: "Listing analytics" },
            { href: "/provider/plan", label: "Listing plan" },
            { href: "/account", label: "Account settings" },
          ].map((q) => (
            <li key={q.href}>
              <Link href={q.href} className="flex min-h-11 items-center rounded-lg border bg-card px-4 py-3 font-semibold hover:bg-muted">
                {q.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
