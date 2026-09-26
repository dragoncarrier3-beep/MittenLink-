import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Visually hide the header label on desktop (still read by screen readers). */
  srOnlyHeader?: boolean;
  className?: string;
  /** Mark one column as the row title used in the mobile card heading. */
  primary?: boolean;
}

/**
 * Responsive data table: a real <table> with caption and scoped headers on
 * medium screens and up, and a stacked card list on small screens — no
 * horizontal scrolling mazes on phones.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  captionHidden = true,
  className,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  captionHidden?: boolean;
  className?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  return (
    <div className={className}>
      {/* Desktop / tablet */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full border-collapse text-left">
          <caption className={cn(captionHidden ? "sr-only" : "p-4 text-left font-semibold")}>{caption}</caption>
          <thead className="bg-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 text-sm font-bold text-foreground", c.className)}>
                  {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t align-top hover:bg-muted/40">
                {columns.map((c) =>
                  c === primary ? (
                    <th key={c.key} scope="row" className={cn("px-4 py-3 text-left font-semibold", c.className)}>
                      {c.cell(row)}
                    </th>
                  ) : (
                    <td key={c.key} className={cn("px-4 py-3", c.className)}>
                      {c.cell(row)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border bg-card p-4">
            <div className="mb-2 font-semibold">{primary.cell(row)}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="font-semibold text-muted-foreground">{c.header}</dt>
                  <dd className="min-w-0">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
