import type { Metadata } from "next";
import Link from "next/link";
import { Info, SearchX, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getLookups, getSearchStats, getSupplyByRegion, listGapFlags, listSearchGaps, type GapLevel } from "@/lib/data/operations";
import { formatShortDate } from "@/lib/format";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/operations/action-button";
import { BarList, StatCard } from "@/components/operations/bars";
import { GapStatusPill, INDICATOR_LABELS, LevelPill } from "@/components/operations/status";
import { label } from "@/lib/labels";
import { dismissFailedSearchAction, flagSearchAsGapAction, setGapStatusAction } from "./actions";

export const metadata: Metadata = { title: "Search Analytics" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");
const DISCLAIMER = "These are operational indicators, not claims that no such service exists.";

export default async function SearchAnalyticsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("/admin/search-analytics");
  const sp = await searchParams;
  const lookups = await getLookups();
  const countyParam = Number(one(sp.county));
  const county = lookups.counties.some((c) => c.id === countyParam) ? countyParam : null;
  const regionParam = one(sp.region);
  const region = regionParam && lookups.regions.includes(regionParam) ? regionParam : null;
  const levelParam = one(sp.level);
  const level = levelParam === "high" || levelParam === "medium" || levelParam === "low" ? (levelParam as GapLevel) : null;
  const includeReviewed = one(sp.all) === "1";
  const showClosed = one(sp.closed) === "1";

  const [gaps, stats, flags, supply] = await Promise.all([
    listSearchGaps({ county, region, level, includeReviewed }),
    getSearchStats(30),
    listGapFlags(showClosed),
    getSupplyByRegion(),
  ]);
  const { total, zero, low } = stats.totals;
  const filtered = !!(county || region || level || includeReviewed);
  const baseParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (county) p.set("county", String(county));
    if (region) p.set("region", region);
    if (level) p.set("level", level);
    if (includeReviewed) p.set("all", "1");
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/admin/search-analytics?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Search Analytics"
        description="See what people search for but cannot find, so MittenLink staff can research and add missing resources."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Search Analytics" }]}
      />

      <Panel className="mb-6 flex gap-3 bg-info-soft">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
        <p className="text-foreground">
          <strong>Privacy:</strong> search logs contain no user identifiers — no names, accounts, email addresses, or IP addresses. Only the search words, the area searched, and the number of
          results are stored.
        </p>
      </Panel>

      <nav aria-label="On this page" className="mb-8">
        <ul className="flex flex-wrap gap-2 text-sm">
          {[
            ["#summary", "Summary"],
            ["#gaps", "Search gaps"],
            ["#indicators", "Resource-gap indicators"],
            ["#supply", "Supply by region"],
          ].map(([href, text]) => (
            <li key={href}>
              <a href={href} className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 font-semibold hover:bg-muted">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-12">
        {/* ------------------------------------------------ summary */}
        <Section id="summary" title="Last 30 days" description="All searches on the public directory.">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total searches" value={total.toLocaleString("en-US")} />
            <StatCard label="Zero-result searches" value={pct(zero, total)} detail={`${zero.toLocaleString("en-US")} searches found nothing`} />
            <StatCard label="Low-result searches" value={pct(low, total)} detail={`${low.toLocaleString("en-US")} searches found only 1–2 results`} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel as="section">
              <h3 className="mb-4 text-lg font-bold">Top unsuccessful searches</h3>
              <BarList title="Top unsuccessful searches" valueSuffix="searches" items={stats.topUnsuccessful.map((q) => ({ label: q.query, value: q.searches, detail: `${q.zero} with no results` }))} />
            </Panel>
            <Panel as="section">
              <h3 className="mb-4 text-lg font-bold">Unsuccessful searches by region</h3>
              <BarList
                title="Unsuccessful searches by region"
                valueSuffix="unsuccessful"
                items={stats.byRegion.map((r) => ({ label: r.region, value: r.unsuccessful, detail: `${pct(r.unsuccessful, r.searches)} of ${r.searches}` }))}
              />
              <details className="mt-4">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Show as a table</summary>
                <DataTable
                  caption="Searches by region, last 30 days"
                  rows={stats.byRegion}
                  rowKey={(r) => r.region}
                  columns={[
                    { key: "region", header: "Region", primary: true, cell: (r) => r.region },
                    { key: "searches", header: "Searches", cell: (r) => r.searches.toLocaleString("en-US") },
                    { key: "unsuccessful", header: "Unsuccessful", cell: (r) => r.unsuccessful.toLocaleString("en-US") },
                    { key: "rate", header: "Unsuccessful rate", cell: (r) => pct(r.unsuccessful, r.searches) },
                  ]}
                />
              </details>
            </Panel>
          </div>
        </Section>

        {/* ------------------------------------------------ search gaps */}
        <Section id="gaps" title="Search gaps" description="Repeated searches that returned few or no results. Potential gap: High = 20+ searches with no results; Medium = 8+ searches; otherwise Low.">
          <form method="get" action="/admin/search-analytics#gaps" className="mb-5 flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:flex-wrap md:items-end" aria-label="Filter search gaps">
            <FilterSelect id="f-county" name="county" label="County" value={county ? String(county) : ""} options={lookups.counties.map((c) => ({ value: String(c.id), label: `${c.name} County` }))} all="All counties" />
            <FilterSelect id="f-region" name="region" label="Region" value={region ?? ""} options={lookups.regions.map((r) => ({ value: r, label: r }))} all="All regions" />
            <FilterSelect
              id="f-level"
              name="level"
              label="Potential gap"
              value={level ?? ""}
              options={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
              all="All levels"
            />
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="all" value="1" defaultChecked={includeReviewed} className="size-5 accent-[var(--primary)]" /> Include reviewed and dismissed
            </label>
            <div className="flex gap-2">
              <button type="submit" className={buttonVariants()}>
                Apply Filters
              </button>
              {filtered && (
                <Link href="/admin/search-analytics#gaps" className={buttonVariants({ variant: "ghost" })}>
                  Clear filters
                </Link>
              )}
            </div>
          </form>
          <p role="status" className="sr-only">
            {gaps.length} search gaps shown
          </p>
          <DataTable
            caption="Search gaps: unsuccessful searches by county"
            rows={gaps}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={SearchX} title={filtered ? "No search gaps match these filters" : "No open search gaps"} description={filtered ? "Try a different county, region, or level." : "Unsuccessful searches will appear here as people use the directory."} />}
            columns={[
              { key: "q", header: "Query", primary: true, cell: (r) => <span className="capitalize">{r.normalized_query}</span> },
              { key: "county", header: "County", cell: (r) => (r.county_name ? `${r.county_name}` : "No location") },
              { key: "searches", header: "Searches", cell: (r) => r.search_count },
              { key: "results", header: "Results", cell: (r) => r.last_result_count },
              { key: "level", header: "Potential gap", cell: (r) => <LevelPill level={r.gap_level} /> },
              { key: "seen", header: "Last seen", cell: (r) => formatShortDate(r.last_seen_at) },
              {
                key: "actions",
                header: "Actions",
                cell: (r) =>
                  r.status === "open" ? (
                    <div className="flex flex-col gap-2">
                      <ActionButton action={flagSearchAsGapAction} hidden={{ id: r.id }} label="Flag as Gap" size="sm" srContext={`: ${r.normalized_query}${r.county_name ? ` in ${r.county_name} County` : ""}`} pendingLabel="Flagging…" />
                      <ActionButton action={dismissFailedSearchAction} hidden={{ id: r.id }} label="Not a Gap" size="sm" variant="ghost" srContext={`: ${r.normalized_query}`} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{r.status === "reviewed" ? "Reviewed" : "Dismissed"}</span>
                  ),
              },
            ]}
          />
        </Section>

        {/* ------------------------------------------------ indicators */}
        <Section
          id="indicators"
          title="Resource-gap indicators"
          description="Places where search demand is high and listed supply is low."
          actions={
            <Link href={showClosed ? baseParams({}) + "#indicators" : baseParams({ closed: "1" }) + "#indicators"} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {showClosed ? "Hide resolved and dismissed" : "Show resolved and dismissed"}
            </Link>
          }
        >
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-foreground">
            <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <span>{DISCLAIMER}</span>
          </p>
          {flags.length === 0 ? (
            <EmptyState title="No open gap indicators" description='Use "Flag as Gap" on a search gap above to create one.' />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {flags.map((f) => (
                <li key={f.id}>
                  <article className="flex h-full flex-col rounded-xl border bg-card p-5" aria-labelledby={`gap-${f.id}`}>
                    <div className="flex flex-wrap gap-2">
                      <LevelPill level={f.severity} prefix="Severity" />
                      <GapStatusPill status={f.status} />
                    </div>
                    <h3 id={`gap-${f.id}`} className="mt-3 text-lg font-bold">
                      <Link href={`/admin/search-analytics/gaps/${f.id}`} className="underline decoration-1 underline-offset-2 hover:text-primary">
                        {f.title}
                      </Link>
                    </h3>
                    <p className="mt-2">{f.description}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <Meta term="Type" value={label(INDICATOR_LABELS, f.indicator_type)} />
                      <Meta term="Category" value={f.category_name ?? "Any"} />
                      <Meta term="Area" value={f.county_name ? `${f.county_name} County` : (f.region ?? "Statewide")} />
                      <Meta term="Searches vs. resources" value={`${f.search_count} vs. ${f.resource_count}`} />
                      <Meta term="Assigned to" value={f.assignee_name ?? "Unassigned"} />
                      <Meta term="Research tasks" value={String(f.task_count)} />
                    </dl>
                    <div className="mt-4 flex flex-wrap items-start gap-2 border-t pt-4">
                      <Link href={`/admin/search-analytics/gaps/${f.id}#task`} className={buttonVariants({ size: "sm" })}>
                        Create Source Watch Task<span className="sr-only">: {f.title}</span>
                      </Link>
                      <Link href={`/admin/search-analytics/gaps/${f.id}#assign`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Assign Research<span className="sr-only">: {f.title}</span>
                      </Link>
                      <Link href={`/admin/search-analytics/gaps/${f.id}#notes-${f.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Add Internal Note<span className="sr-only">: {f.title}</span>
                      </Link>
                      {f.status !== "resolved" && f.status !== "dismissed" ? (
                        <>
                          <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "resolved" }} label="Resolve" size="sm" variant="ghost" srContext={f.title} />
                          <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "dismissed" }} label="Dismiss" size="sm" variant="ghost" srContext={f.title} />
                        </>
                      ) : (
                        <ActionButton action={setGapStatusAction} hidden={{ flag_id: f.id, status: "open" }} label="Reopen" size="sm" variant="ghost" srContext={f.title} />
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ------------------------------------------------ supply */}
        <Section id="supply" title="Supply by region" description="Published, verified listings in each category that have a location in, or list a county service area within, each region. Statewide lists records that serve all of Michigan.">
          <DataTable
            caption="Published verified listings by category and region"
            rows={supply.categories}
            rowKey={(c) => c}
            columns={[
              { key: "cat", header: "Category", primary: true, cell: (c) => c },
              ...[...supply.regions, "Statewide"].map((r) => ({
                key: r,
                header: r,
                cell: (c: string) => {
                  const n = supply.grid[c]?.[r] ?? 0;
                  return n === 0 ? <span className="font-semibold text-danger">0</span> : n;
                },
              })),
            ]}
          />
          <p className="mt-2 text-sm text-muted-foreground">{DISCLAIMER}</p>
        </Section>
      </div>
    </>
  );
}

function FilterSelect({ id, name, label: l, value, options, all }: { id: string; name: string; label: string; value: string; options: { value: string; label: string }[]; all: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {l}
      </label>
      <select id={id} name={name} defaultValue={value} className="min-h-11 rounded-lg border border-input bg-card px-3">
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
