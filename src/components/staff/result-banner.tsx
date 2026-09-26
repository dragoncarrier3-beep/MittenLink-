"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Success banner shown after a staff action redirects back with `?done=…`.
 * Rendered on the server (visible without JavaScript) inside a polite status
 * region; on arrival it receives focus so screen readers announce it right
 * away. "Dismiss" removes the result parameters from the URL.
 */
export function ResultBanner({ message, warning, params = ["done", "warn", "n"] }: { message: string | null; warning?: string | null; params?: string[] }) {
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setHidden(false);
    if (message) ref.current?.focus();
  }, [message, warning]);

  const dismiss = () => {
    const url = new URL(window.location.href);
    for (const p of params) url.searchParams.delete(p);
    const qs = url.searchParams.toString();
    setHidden(true);
    router.replace(qs ? `${url.pathname}?${qs}` : url.pathname, { scroll: false });
  };

  const visible = !!message && !hidden;
  return (
    <div role="status" aria-live="polite" className={visible ? "mb-6" : "sr-only"}>
      {visible && (
        <div ref={ref} tabIndex={-1} className="flex items-start justify-between gap-3 rounded-lg border border-success/40 bg-success-soft p-4 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <div>
            <p className="flex items-start gap-2 font-semibold text-success">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              {message}
            </p>
            {warning && <p className="mt-1 ml-7 text-sm font-semibold text-warning">{warning}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            <X aria-hidden /> Dismiss<span className="sr-only"> message</span>
          </Button>
        </div>
      )}
    </div>
  );
}

