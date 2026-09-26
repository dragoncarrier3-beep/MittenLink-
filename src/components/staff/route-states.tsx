"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/error-state";

/** Error boundary content for staff routes (renders inside the workspace shell). */
export function StaffRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      title="We couldn't load this page"
      message="Please try again. Nothing you saved has been lost. If the problem continues, wait a few minutes and try again."
      onRetry={reset}
    />
  );
}
