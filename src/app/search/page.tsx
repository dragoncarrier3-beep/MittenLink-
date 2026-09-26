import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page";
import { SearchExperience } from "@/components/search/search-experience";
import { getFilterReference } from "@/lib/data/listings";
import { ORG_TYPE_LABELS } from "@/lib/labels";
import { FILTER_POPULATIONS, hasCriteria, parseSearchParams } from "@/lib/search/params";
import { runSearch } from "@/lib/search/service";
import type { FilterOptions, SearchResponse } from "@/lib/search/types";
import { ErrorState } from "@/components/common/error-state";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = parseSearchParams(await searchParams);
  const bits = [p.q ? `“${p.q}”` : null, p.location ? `near ${p.location}` : null].filter(Boolean).join(" ");
  return {
    title: bits ? `Search results for ${bits}` : "Find disability resources",
    description: "Search Michigan disability providers, services, programs, events, and plain-language guides in one place.",
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = parseSearchParams(await searchParams);

  let options: FilterOptions;
  try {
    const ref = await getFilterReference();
    options = {
      categories: ref.categories,
      populations: ref.populations.filter((p) => (FILTER_POPULATIONS as readonly string[]).includes(p.slug)),
      languages: ref.languages,
      orgTypes: Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    };
  } catch (err) {
    console.error("[search] reference data failed", err);
    return (
      <div className="container-page py-8">
        <PageHeader title="Find disability resources" />
        <ErrorState title="Resources unavailable" message="We're having trouble loading resources right now. Please try again." autoFocus={false} />
      </div>
    );
  }

  let data: SearchResponse | null = null;
  let error: string | null = null;
  try {
    // A page load with search criteria is an explicit (committed) search.
    data = await runSearch(params, { commit: params.page === 1 && hasCriteria(params), trigger: "load" });
  } catch (err) {
    console.error("[search] SSR search failed", err);
    error = "We couldn't complete your search. Your filters have been preserved.";
  }

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Find disability resources"
        description="Search providers, services, programs, events, and guides across Michigan. Statewide and virtual resources are always included."
      />
      <SearchExperience initialParams={params} initialData={data} initialError={error} options={options} />
    </div>
  );
}
