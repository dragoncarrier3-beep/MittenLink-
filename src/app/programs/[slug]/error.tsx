"use client";

import { ErrorState } from "@/components/common/error-state";

export default function ProgramError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-8">
      <ErrorState title="Program unavailable" message="We're having trouble loading resources right now. Please try again." onRetry={reset} />
    </div>
  );
}
