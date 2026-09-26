import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, Search, UserCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { firstParam, type SearchParams } from "@/components/community/server";

export const metadata: Metadata = {
  title: "Claim a Provider",
  description: "Find your organization on MittenLink and request access to manage its listing.",
};

interface OrgResult {
  id: string;
  slug: string;
  title: string;
  primary_city: string | null;
  county: string | null;
  verification_status: string;
  claimed: boolean;
}

async function searchOrganizations(q: string): Promise<OrgResult[]> {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_\\]/g, ""))
    .filter(Boolean)
    .slice(0, 8);
  if (!words.length) return [];
  return asPublic((sql) =>
    sql.query<OrgResult>(
      `select l.id, l.slug, l.title, l.primary_city, c.name as county, l.verification_status, (o.claimed_at is not null) as claimed
       from public.listings l
       join public.organizations o on o.id = l.id
       left join public.counties c on c.id = l.primary_county_id
       where l.kind = 'organization' and l.publication_status = 'published'
         and (lower(l.title) like all($1::text[]) or extensions.similarity(lower(l.title), $2) > 0.3)
       order by (lower(l.title) = $2) desc, (lower(l.title) like $3) desc, extensions.similarity(lower(l.title), $2) desc, l.title
       limit 25`,
      [words.map((w) => `%${w}%`), q.toLowerCase(), `${q.toLowerCase().replace(/[%_\\]/g, "")}%`],
    ),
  );
}

const STEPS = [
  { icon: Search, title: "Find your organization", text: "Search by name below. If it isn't listed yet, you can submit it." },
  { icon: UserCheck, title: "Tell us about your role", text: "Sign in, then share your title and how we can confirm you work there." },
  { icon: CheckCircle2, title: "MittenLink reviews your claim", text: "An administrator confirms your role, usually within a few business days." },
];

export default async function ClaimSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstParam(params.q).slice(0, 120);
  const [user, results] = await Promise.all([getCurrentUser(), q ? searchOrganizations(q) : Promise.resolve([])]);
  const managed = new Set(user?.organizations.map((o) => o.id) ?? []);

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Claim your organization's listing"
        description="Claiming a listing lets your team keep MittenLink information accurate. Claiming is free, and every change is reviewed before it's published."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Claim a provider" }]}
      />

      <ol className="mb-8 grid gap-4 md:grid-cols-3" aria-label="How claiming works">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Panel className="h-full">
              <p className="flex items-center gap-2 font-bold">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </span>
              </p>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </Panel>
          </li>
        ))}
      </ol>

      <section aria-labelledby="claim-search-heading" className="max-w-3xl">
        <h2 id="claim-search-heading" className="text-2xl font-bold">
          Find your organization
        </h2>
        <form action="/claim" method="get" role="search" className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="claim-q" className="font-semibold">
              Organization name
            </label>
            <input
              id="claim-q"
              name="q"
              type="search"
              defaultValue={q}
              autoComplete="organization"
              className="min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base"
              placeholder="For example: Great Lakes Independent Living"
            />
          </div>
          <button type="submit" className={cn(buttonVariants({ size: "lg" }))}>
            <Search aria-hidden /> Search
          </button>
        </form>

        <div className="mt-6" aria-live="polite">
          {q && results.length > 0 && (
            <>
              <p className="mb-3 text-muted-foreground" role="status">
                {results.length === 1 ? "1 organization" : `${results.length} organizations`} found for “{q}”.
              </p>
              <ul className="flex flex-col gap-3">
                {results.map((org) => {
                  const isMine = managed.has(org.id);
                  return (
                    <li key={org.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold">
                          <Link href={`/providers/${org.slug}`} className="underline-offset-4 hover:underline">
                            {org.title}
                          </Link>
                        </h3>
                        <p className="text-muted-foreground">
                          {[org.primary_city, org.county ? `${org.county} County` : null].filter(Boolean).join(" · ") || "Michigan"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <VerificationBadge status={org.verification_status} />
                          {isMine ? (
                            <StatusPill tone="success">You manage this listing</StatusPill>
                          ) : org.claimed ? (
                            <StatusPill tone="info">Already managed</StatusPill>
                          ) : (
                            <StatusPill tone="neutral">Not yet claimed</StatusPill>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isMine ? (
                          <Link href="/provider" className={buttonVariants({ variant: "outline" })}>
                            Go to Provider Dashboard
                          </Link>
                        ) : org.claimed ? (
                          <div className="flex flex-col gap-1 sm:items-end">
                            <Link href={`/providers/${org.slug}/claim`} className={buttonVariants({ variant: "outline" })}>
                              Request access<span className="sr-only"> to {org.title}</span>
                            </Link>
                            <span className="text-sm text-muted-foreground">Already managed by a verified team member.</span>
                          </div>
                        ) : (
                          <Link href={`/providers/${org.slug}/claim`} className={buttonVariants()}>
                            Claim this provider<span className="sr-only">: {org.title}</span>
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {q && results.length === 0 && (
            <EmptyState
              icon={Building2}
              title="No matching organizations"
              description={
                <>
                  We couldn&apos;t find an organization named “{q}”. Check the spelling or try a shorter name. If your organization isn&apos;t on
                  MittenLink yet, you can submit it for review.
                </>
              }
              action={{ label: "List Your Organization", href: "/list-your-organization" }}
            />
          )}
          {!q && (
            <p className="text-muted-foreground">
              Don&apos;t see your organization on MittenLink?{" "}
              <Link href="/list-your-organization" className="font-semibold text-primary underline">
                List your organization
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
