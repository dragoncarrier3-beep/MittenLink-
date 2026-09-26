import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/states";

export default function ProgramNotFound() {
  return (
    <div className="container-page py-10">
      <EmptyState icon={SearchX} title="We couldn't find that program" description="It may have ended, moved, or been archived." action={{ label: "Search resources", href: "/search" }} />
    </div>
  );
}
