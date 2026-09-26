import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</div>}
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          {description && <div className="mt-2 max-w-3xl text-lg text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="rounded underline hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-foreground" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-4" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
  id,
  className,
  headingLevel = 2,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn("scroll-mt-24", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && (
              <H id={headingId} className={cn("font-bold text-foreground", headingLevel === 2 ? "text-2xl" : "text-xl")}>
                {title}
              </H>
            )}
            {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className, as: As = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "article" | "aside" }) {
  return <As className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>{children}</As>;
}

/** Definition-list style key/value rows. */
export function DetailList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]", className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="font-semibold text-foreground">{item.label}</dt>
          <dd className="text-foreground sm:mb-0 [&:not(:last-child)]:mb-2">{item.value ?? <span className="text-muted-foreground">Not provided</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
