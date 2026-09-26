import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { ResultCard } from "@/components/listings/result-card";
import { listGuides } from "@/lib/data/listings";
import { getSavedState } from "@/lib/data/saved";

export const metadata: Metadata = {
  title: "Plain-language guides",
  description: "Plain-language guides on benefits, rights, housing, transportation, education, and caregiving in Michigan.",
};

export default async function GuidesPage() {
  let groups: Awaited<ReturnType<typeof listGuides>>;
  try {
    groups = await listGuides();
  } catch (err) {
    console.error("[guides] failed", err);
    return (
      <div className="container-page py-8">
        <PageHeader title="Plain-language guides" />
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-5">
          <p className="font-semibold">We’re having trouble loading resources right now. Please try again.</p>
          <a href="/guides" className={buttonVariants({ variant: "outline" })}>
            <RefreshCw aria-hidden /> Try again
          </a>
        </div>
      </div>
    );
  }
  const all = groups.flatMap((g) => g.cards);
  const saved = await getSavedState(all.map((c) => c.id));
  const anchor = (name: string) => `topic-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Plain-language guides"
        description="Short, practical explanations of benefits, rights, and services. Guides are general information — always confirm details with the official source."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Guides" }]}
      />
      {all.length === 0 ? (
        <EmptyState icon={BookOpen} title="No guides are published yet" action={{ label: "Search resources", href: "/search" }} />
      ) : (
        <>
          <nav aria-label="Guide topics" className="mb-8 rounded-xl border bg-card p-4">
            <h2 className="mb-2 text-lg font-bold">Topics</h2>
            <ul className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <li key={g.name}>
                  <a href={`#${anchor(g.name)}`} className="inline-flex min-h-11 items-center rounded-lg border bg-secondary px-3 font-semibold text-secondary-foreground hover:border-primary">
                    {g.name} ({g.cards.length})
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-12">
            {groups.map((g) => (
              <section key={g.name} id={anchor(g.name)} aria-labelledby={`${anchor(g.name)}-h`} className="scroll-mt-24">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <h2 id={`${anchor(g.name)}-h`} className="text-2xl font-bold">
                    {g.name}
                  </h2>
                  {g.slug && (
                    <Link href={`/search?category=${g.slug}`} className="font-semibold text-primary underline">
                      All {g.name} resources
                    </Link>
                  )}
                </div>
                <ul className="grid gap-4 md:grid-cols-2">
                  {g.cards.map((c) => (
                    <li key={c.id} className="flex">
                      <ResultCard item={c} compact saved={saved.savedIds.includes(c.id)} signedIn={saved.signedIn} nextPath="/guides" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
