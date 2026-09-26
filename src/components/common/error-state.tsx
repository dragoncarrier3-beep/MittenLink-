"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Friendly error panel with retry. Never shows raw technical details. */
export function ErrorState({
  title = "Something went wrong",
  message = "We're having trouble loading this right now. Please try again.",
  onRetry,
  retryLabel = "Try again",
  className,
  autoFocus = true,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn("flex flex-col items-center rounded-xl border border-danger/30 bg-danger-soft px-6 py-10 text-center outline-none", className)}
    >
      <AlertCircle className="mb-3 size-10 text-danger" aria-hidden />
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-prose text-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-5" variant="outline">
          <RotateCcw aria-hidden /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
