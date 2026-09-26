import Link from "next/link";
import { cn } from "@/lib/utils";

export interface FilterItem {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

/**
 * Segmented filter links (real links, work without JavaScript). The current
 * filter is marked with aria-current and a visible check-style underline, so
 * state is never conveyed by color alone.
 */
export function FilterNav({ label, items, className }: { label: string; items: FilterItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("mb-5", className)}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-semibold hover:bg-muted",
                item.active ? "border-primary bg-secondary text-secondary-foreground underline decoration-2 underline-offset-4" : "bg-card text-foreground",
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span className={cn("rounded-full px-2 py-0.5 text-sm", item.active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {item.count}
                  <span className="sr-only"> {item.count === 1 ? "item" : "items"}</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Build a URL for the current path with some search params replaced (null removes). */
export function withParams(path: string, current: Record<string, string | undefined>, changes: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) params.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "") params.delete(k);
    else params.set(k, v);
  }
  // Result parameters never carry over to another view.
  params.delete("done");
  params.delete("warn");
  params.delete("n");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
