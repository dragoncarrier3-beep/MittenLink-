import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/states";

export default function ProviderNotFound() {
  return (
    <div className="container-page py-10">
      <EmptyState
        icon={SearchX}
        headingLevel={2}
        title="We couldn't find that provider"
        description="The listing may have moved, been archived, or is not published yet."
        action={{ label: "Search resources", href: "/search" }}
      />
    </div>
  );
}
