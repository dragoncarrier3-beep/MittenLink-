import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible server-rendered pagination using real links (works without JS).
 * `hrefFor(page)` builds the URL for a page number.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label = "Pagination",
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const windowed = pageWindow(page, pages);
  const linkClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border bg-card px-3 font-semibold hover:bg-muted";
  return (
    <nav aria-label={label} className="mt-6 flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
              <ChevronLeft className="size-4" aria-hidden /> Previous<span className="sr-only"> page</span>
            </Link>
          ) : (
            <span className={cn(linkClass, "cursor-not-allowed opacity-50")} aria-disabled="true">
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </span>
          )}
        </li>
        {windowed.map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(linkClass, p === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
              >
                <span className="sr-only">Page </span>
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
              Next<span className="sr-only"> page</span> <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(linkClass, "cursor-not-allowed opacity-50")} aria-disabled="true">
              Next <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

export function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

/** Parse a ?page= search param safely. */
export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
