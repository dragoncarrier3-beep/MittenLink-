import type { Metadata } from "next";
import Link from "next/link";
import { Building2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ResultCard } from "@/components/listings/result-card";
import { getFilterReference, listOrganizations } from "@/lib/data/listings";
import { getSavedState } from "@/lib/data/saved";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Providers",
  description: "Browse disability service providers across Michigan, alphabetically or by region, county, and category.",
};

const PAGE_SIZE = 12;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const countyRaw = Number(one(sp.county));
  const county = Number.isInteger(countyRaw) && countyRaw > 0 ? countyRaw : null;
  const region = one(sp.region).slice(0, 60) || null;
  const category = /^[a-z0-9-]{1,60}$/.test(one(sp.category)) ? one(sp.category) : null;
  const letter = /^[A-Za-z]$/.test(one(sp.letter)) ? one(sp.letter).toUpperCase() : null;

  let ref: Awaited<ReturnType<typeof getFilterReference>>;
  let result: Awaited<ReturnType<typeof listOrganizations>>;
  try {
    ref = await getFilterReference();
    result = await listOrganizations({ page, pageSize: PAGE_SIZE, county, region, category, letter });
  } catch (err) {
    console.error("[providers] failed", err);
    return (
      <div className="container-page py-8">
        <PageHeader title="Providers" />
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
          <p className="font-semibold">We’re having trouble loading resources right now. Please try again.</p>
          <a href="/providers" className={buttonVariants({ variant: "outline" })}>
            <RefreshCw aria-hidden /> Try again
          </a>
        </div>
      </div>
    );
  }
  const saved = await getSavedState(result.cards.map((c) => c.id));
  const regions = [...new Set(ref.counties.map((c) => c.region))].sort();
  const qs = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const merged = { county, region, category, letter, page: null as number | null, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== null && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return s ? `/providers?${s}` : "/providers";
  };
  const filtered = !!(county || region || category || letter);

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Providers"
        description="Organizations that serve people with disabilities, families, and caregivers across Michigan."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Providers" }]}
        actions={
          <Link href="/search?kind=organization" className={buttonVariants({ variant: "outline" })}>
            Search providers by keyword
          </Link>
        }
      />

      <form method="get" action="/providers" className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        {letter && <input type="hidden" name="letter" value={letter} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-region" className="font-semibold">
            Region
          </label>
          <select id="f-region" name="region" defaultValue={region ?? ""} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-county" className="font-semibold">
            County
          </label>
          <select id="f-county" name="county" defaultValue={county ? String(county) : ""} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">All counties</option>
            {ref.counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} County
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-category" className="font-semibold">
            Category
          </label>
          <select id="f-category" name="category" defaultValue={category ?? ""} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">All categories</option>
            {ref.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={cn(buttonVariants(), "flex-1")}>
            Apply filters
          </button>
          {filtered && (
            <Link href="/providers" className={buttonVariants({ variant: "outline" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      <nav aria-label="Filter by first letter" className="mb-6">
        <ul className="flex flex-wrap gap-1">
          <li>
            <Link href={qs({ letter: null })} aria-current={!letter ? "page" : undefined} className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 font-semibold", !letter ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
              All
            </Link>
          </li>
          {LETTERS.map((l) => (
            <li key={l}>
              <Link
                href={qs({ letter: l })}
                aria-current={letter === l ? "page" : undefined}
                className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border font-semibold", letter === l ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
              >
                <span className="sr-only">Providers starting with </span>
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p role="status" className="mb-4 text-lg font-semibold">
        {pluralize(result.total, "provider")}
        {filtered ? (result.total === 1 ? " matches your filters" : " match your filters") : " listed"}
      </p>

      {result.cards.length === 0 ? (
        <EmptyState icon={Building2} title="No providers match these filters" description="Try another region, county, or letter, or search all resources.">
          <Link href="/providers" className={buttonVariants({ variant: "outline" })}>
            Clear filters
          </Link>
          <Link href="/search" className={buttonVariants()}>
            Search all resources
          </Link>
        </EmptyState>
      ) : (
        <>
          <h2 className="sr-only">Provider list</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {result.cards.map((c) => (
              <li key={c.id} className="flex">
                <div className="flex w-full">
                  <ResultCard item={c} saved={saved.savedIds.includes(c.id)} signedIn={saved.signedIn} nextPath={qs({ page })} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} hrefFor={(p) => qs({ page: p })} label="Provider pages" />
        </>
      )}
    </div>
  );
}
