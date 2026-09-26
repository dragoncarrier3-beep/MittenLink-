import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { PendingNotice } from "@/components/provider/pending-notice";
import { listChangeRequests, listServices, loadProviderContext, openRequestsByTarget, type ServiceRecord } from "@/lib/data/provider";
import { formatDate } from "@/lib/format";
import { WAITLIST_LABELS, label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { withdrawChangeRequest } from "../change-actions";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await loadProviderContext("/provider/services");
  const [services, requests] = await Promise.all([listServices(ctx.org.id), listChangeRequests(ctx.org.id, { openOnly: true })]);
  const pendingByTarget = openRequestsByTarget(requests);
  const pendingNew = requests.filter((r) => r.target_type === "service" && r.action === "create");

  return (
    <>
      <PageHeader
        title="Services"
        description="The services families can find on MittenLink. Edits and new services are reviewed by a MittenLink verifier before they are published."
        actions={
          <Link href="/provider/services/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add a service
          </Link>
        }
      />

      {pendingNew.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <h2 className="text-xl font-bold">New services waiting for review</h2>
          {pendingNew.map((r) => (
            <div key={r.id} className="flex flex-col gap-2">
              <p className="font-semibold">{r.target_title}</p>
              <PendingNotice request={r} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} compact />
              <Link href={`/provider/services/new?revise=${r.id}`} className="text-sm font-semibold text-primary underline">
                Revise {r.target_title}
              </Link>
            </div>
          ))}
        </div>
      )}

      <DataTable<ServiceRecord>
        caption={`Services offered by ${ctx.org.title}`}
        rows={services}
        rowKey={(s) => s.id}
        empty={
          <EmptyState
            icon={HeartHandshake}
            title="No services listed yet"
            description="Add the services you offer so families can find them by category, location and eligibility."
            action={{ label: "Add a service", href: "/provider/services/new" }}
          />
        }
        columns={[
          {
            key: "title",
            header: "Service",
            primary: true,
            cell: (s) => (
              <div className="flex flex-col gap-1">
                <span>{s.title}</span>
                <span className="text-sm font-normal text-muted-foreground">{s.summary}</span>
                {s.is_featured && (
                  <StatusPill tone="enhanced" className="self-start" icon={<Star className="size-4" aria-hidden />}>
                    Featured service
                  </StatusPill>
                )}
              </div>
            ),
          },
          { key: "waitlist", header: "New clients", cell: (s) => label(WAITLIST_LABELS, s.waitlist_status) },
          {
            key: "status",
            header: "Status",
            cell: (s) => {
              const pending = pendingByTarget.get(s.id);
              return (
                <div className="flex flex-col items-start gap-2">
                  <VerificationBadge status={s.verification_status} />
                  {pending && (
                    <StatusPill tone={pending.status === "more_info_required" ? "warning" : "info"}>
                      {pending.status === "more_info_required" ? "More information requested" : "Update pending review"} — submitted{" "}
                      {formatDate(pending.created_at, { month: "short", day: "numeric" })}
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
            cell: (s) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/provider/services/${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {pendingByTarget.has(s.id) ? "Review pending update" : "Edit"}
                  <span className="sr-only"> for {s.title}</span>
                </Link>
                {s.publication_status === "published" && (
                  <Link href={listingHref("service", s.slug)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    View public page<span className="sr-only"> for {s.title}</span>
                  </Link>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
