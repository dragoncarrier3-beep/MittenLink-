import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Server-rendered section navigation that looks like tabs but uses real links
 * (works without JavaScript, bookmarkable, announced with aria-current).
 */
export function LinkTabs({ label, items }: { label: string; items: { href: string; label: string; count?: number; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="mb-6 border-b">
      <ul className="-mb-px flex flex-wrap gap-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-t-lg border-b-2 px-4 font-semibold",
                t.current ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-sm text-foreground">
                  {t.count}
                  <span className="sr-only"> items</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pill-style filter links (e.g. status filters with counts). */
export function FilterLinks({ label, items }: { label: string; items: { href: string; label: string; count?: number; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="mb-4">
      <ul className="flex flex-wrap gap-2">
        {items.map((f) => (
          <li key={f.href}>
            <Link
              href={f.href}
              aria-current={f.current ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                f.current ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {f.label}
              {typeof f.count === "number" && <span>({f.count})</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
