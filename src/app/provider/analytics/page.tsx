import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bookmark, Eye, Lock, MousePointerClick } from "lucide-react";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { buttonVariants } from "@/components/ui/button";
import { getListingAnalytics, getOrganization, loadProviderContext } from "@/lib/data/provider";
import { formatDate, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Listing Analytics" };

const SOURCE_LABELS: Record<string, string> = {
  search: "MittenLink search",
  direct: "Direct link or bookmark",
  category: "Category browsing",
  map: "Map",
  saved: "Saved resources",
  other: "Other",
};

function Stat({ icon: Icon, label, value, note }: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; value: string; note?: string }) {
  return (
    <Panel className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="text-3xl font-bold">{value}</p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Panel>
  );
}

const range = (a: Date, b: Date) => `${formatDate(a, { month: "short", day: "numeric" })} – ${formatDate(b, { month: "short", day: "numeric" })}`;

export default async function AnalyticsPage() {
  const ctx = await loadProviderContext("/provider/analytics");
  const [org, data] = await Promise.all([getOrganization(ctx.org.id), getListingAnalytics(ctx.org.id)]);
  const enhanced = org?.listing_tier === "enhanced";
  const change = data.viewsPrev30 > 0 ? Math.round(((data.views30 - data.viewsPrev30) / data.viewsPrev30) * 100) : null;

  if (!enhanced) {
    return (
      <>
        <PageHeader title="Listing Analytics" description="See how families find your listing on MittenLink." />
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat icon={Eye} label="Profile views (last 30 days)" value={data.views30.toLocaleString("en-US")} />
          </div>
          <Panel className="flex flex-col gap-3 border-enhanced/40 bg-enhanced-soft/40">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Lock className="size-5" aria-hidden /> Detailed analytics come with MittenLink Enhanced
            </h2>
            <p>
              Enhanced listings can see weekly profile views, how people found the listing, service page views, and how many families saved it. Your free listing
              stays fully searchable and fully verified either way.
            </p>
            <div>
              <Link href="/provider/plan" className={buttonVariants()}>
                Compare listing plans
              </Link>
            </div>
          </Panel>
        </div>
      </>
    );
  }

  const max = Math.max(1, ...data.buckets.map((b) => b.views));
  const sourceTotal = data.sources.reduce((n, s) => n + s.views, 0) || 1;

  return (
    <>
      <PageHeader
        title="Listing Analytics"
        description="Privacy-conscious counts for your Enhanced Listing. MittenLink never records who viewed your listing — only how many times and how it was found."
      />
      <div className="flex flex-col gap-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={Eye}
            label="Profile views (last 30 days)"
            value={data.views30.toLocaleString("en-US")}
            note={change === null ? "No data for the previous 30 days" : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% from the previous 30 days`}
          />
          <Stat icon={MousePointerClick} label="Service page views (30 days)" value={data.serviceViews30.toLocaleString("en-US")} />
          <Stat icon={Bookmark} label="Saved by families" value={data.saves.toLocaleString("en-US")} note={`${pluralize(data.saves30, "new save")} in the last 30 days`} />
          <Stat icon={BarChart3} label="Traffic sources" value={String(data.sources.length)} note="Distinct ways people found you" />
        </div>

        <Section title="Profile views by week" description="Last 30 days, grouped into 7-day periods (the oldest period may be shorter).">
          <Panel>
            {data.views30 === 0 ? (
              <p className="text-muted-foreground">No profile views were recorded in the last 30 days.</p>
            ) : (
              <>
                <ul className="flex flex-col gap-3" aria-hidden>
                  {data.buckets.map((b) => (
                    <li key={b.start.toISOString()} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{range(b.start, b.end)}</span>
                      <span className="h-6 rounded bg-muted">
                        <span className="block h-6 rounded bg-primary" style={{ width: `${(b.views / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold">{b.views}</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-4">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Show as a data table</summary>
                  <table className="mt-2 w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Profile views by week, last 30 days</caption>
                    <thead className="bg-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2">
                          Period
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          Profile views
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.buckets.map((b) => (
                        <tr key={b.start.toISOString()} className="border-t">
                          <th scope="row" className="px-3 py-2 font-normal">
                            {range(b.start, b.end)}
                          </th>
                          <td className="px-3 py-2 text-right">{b.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                <p className="sr-only">
                  Weekly profile views: {data.buckets.map((b) => `${range(b.start, b.end)}: ${b.views}`).join("; ")}.
                </p>
              </>
            )}
          </Panel>
        </Section>

        <Section title="Top traffic sources" description="How people arrived at your profile in the last 30 days.">
          <Panel>
            {data.sources.length === 0 ? (
              <p className="text-muted-foreground">No traffic source data yet.</p>
            ) : (
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Top traffic sources, last 30 days</caption>
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Source
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Views
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s) => (
                    <tr key={s.source} className="border-t">
                      <th scope="row" className="px-3 py-2 font-normal">
                        {SOURCE_LABELS[s.source] ?? s.source.replace(/_/g, " ")}
                      </th>
                      <td className="px-3 py-2 text-right">{s.views}</td>
                      <td className="px-3 py-2 text-right">{Math.round((s.views / sourceTotal) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </Section>
        <p className="text-sm text-muted-foreground">
          Analytics are informational. Enhanced status never changes search ranking or verification.
        </p>
      </div>
    </>
  );
}
