import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { PendingNotice } from "@/components/provider/pending-notice";
import { LOCATION_STATUS_LABELS } from "@/components/provider/constants";
import { listChangeRequests, listLocations, loadProviderContext, openRequestsByTarget, type LocationRecord } from "@/lib/data/provider";
import { formatDate, formatHours } from "@/lib/format";
import { withdrawChangeRequest } from "../change-actions";

export const metadata: Metadata = { title: "Locations" };

const yesNo = (v: boolean | null) => (v === true ? "Yes" : v === false ? "No" : "Not listed");

export default async function LocationsPage() {
  const ctx = await loadProviderContext("/provider/locations");
  const [locations, requests] = await Promise.all([listLocations(ctx.org.id), listChangeRequests(ctx.org.id, { openOnly: true })]);
  const pendingByTarget = openRequestsByTarget(requests);
  const pendingNew = requests.filter((r) => r.target_type === "location" && r.action === "create");

  return (
    <>
      <PageHeader
        title="Locations"
        description="Addresses, hours and accessibility details for each place people can visit. Changes are reviewed before they are published."
        actions={
          <Link href="/provider/locations/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add a location
          </Link>
        }
      />

      {pendingNew.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <h2 className="text-xl font-bold">New locations waiting for review</h2>
          {pendingNew.map((r) => (
            <div key={r.id} className="flex flex-col gap-2">
              <p className="font-semibold">{r.target_title}</p>
              <PendingNotice request={r} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} compact />
              {r.status === "more_info_required" && (
                <Link href={`/provider/locations/new?revise=${r.id}`} className="text-sm font-semibold text-primary underline">
                  Update and resubmit {r.target_title}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <DataTable<LocationRecord>
        caption={`Locations for ${ctx.org.title}`}
        rows={locations}
        rowKey={(l) => l.id}
        empty={
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            description="Add the address where people can visit you. Organizations that serve people only by phone or online can skip this."
            action={{ label: "Add a location", href: "/provider/locations/new" }}
          />
        }
        columns={[
          {
            key: "name",
            header: "Location",
            primary: true,
            cell: (l) => (
              <div className="flex flex-col gap-0.5">
                <span>
                  {l.name}
                  {l.is_primary && <span className="ml-2 text-sm font-normal text-muted-foreground">(primary)</span>}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {l.street}
                  {l.street2 ? `, ${l.street2}` : ""}, {l.city}, {l.state} {l.zip}
                </span>
              </div>
            ),
          },
          {
            key: "hours",
            header: "Hours",
            cell: (l) => {
              const rows = formatHours(l.hours);
              if (!rows.length) return <span className="text-muted-foreground">No hours listed</span>;
              return (
                <ul className="text-sm">
                  {rows.map((r) => (
                    <li key={r.day}>
                      <span className="font-semibold">{r.day.slice(0, 3)}</span> {r.hours}
                    </li>
                  ))}
                </ul>
              );
            },
          },
          {
            key: "access",
            header: "Accessibility",
            cell: (l) => (
              <ul className="text-sm">
                <li>Wheelchair accessible: {yesNo(l.wheelchair_accessible)}</li>
                <li>Accessible parking: {yesNo(l.accessible_parking)}</li>
                {l.appointment_required && <li>Appointment required</li>}
                {l.virtual_services && <li>Virtual services</li>}
              </ul>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (l) => {
              const pending = pendingByTarget.get(l.id);
              return (
                <div className="flex flex-col items-start gap-2">
                  <StatusPill tone={l.status === "open" ? "success" : l.status === "closed" ? "neutral" : "warning"}>{LOCATION_STATUS_LABELS[l.status]}</StatusPill>
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
            cell: (l) => (
              <Link href={`/provider/locations/${l.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {pendingByTarget.has(l.id) ? "Review pending update" : "Edit"}
                <span className="sr-only"> for {l.name}</span>
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
