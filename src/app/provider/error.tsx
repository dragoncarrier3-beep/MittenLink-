"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/error-state";

export default function ProviderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[provider] page error", error.digest ?? "");
  }, [error]);
  return (
    <ErrorState
      title="We couldn't load this page"
      message="Something went wrong while loading your provider dashboard. Your listing and any submitted updates are safe. Please try again."
      onRetry={reset}
    />
  );
}
