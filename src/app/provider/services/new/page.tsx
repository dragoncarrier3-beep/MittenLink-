import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, listLocations, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { firstParam, openRequestFor } from "../../_lib/prefill";
import { ServiceForm } from "../service-form";
import { EMPTY_SERVICE, toServiceForm } from "../values";

export const metadata: Metadata = { title: "Add a Service" };

export default async function NewServicePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/services/new");
  const reviseId = firstParam(sp.revise);
  const [ref, locations, requests] = await Promise.all([getReferenceOptions(), listLocations(ctx.org.id), reviseId ? listChangeRequests(ctx.org.id) : Promise.resolve([])]);
  const revising = reviseId ? openRequestFor(requests, "service", null, reviseId) : null;
  const values = revising ? toServiceForm({ ...EMPTY_SERVICE, ...revising.proposed }) : EMPTY_SERVICE;
  const title = revising ? "Revise new service" : "Add a service";

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "Services", href: "/provider/services" }, { label: title }]}
        description="New services are reviewed by a MittenLink verifier before they appear on your public listing."
      />
      {revising && <PendingNotice request={revising} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} className="mb-6" />}
      <Panel>
        <ServiceForm
          targetId={null}
          values={values}
          replaces={revising?.id ?? null}
          options={{ ...ref, locations: locations.map((l) => ({ value: l.id, label: `${l.name} — ${l.city}` })) }}
          fieldLabels={FIELD_LABELS}
        />
      </Panel>
    </>
  );
}
