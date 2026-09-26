import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { firstParam, openRequestFor } from "../../_lib/prefill";
import { ProgramForm } from "../program-form";
import { EMPTY_PROGRAM, toProgramForm } from "../values";

export const metadata: Metadata = { title: "Add a Program" };

export default async function NewProgramPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/programs/new");
  const reviseId = firstParam(sp.revise);
  const [ref, requests] = await Promise.all([getReferenceOptions(), reviseId ? listChangeRequests(ctx.org.id) : Promise.resolve([])]);
  const revising = reviseId ? openRequestFor(requests, "program", null, reviseId) : null;
  const values = revising ? toProgramForm({ ...EMPTY_PROGRAM, ...revising.proposed }) : EMPTY_PROGRAM;
  const title = revising ? "Revise new program" : "Add a program";
  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: "Programs", href: "/provider/programs" }, { label: title }]} description="New programs are reviewed by a MittenLink verifier before they appear publicly." />
      {revising && <PendingNotice request={revising} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} className="mb-6" />}
      <Panel>
        <ProgramForm targetId={null} values={values} replaces={revising?.id ?? null} options={ref} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
