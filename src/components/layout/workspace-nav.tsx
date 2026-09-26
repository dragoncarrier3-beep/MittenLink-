"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  count?: number;
  /** Exact match only (for dashboard/index links). */
  exact?: boolean;
}

export function WorkspaceNav({ label, items }: { label: string; items: WorkspaceNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: WorkspaceNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
  const current = items.find(isActive);

  const list = (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 font-semibold text-foreground hover:bg-muted",
                active && "bg-secondary text-secondary-foreground",
              )}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="rounded-full bg-primary px-2 text-sm leading-6 text-primary-foreground">
                  {item.count}
                  <span className="sr-only"> items</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label={label}>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="workspace-nav-list"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between rounded-lg border bg-card px-3 font-semibold"
        >
          <span>
            <span className="sr-only">{label} menu: </span>
            {current?.label ?? "Menu"}
          </span>
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div id="workspace-nav-list" className="mt-2 rounded-lg border bg-card p-2">
            {list}
          </div>
        )}
      </div>
      <div className="hidden lg:block">{list}</div>
    </nav>
  );
}
