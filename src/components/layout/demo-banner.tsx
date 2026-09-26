import Link from "next/link";
import { Info } from "lucide-react";

/** Non-intrusive indicator so sample data is never mistaken for live listings. */
export function DemoBanner() {
  if (process.env.DEMO_MODE === "false") return null;
  return (
    <div className="border-b border-warning/30 bg-warning-soft text-foreground">
      <p className="container-page flex min-h-9 flex-wrap items-center gap-x-2 py-1 text-sm">
        <Info className="size-4 shrink-0 text-warning" aria-hidden />
        <strong>Demonstration Data.</strong>
        <span>All organizations, people, and contact details are fictional samples.</span>
        <Link href="/about#demo" className="font-semibold underline">
          Learn more
        </Link>
      </p>
    </div>
  );
}
