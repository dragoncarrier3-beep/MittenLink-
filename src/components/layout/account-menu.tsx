"use client";

import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";

/** Disclosure-pattern account menu (button + list of links). */
export function AccountMenu({ name, email, links }: { name: string; email: string; links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 font-semibold hover:bg-muted"
      >
        <UserRound className="size-5" aria-hidden />
        <span className="max-w-40 truncate">{name}</span>
        <ChevronDown className="size-4" aria-hidden />
        <span className="sr-only">account menu</span>
      </button>
      {open && (
        <div id="account-menu" className="absolute right-0 mt-2 w-72 rounded-xl border bg-popover p-2 shadow-lg">
          <p className="px-3 py-2 text-sm text-muted-foreground">
            Signed in as <span className="block truncate font-semibold text-foreground">{email}</span>
          </p>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-muted">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/notifications" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-muted">
                Notifications
              </Link>
            </li>
            <li className="mt-1 border-t pt-1">
              <form action={signOutAction}>
                <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold hover:bg-muted">
                  Sign Out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
