import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getLookups } from "@/lib/data/operations";
import { PageHeader, Panel } from "@/components/common/page";
import { SourceForm } from "@/components/operations/source-watch-forms";

export const metadata: Metadata = { title: "Add Watched Source" };

export default async function NewSourcePage() {
  await requireAdmin("/admin/source-watch/sources/new");
  const { counties } = await getLookups();
  return (
    <>
      <PageHeader
        title="Add a watched source"
        description="Add a trusted public page or directory that staff will review for new resources."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Source Watch", href: "/admin/source-watch?tab=sources" }, { label: "Add source" }]}
      />
      <Panel className="max-w-2xl">
        <SourceForm counties={counties.map((c) => ({ value: String(c.id), label: `${c.name} County` }))} />
      </Panel>
    </>
  );
}
