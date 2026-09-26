import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { firstParam, openRequestFor } from "../../_lib/prefill";
import { EventForm } from "../event-form";
import { EMPTY_EVENT, toEventForm } from "../values";

export const metadata: Metadata = { title: "Add an Event" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/events/new");
  const reviseId = firstParam(sp.revise);
  const [ref, requests] = await Promise.all([getReferenceOptions(), reviseId ? listChangeRequests(ctx.org.id) : Promise.resolve([])]);
  const revising = reviseId ? openRequestFor(requests, "event", null, reviseId) : null;
  const values = revising ? toEventForm({ ...EMPTY_EVENT, ...revising.proposed }) : EMPTY_EVENT;
  const title = revising ? "Revise new event" : "Add an event";
  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: "Events", href: "/provider/events" }, { label: title }]} description="New events are reviewed by a MittenLink verifier before they appear publicly." />
      {revising && <PendingNotice request={revising} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} className="mb-6" />}
      <Panel>
        <EventForm targetId={null} values={values} replaces={revising?.id ?? null} options={ref} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
