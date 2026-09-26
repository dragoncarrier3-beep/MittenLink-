import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getLookups, listSources } from "@/lib/data/operations";
import { PageHeader, Panel } from "@/components/common/page";
import { ManualCandidateForm } from "@/components/operations/source-watch-forms";

export const metadata: Metadata = { title: "Add Candidate" };

export default async function NewCandidatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/source-watch/candidates/new");
  const sp = await searchParams;
  const [lookups, sources] = await Promise.all([getLookups(), listSources()]);
  const source = typeof sp.source === "string" && sources.some((s) => s.id === sp.source) ? sp.source : undefined;
  return (
    <>
      <PageHeader
        title="Add a candidate manually"
        description="Found a possible resource while reviewing a source? Paste what you found. It will be checked for duplicates and wait for review — nothing is published."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Source Watch", href: "/admin/source-watch" }, { label: "Add candidate" }]}
      />
      <Panel className="max-w-2xl">
        <ManualCandidateForm
          defaultSourceId={source}
          sources={sources.map((s) => ({ value: s.id, label: s.name }))}
          categories={lookups.categories.map((c) => ({ value: String(c.id), label: c.name }))}
          counties={lookups.counties.map((c) => ({ value: String(c.id), label: `${c.name} County` }))}
        />
      </Panel>
    </>
  );
}
