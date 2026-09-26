import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ResultCard } from "@/components/listings/result-card";
import { getFilterReference, listPrograms } from "@/lib/data/listings";
import { getSavedState } from "@/lib/data/saved";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Programs",
  description: "Browse disability programs across Michigan — peer mentoring, youth transition, home modification grants, and more.",
};

const PAGE_SIZE = 12;

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const catRaw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = catRaw && /^[a-z0-9-]{1,60}$/.test(catRaw) ? catRaw : null;
  let ref: Awaited<ReturnType<typeof getFilterReference>>;
  let result: Awaited<ReturnType<typeof listPrograms>>;
  try {
    ref = await getFilterReference();
    result = await listPrograms({ page, pageSize: PAGE_SIZE, category });
  } catch (err) {
    console.error("[programs] failed", err);
    return (
      <div className="container-page py-8">
        <PageHeader title="Programs" />
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
          <p className="font-semibold">We’re having trouble loading resources right now. Please try again.</p>
          <a href="/programs" className={buttonVariants({ variant: "outline" })}>
            <RefreshCw aria-hidden /> Try again
          </a>
        </div>
      </div>
    );
  }
  const saved = await getSavedState(result.cards.map((c) => c.id));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/programs?${s}` : "/programs";
  };

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Programs"
        description="Structured programs with defined eligibility — from peer mentoring to home modification grants."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Programs" }]}
      />
      <form method="get" action="/programs" className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="p-category" className="font-semibold">
            Category
          </label>
          <select id="p-category" name="category" defaultValue={category ?? ""} className="min-h-11 rounded-lg border border-input bg-card px-3 text-base">
            <option value="">All categories</option>
            {ref.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonVariants()}>
          Apply filter
        </button>
        {category && (
          <Link href="/programs" className={buttonVariants({ variant: "outline" })}>
            Clear
          </Link>
        )}
      </form>
      <p role="status" className="mb-4 text-lg font-semibold">
        {pluralize(result.total, "program")} {category ? "in this category" : "available"}
      </p>
      {result.cards.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No programs in this category yet" description="Try another category or search all resources.">
          <Link href="/programs" className={buttonVariants({ variant: "outline" })}>
            Show all programs
          </Link>
          <Link href="/suggest?type=resource" className={buttonVariants()}>
            Suggest a program
          </Link>
        </EmptyState>
      ) : (
        <>
          <h2 className="sr-only">Program list</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {result.cards.map((c) => (
              <li key={c.id} className="flex">
                <ResultCard item={c} saved={saved.savedIds.includes(c.id)} signedIn={saved.signedIn} nextPath={href(page)} />
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} hrefFor={href} label="Program pages" />
        </>
      )}
    </div>
  );
}
