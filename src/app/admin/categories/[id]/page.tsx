import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/common/page";
import { CategoryForm } from "@/components/admin/category-forms";
import { listCategories } from "@/lib/data/admin-records";
import { saveCategoryAction } from "../actions";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/categories/${id}`);
  const categories = await listCategories();
  const category = categories.find((c) => String(c.id) === id);
  if (!category) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Categories", href: "/admin/categories" }, { label: category.name }]}
        title={`Edit category: ${category.name}`}
        description={`Used by ${category.listing_count.toLocaleString("en-US")} record${category.listing_count === 1 ? "" : "s"}.`}
      />
      <Panel className="max-w-2xl">
        <CategoryForm
          action={saveCategoryAction}
          parents={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          defaults={{
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            parentId: category.parent_id,
            sortOrder: category.sort_order,
            isFeatured: category.is_featured,
            isActive: category.is_active,
          }}
        />
      </Panel>
    </>
  );
}
