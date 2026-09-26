"use client";

import { ErrorState } from "@/components/common/error-state";

export default function SearchError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-8">
      <ErrorState title="Search unavailable" message="We couldn't complete your search. Your filters have been preserved." onRetry={reset} retryLabel="Retry search" />
    </div>
  );
}
