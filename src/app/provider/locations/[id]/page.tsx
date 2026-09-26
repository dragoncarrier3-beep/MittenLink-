import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { listChangeRequests, listLocations, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { openRequestFor, withProposal } from "../../_lib/prefill";
import { LocationForm } from "../location-form";
import { locationRaw, toLocationForm } from "../values";

export const metadata: Metadata = { title: "Edit Location" };

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadProviderContext(`/provider/locations/${id}`);
  const [locations, requests] = await Promise.all([listLocations(ctx.org.id), listChangeRequests(ctx.org.id)]);
  const location = locations.find((l) => l.id === id);
  if (!location) notFound();
  const pending = openRequestFor(requests, "location", location.id);
  const values = toLocationForm(withProposal(locationRaw(location), pending));

  return (
    <>
      <PageHeader
        title={`Edit ${location.name}`}
        breadcrumbs={[{ label: "Locations", href: "/provider/locations" }, { label: location.name }]}
        description="Update this location's address, hours and accessibility details. A MittenLink verifier reviews changes before they are published."
      />
      {pending && (
        <div className="mb-6 flex flex-col gap-2">
          <PendingNotice request={pending} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} />
          <p className="text-muted-foreground">The form includes the changes you already submitted. Submitting again replaces your pending update.</p>
        </div>
      )}
      <Panel>
        <LocationForm targetId={location.id} values={values} replaces={pending?.id ?? null} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
