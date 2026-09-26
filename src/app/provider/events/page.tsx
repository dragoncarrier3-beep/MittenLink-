import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { PageHeader, Section } from "@/components/common/page";
import { DataTable, type Column } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { PendingNotice } from "@/components/provider/pending-notice";
import { listChangeRequests, listEvents, loadProviderContext, openRequestsByTarget, type EventRecord } from "@/lib/data/provider";
import { formatDate, formatDateTime } from "@/lib/format";
import { EVENT_TYPE_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { withdrawChangeRequest } from "../change-actions";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const ctx = await loadProviderContext("/provider/events");
  const [events, requests] = await Promise.all([listEvents(ctx.org.id), listChangeRequests(ctx.org.id, { openOnly: true })]);
  const pendingByTarget = openRequestsByTarget(requests);
  const pendingNew = requests.filter((r) => r.target_type === "event" && r.action === "create");
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() >= now).reverse();
  const past = events.filter((e) => new Date(e.ends_at).getTime() < now).slice(0, 10);

  const columns: Column<EventRecord>[] = [
    {
      key: "title",
      header: "Event",
      primary: true,
      cell: (e) => (
        <div className="flex flex-col gap-1">
          <span>{e.title}</span>
          <span className="text-sm font-normal text-muted-foreground">{label(EVENT_TYPE_LABELS, e.event_type)}</span>
        </div>
      ),
    },
    { key: "when", header: "When", cell: (e) => formatDateTime(e.starts_at) },
    { key: "where", header: "Where", cell: (e) => [e.is_in_person ? e.venue_name || e.city || "In person" : null, e.virtual_available ? "Online" : null].filter(Boolean).join(" · ") },
    {
      key: "status",
      header: "Status",
      cell: (e) => {
        const pending = pendingByTarget.get(e.id);
        return (
          <div className="flex flex-col items-start gap-2">
            <VerificationBadge status={e.verification_status} />
            {pending && (
              <StatusPill tone={pending.status === "more_info_required" ? "warning" : "info"}>
                {pending.status === "more_info_required" ? "More information requested" : "Update pending review"} — submitted {formatDate(pending.created_at, { month: "short", day: "numeric" })}
              </StatusPill>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (e) => (
        <div className="flex flex-wrap gap-2">
          <Link href={`/provider/events/${e.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {pendingByTarget.has(e.id) ? "Review pending update" : "Edit"}
            <span className="sr-only"> for {e.title}</span>
          </Link>
          {e.publication_status === "published" && (
            <Link href={listingHref("event", e.slug)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View public page<span className="sr-only"> for {e.title}</span>
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        description="Workshops, support groups, trainings and community events. Times are shown in Michigan (Eastern) time. New events and edits are reviewed before they are published."
        actions={
          <Link href="/provider/events/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add an event
          </Link>
        }
      />
      {pendingNew.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <h2 className="text-xl font-bold">New events waiting for review</h2>
          {pendingNew.map((r) => (
            <div key={r.id} className="flex flex-col gap-2">
              <p className="font-semibold">{r.target_title}</p>
              <PendingNotice request={r} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} compact />
              <Link href={`/provider/events/new?revise=${r.id}`} className="text-sm font-semibold text-primary underline">
                Revise {r.target_title}
              </Link>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-8">
        <Section title="Upcoming events">
          <DataTable<EventRecord>
            caption="Upcoming events"
            rows={upcoming}
            rowKey={(e) => e.id}
            columns={columns}
            empty={<EmptyState icon={CalendarDays} title="No upcoming events" description="Share your next workshop, support group or community event." action={{ label: "Add an event", href: "/provider/events/new" }} headingLevel={3} />}
          />
        </Section>
        {past.length > 0 && (
          <Section title="Recent past events">
            <DataTable<EventRecord> caption="Recent past events" rows={past} rowKey={(e) => e.id} columns={columns} />
          </Section>
        )}
      </div>
    </>
  );
}
