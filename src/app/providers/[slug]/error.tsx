"use client";

import Link from "next/link";
import { ErrorState } from "@/components/common/error-state";

export default function ProviderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex flex-col gap-4 py-8">
      <ErrorState title="Provider unavailable" message="We're having trouble loading resources right now. Please try again." onRetry={reset} />
      <p className="text-center">
        <Link href="/search" className="font-semibold text-primary underline">
          Search all resources
        </Link>
      </p>
    </div>
  );
}
