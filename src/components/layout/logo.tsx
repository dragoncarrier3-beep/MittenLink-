import Link from "next/link";

/** MittenLink wordmark with a simple mitten + map-pin mark (original artwork). */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 rounded-lg font-bold text-foreground no-underline ${className ?? ""}`} aria-label="MittenLink home">
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden focusable="false">
        <rect width="40" height="40" rx="10" fill="#0b5780" />
        <path
          d="M13.5 9.5c0-2.2 1.8-4 4-4s4 1.8 4 4v5.2l.3-.6c.9-1.8 3-2.5 4.8-1.6 1.8.9 2.5 3.1 1.6 4.9l-3.1 6.1V30a4 4 0 0 1-4 4h-3.6a4 4 0 0 1-4-4z"
          fill="#f3ead7"
        />
        <circle cx="20" cy="21" r="3.1" fill="#1f5f4a" />
        <circle cx="20" cy="21" r="1.2" fill="#f3ead7" />
      </svg>
      <span className="text-xl leading-none tracking-tight">
        Mitten<span className="text-primary">Link</span>
      </span>
    </Link>
  );
}
