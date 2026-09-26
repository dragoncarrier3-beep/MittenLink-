"use client";

import { ErrorState } from "@/components/common/error-state";

export default function ServiceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-8">
      <ErrorState title="Service unavailable" message="We're having trouble loading resources right now. Please try again." onRetry={reset} />
    </div>
  );
}
