import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/common/page";
import { VerificationBadge, LastReviewed } from "@/components/common/badges";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, listLocations, listServices, loadProviderContext } from "@/lib/data/provider";
import { listingHref } from "@/lib/links";
import { withdrawChangeRequest } from "../../change-actions";
import { openRequestFor, withProposal } from "../../_lib/prefill";
import { ServiceForm } from "../service-form";
import { serviceRaw, toServiceForm } from "../values";

export const metadata: Metadata = { title: "Edit Service" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadProviderContext(`/provider/services/${id}`);
  const [services, requests, ref, locations] = await Promise.all([
    listServices(ctx.org.id),
    listChangeRequests(ctx.org.id),
    getReferenceOptions(),
    listLocations(ctx.org.id),
  ]);
  const service = services.find((s) => s.id === id);
  if (!service) notFound();
  const pending = openRequestFor(requests, "service", service.id);
  const values = toServiceForm(withProposal(serviceRaw(service), pending));

  return (
    <>
      <PageHeader
        title={`Edit ${service.title}`}
        breadcrumbs={[{ label: "Services", href: "/provider/services" }, { label: service.title }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={service.verification_status} />
            <LastReviewed date={service.last_verified_at} />
            {service.publication_status === "published" && (
              <Link href={listingHref("service", service.slug)} className="text-base font-semibold text-primary underline">
                View public page
              </Link>
            )}
          </span>
        }
      />
      {pending && (
        <div className="mb-6 flex flex-col gap-2">
          <PendingNotice request={pending} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} />
          <p className="text-muted-foreground">The form includes the changes you already submitted. Submitting again replaces your pending update.</p>
        </div>
      )}
      <Panel>
        <ServiceForm
          targetId={service.id}
          values={values}
          replaces={pending?.id ?? null}
          options={{ ...ref, locations: locations.map((l) => ({ value: l.id, label: `${l.name} — ${l.city}` })) }}
          fieldLabels={FIELD_LABELS}
        />
      </Panel>
    </>
  );
}
