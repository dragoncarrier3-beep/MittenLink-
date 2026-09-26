import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/common/page";
import { PendingNotice } from "@/components/provider/pending-notice";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { getReferenceOptions, listChangeRequests, listPrograms, loadProviderContext } from "@/lib/data/provider";
import { withdrawChangeRequest } from "../../change-actions";
import { openRequestFor, withProposal } from "../../_lib/prefill";
import { ProgramForm } from "../program-form";
import { toProgramForm } from "../values";

export const metadata: Metadata = { title: "Edit Program" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadProviderContext(`/provider/programs/${id}`);
  const [programs, requests, ref] = await Promise.all([listPrograms(ctx.org.id), listChangeRequests(ctx.org.id), getReferenceOptions()]);
  const program = programs.find((p) => p.id === id);
  if (!program) notFound();
  const pending = openRequestFor(requests, "program", program.id);
  const values = toProgramForm(withProposal({ ...program } as Record<string, unknown>, pending));
  return (
    <>
      <PageHeader title={`Edit ${program.title}`} breadcrumbs={[{ label: "Programs", href: "/provider/programs" }, { label: program.title }]} description="A MittenLink verifier reviews changes before they are published." />
      {pending && (
        <div className="mb-6 flex flex-col gap-2">
          <PendingNotice request={pending} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} />
          <p className="text-muted-foreground">The form includes the changes you already submitted. Submitting again replaces your pending update.</p>
        </div>
      )}
      <Panel>
        <ProgramForm targetId={program.id} values={values} replaces={pending?.id ?? null} options={ref} fieldLabels={FIELD_LABELS} />
      </Panel>
    </>
  );
}
