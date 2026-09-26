import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
  className,
  headingLevel = 2,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href: string };
  children?: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-10 text-center", className)}>
      <Icon className="mb-3 size-10 text-primary" aria-hidden />
      <H className="text-xl font-bold">{title}</H>
      {description && <div className="mt-2 max-w-prose text-muted-foreground">{description}</div>}
      {action && (
        <Link href={action.href} className={cn(buttonVariants(), "mt-5")}>
          {action.label}
        </Link>
      )}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-3 py-12 text-muted-foreground", className)}>
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonCards({ count = 3, label = "Loading results" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}
