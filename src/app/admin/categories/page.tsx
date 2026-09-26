import type { Metadata } from "next";
import Link from "next/link";
import { Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { StatusPill } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { AdminActionForm } from "@/components/admin/action-form";
import { CategoryForm, SynonymForm } from "@/components/admin/category-forms";
import { SuccessBanner } from "@/components/admin/record-parts";
import { sp, type SearchParams } from "@/components/admin/admin-labels";
import { listCategories, listSynonyms } from "@/lib/data/admin-records";
import { deleteCategoryAction, deleteSynonymAction, saveCategoryAction, saveSynonymAction, setCategoryActiveAction } from "./actions";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/categories");
  const params = await searchParams;
  const saved = sp(params.saved);
  const savedName = sp(params.name) ?? "";
  const notices: Record<string, string> = {
    updated: "Category saved. The change is recorded in the audit log.",
    deleted: `Category "${savedName}" was deleted.`,
    "synonym-removed": `Synonyms for "${savedName}" were removed.`,
  };
  const [categories, synonyms] = await Promise.all([listCategories(), listSynonyms()]);
  const parents = categories.map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Categories" }]}
        title="Categories & search synonyms"
        description="Categories organize the directory and power search filters. Synonyms help families find resources using everyday words."
      />
      <SuccessBanner message={saved ? notices[saved] : undefined} />

      <Section id="categories" title="Categories" description="Categories used by records can't be deleted — deactivate them instead to hide them from public filters.">
        <DataTable
          caption="Categories"
          rows={categories}
          rowKey={(r) => String(r.id)}
          empty={<EmptyState icon={Tags} title="No categories yet" description="Create the first category below." />}
          columns={[
            {
              key: "name",
              header: "Name",
              primary: true,
              cell: (r) => (
                <span className="flex flex-col">
                  <Link href={`/admin/categories/${r.id}`} className="text-primary underline">
                    {r.name}
                  </Link>
                  <span className="text-sm font-normal text-muted-foreground">/{r.slug}</span>
                </span>
              ),
            },
            { key: "parent", header: "Parent", cell: (r) => r.parent_name ?? <span className="text-muted-foreground">—</span> },
            { key: "description", header: "Description", className: "max-w-xs", cell: (r) => r.description ?? <span className="text-muted-foreground">—</span> },
            { key: "featured", header: "Homepage", cell: (r) => (r.is_featured ? "Featured" : "—") },
            { key: "status", header: "Status", cell: (r) => <StatusPill tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</StatusPill> },
            { key: "sort", header: "Sort order", cell: (r) => r.sort_order },
            { key: "count", header: "Records", cell: (r) => r.listing_count.toLocaleString("en-US") },
            {
              key: "actions",
              header: "Actions",
              srOnlyHeader: true,
              cell: (r) => (
                <div className="flex flex-col gap-2">
                  <Link href={`/admin/categories/${r.id}`} className="inline-flex min-h-9 items-center font-semibold text-primary underline">
                    Edit<span className="sr-only"> {r.name}</span>
                  </Link>
                  <AdminActionForm
                    action={setCategoryActiveAction}
                    hidden={{ id: String(r.id), active: r.is_active ? "false" : "true" }}
                    label={<>{r.is_active ? "Deactivate" : "Activate"}<span className="sr-only"> {r.name}</span></>}
                    size="sm"
                    pendingLabel="Saving…"
                    confirm={
                      r.is_active
                        ? { title: `Deactivate "${r.name}"?`, description: "It will be hidden from public filters and the homepage. Records keep the category and it can be reactivated at any time.", confirmLabel: "Deactivate" }
                        : undefined
                    }
                  />
                  {r.listing_count === 0 && (
                    <AdminActionForm
                      action={deleteCategoryAction}
                      hidden={{ id: String(r.id) }}
                      label={<>Delete<span className="sr-only"> {r.name}</span></>}
                      size="sm"
                      variant="ghost"
                      pendingLabel="Deleting…"
                      confirm={{ title: `Delete "${r.name}"?`, description: "No records use this category. Deleting it can't be undone.", confirmLabel: "Delete category", destructive: true }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
        <Panel className="mt-6">
          <h3 className="mb-3 text-lg font-bold">Add a category</h3>
          <CategoryForm action={saveCategoryAction} parents={parents} />
        </Panel>
      </Section>

      <Section id="synonyms" title="Search synonyms" className="mt-10" description="When someone searches for a term, results also match its alternatives. Use single lowercase words.">
        {synonyms.length === 0 ? (
          <EmptyState icon={Tags} title="No synonyms yet" description="Add the first synonym below." headingLevel={3} />
        ) : (
          <ul className="flex flex-col gap-3">
            {synonyms.map((s) => (
              <li key={s.term} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p>
                    <span className="font-bold">{s.term}</span>
                    <span className="text-muted-foreground"> → </span>
                    {s.alternatives.join(", ")}
                  </p>
                  <AdminActionForm
                    action={deleteSynonymAction}
                    hidden={{ term: s.term }}
                    label={<>Remove<span className="sr-only"> synonyms for {s.term}</span></>}
                    size="sm"
                    variant="ghost"
                    pendingLabel="Removing…"
                    confirm={{ title: `Remove synonyms for "${s.term}"?`, description: "Searches for this word will no longer match its alternatives.", confirmLabel: "Remove", destructive: true }}
                  />
                </div>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">
                    Edit<span className="sr-only"> synonyms for {s.term}</span>
                  </summary>
                  <div className="mt-2">
                    <SynonymForm action={saveSynonymAction} defaults={s} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <Panel className="mt-6">
          <h3 className="mb-3 text-lg font-bold">Add synonyms</h3>
          <SynonymForm action={saveSynonymAction} />
        </Panel>
      </Section>
    </>
  );
}
