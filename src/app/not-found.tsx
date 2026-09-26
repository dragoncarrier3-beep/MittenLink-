import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/states";

export default function NotFound() {
  return (
    <div className="container-page py-12">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        icon={SearchX}
        title="We couldn't find that page"
        description="The page may have moved, or the listing may no longer be available."
        action={{ label: "Find Resources", href: "/search" }}
      >
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold hover:bg-muted">
          Go to the homepage
        </Link>
      </EmptyState>
    </div>
  );
}
