import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { ResourceForm } from "@/components/admin/resource-form";
import { getReferenceOptions, getResourceForEdit } from "@/lib/data/admin-records";
import { saveGuideAction } from "../../actions";

export const metadata: Metadata = { title: "Edit guide" };

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/resources/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [guide, ref] = await Promise.all([getResourceForEdit(id), getReferenceOptions()]);
  if (!guide) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Guides & Resources", href: "/admin/resources" },
          { label: guide.title, href: `/admin/resources/${id}` },
          { label: "Edit" },
        ]}
        title={`Edit: ${guide.title}`}
        description="Changes are published immediately and recorded in the audit log."
      />
      <ResourceForm
        action={saveGuideAction}
        categories={ref.categories}
        populations={ref.populations}
        defaults={{
          id: guide.id,
          title: guide.title,
          summary: guide.summary,
          resourceType: guide.resource_type,
          url: guide.url,
          sourceName: guide.source_name,
          sourceUrl: guide.source_url,
          body: guide.body,
          readingMinutes: guide.reading_minutes,
          statewide: guide.statewide,
          categoryIds: guide.categoryIds,
          populationIds: guide.populationIds,
          verificationStatus: guide.verification_status,
        }}
      />
    </>
  );
}
