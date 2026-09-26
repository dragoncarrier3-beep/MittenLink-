import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getLookups, getSource } from "@/lib/data/operations";
import { PageHeader, Panel } from "@/components/common/page";
import { SourceForm } from "@/components/operations/source-watch-forms";

export const metadata: Metadata = { title: "Edit Watched Source" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/source-watch/sources/${id}`);
  if (!UUID.test(id)) notFound();
  const [source, { counties }] = await Promise.all([getSource(id), getLookups()]);
  if (!source) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${source.name}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Source Watch", href: "/admin/source-watch?tab=sources" }, { label: "Edit source" }]}
      />
      <Panel className="max-w-2xl">
        <SourceForm counties={counties.map((c) => ({ value: String(c.id), label: `${c.name} County` }))} defaults={source} />
      </Panel>
    </>
  );
}
