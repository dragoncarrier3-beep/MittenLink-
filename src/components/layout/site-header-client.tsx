"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, UTILITY_NAV } from "./nav-config";
import { signOutAction } from "@/app/(auth)/actions";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/")) || (href === "/search" && pathname === "/search");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-foreground hover:bg-muted",
        active && "bg-secondary text-secondary-foreground underline decoration-2 underline-offset-8",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Mobile navigation drawer: a disclosure button that opens a full-width
 * panel. Focus moves into the panel, Escape closes it and returns focus.
 */
export function MobileNav({ signedIn, workspaceLinks }: { signedIn: boolean; workspaceLinks: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-lg border bg-card hover:bg-muted"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {open && (
        <div ref={panelRef} id="mobile-nav" className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b bg-card shadow-lg">
          <nav aria-label="Main" className="container-page py-4">
            <ul className="flex flex-col gap-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-12 items-center rounded-lg px-3 text-lg font-semibold hover:bg-muted" aria-current={pathname === item.href ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <hr className="my-3" />
            <ul className="flex flex-col gap-1">
              {UTILITY_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-12 items-center rounded-lg px-3 font-semibold hover:bg-muted">
                    {item.label}
                  </Link>
                </li>
              ))}
              {workspaceLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-12 items-center rounded-lg px-3 font-semibold hover:bg-muted">
                    {item.label}
                  </Link>
                </li>
              ))}
              {signedIn ? (
                <li>
                  <form action={signOutAction}>
                    <button type="submit" className="flex min-h-12 w-full items-center rounded-lg px-3 text-left font-semibold hover:bg-muted">
                      Sign Out
                    </button>
                  </form>
                </li>
              ) : (
                <li>
                  <Link href="/sign-in" className="flex min-h-12 items-center rounded-lg px-3 font-semibold text-primary hover:bg-muted">
                    Sign In
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
