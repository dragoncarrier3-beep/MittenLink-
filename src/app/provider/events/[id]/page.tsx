import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, listEvents, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { openRequestFor, withProposal } from "../../_lib/prefill";
import { EventForm } from "../event-form";
import { toEventForm } from "../values";

export const metadata: Metadata = { title: "Edit Event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadProviderContext(`/provider/events/${id}`);
  const [events, requests, ref] = await Promise.all([listEvents(ctx.org.id), listChangeRequests(ctx.org.id), getReferenceOptions()]);
  const event = events.find((e) => e.id === id);
  if (!event) notFound();
  const pending = openRequestFor(requests, "event", event.id);
  const values = toEventForm(withProposal({ ...event } as Record<string, unknown>, pending));
  return (
    <>
      <PageHeader title={`Edit ${event.title}`} breadcrumbs={[{ label: "Events", href: "/provider/events" }, { label: event.title }]} description="A MittenLink verifier reviews changes before they are published." />
      {pending && (
        <div className="mb-6 flex flex-col gap-2">
          <PendingNotice request={pending} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} />
          <p className="text-muted-foreground">The form includes the changes you already submitted. Submitting again replaces your pending update.</p>
        </div>
      )}
      <Panel>
        <EventForm targetId={event.id} values={values} replaces={pending?.id ?? null} options={ref} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
