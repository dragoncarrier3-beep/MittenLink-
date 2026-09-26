/**
 * Simple accessible horizontal bars. Each bar shows its value as text, and the
 * visual bar is decorative (aria-hidden). Pair with a data table when the
 * chart carries more than one measure.
 */
export function BarList({
  title,
  items,
  valueSuffix,
}: {
  title: string;
  items: { label: string; value: number; detail?: string }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-muted-foreground">No data for this period.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label={title}>
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{item.label}</span>
            <span className="text-sm text-muted-foreground">
              {item.value.toLocaleString("en-US")}
              {valueSuffix ? ` ${valueSuffix}` : ""}
              {item.detail ? ` · ${item.detail}` : ""}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted" aria-hidden>
            <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((item.value / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}
