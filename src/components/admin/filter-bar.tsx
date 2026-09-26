import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  /** Label for the "no filter" option. */
  allLabel?: string;
}

/**
 * GET-based search + filter bar for admin lists. Works without JavaScript and
 * keeps the URL shareable. Changing any filter resets to page 1.
 */
export function FilterBar({
  action,
  q,
  searchLabel = "Search by name",
  filters = [],
  extra,
  dateRange,
  hideSearch = false,
}: {
  action: string;
  q?: string;
  searchLabel?: string;
  filters?: FilterDef[];
  extra?: React.ReactNode;
  dateRange?: { from?: string; to?: string };
  hideSearch?: boolean;
}) {
  const active = !!q || filters.some((f) => !!f.value) || !!dateRange?.from || !!dateRange?.to;
  const inputClass = "min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground";
  return (
    <form method="get" action={action} role="search" aria-label="Filter records" className="mb-5 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!hideSearch && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="filter-q" className="text-sm font-semibold">
              {searchLabel}
            </label>
            <input id="filter-q" name="q" type="search" defaultValue={q ?? ""} className={inputClass} />
          </div>
        )}
        {filters.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={`filter-${f.name}`} className="text-sm font-semibold">
              {f.label}
            </label>
            <select id={`filter-${f.name}`} name={f.name} defaultValue={f.value ?? ""} className={inputClass}>
              <option value="">{f.allLabel ?? "All"}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {dateRange && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-from" className="text-sm font-semibold">
                From date
              </label>
              <input id="filter-from" name="from" type="date" defaultValue={dateRange.from ?? ""} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-to" className="text-sm font-semibold">
                To date
              </label>
              <input id="filter-to" name="to" type="date" defaultValue={dateRange.to ?? ""} className={inputClass} />
            </div>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" className={buttonVariants()}>
          <Search aria-hidden /> Apply filters
        </button>
        {active && (
          <Link href={action} className={cn(buttonVariants({ variant: "outline" }))}>
            Clear filters
          </Link>
        )}
        {extra}
      </div>
    </form>
  );
}

/** "Showing 1–25 of 132 organizations" summary, announced politely. */
export function ResultSummary({ total, page, pageSize, noun }: { total: number; page: number; pageSize: number; noun: string }) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <p role="status" className="mb-3 text-sm text-muted-foreground">
      {total === 0 ? `No ${noun} match these filters.` : `Showing ${start.toLocaleString("en-US")}–${end.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${noun}`}
    </p>
  );
}
