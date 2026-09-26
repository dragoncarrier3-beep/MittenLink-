import type { Metadata } from "next";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { SubmitButton } from "@/components/forms/fields";
import { firstParam, type SearchParams } from "@/components/community/server";
import { describeSavedSearch, savedSearchHref, type SavedSearchParams } from "@/components/community/saved-search";
import { deleteSavedSearchAction } from "../actions";

export const metadata: Metadata = { title: "Saved Searches" };

export default async function SavedSearchesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/account/searches");
  const params = await searchParams;
  const rows = await asCurrentUser((sql) =>
    sql.query<{ id: string; name: string; params: SavedSearchParams | null; created_at: Date }>(
      "select id, name, params, created_at from public.saved_searches where user_id = auth.uid() order by created_at desc",
    ),
  );

  return (
    <>
      <PageHeader title="Saved searches" description="Run a saved search again to see the latest matching resources." />
      {firstParam(params.deleted) === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-success/40 bg-success-soft p-3 font-semibold text-success">
          The saved search was deleted.
        </p>
      )}
      {firstParam(params.error) === "1" && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft p-3 font-semibold text-danger">
          We couldn&apos;t delete that search. Please try again.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No saved searches"
          description="When you search for resources, choose “Save this search” to come back to it later."
          action={{ label: "Find Resources", href: "/search" }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{s.name}</h2>
                <p className="text-muted-foreground">{describeSavedSearch(s.params)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Saved {formatDate(s.created_at)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={savedSearchHref(s.params)} className={buttonVariants()}>
                  <Search aria-hidden /> Run search<span className="sr-only">: {s.name}</span>
                </Link>
                <form action={deleteSavedSearchAction}>
                  <input type="hidden" name="searchId" value={s.id} />
                  <SubmitButton variant="outline" pendingLabel="Deleting…">
                    <Trash2 aria-hidden /> Delete<span className="sr-only"> saved search {s.name}</span>
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
