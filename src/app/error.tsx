"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/error-state";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-12">
      <ErrorState
        title="We're having trouble loading this page"
        message="Please try again. If the problem continues, try again in a few minutes — your saved information is safe."
        onRetry={reset}
      />
    </div>
  );
}
