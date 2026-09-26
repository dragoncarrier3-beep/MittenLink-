"use client";

import { ErrorState } from "@/components/common/error-state";

export default function OutreachError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="Outreach could not be loaded" message="We're having trouble loading this page right now. Your saved work is safe — please try again." onRetry={reset} />;
}
