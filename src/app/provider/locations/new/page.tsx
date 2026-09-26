import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { listChangeRequests, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { firstParam, openRequestFor } from "../../_lib/prefill";
import { LocationForm } from "../location-form";
import { EMPTY_LOCATION, toLocationForm } from "../values";

export const metadata: Metadata = { title: "Add a Location" };

export default async function NewLocationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/locations/new");
  const reviseId = firstParam(sp.revise);
  const revising = reviseId ? openRequestFor(await listChangeRequests(ctx.org.id), "location", null, reviseId) : null;
  const values = revising ? toLocationForm({ ...EMPTY_LOCATION, wheelchair_accessible: null, accessible_parking: null, ...revising.proposed }) : EMPTY_LOCATION;

  return (
    <>
      <PageHeader
        title={revising ? "Revise new location" : "Add a location"}
        breadcrumbs={[{ label: "Locations", href: "/provider/locations" }, { label: revising ? "Revise new location" : "Add a location" }]}
        description="New locations are reviewed by a MittenLink verifier before they appear on your public listing."
      />
      {revising && <PendingNotice request={revising} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} className="mb-6" />}
      <Panel>
        <LocationForm targetId={null} values={values} replaces={revising?.id ?? null} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
