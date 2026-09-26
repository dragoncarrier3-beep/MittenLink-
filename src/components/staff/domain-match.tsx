import { BadgeCheck, CircleAlert } from "lucide-react";
import { emailMatchesWebsite } from "@/lib/data/staff";

/** Text + icon flag comparing a work email domain with the organization website domain. */
export function DomainMatch({ email, website }: { email: string; website: string | null }) {
  const match = emailMatchesWebsite(email, website);
  return match ? (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
      <BadgeCheck className="size-4" aria-hidden /> Domain matches website
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning">
      <CircleAlert className="size-4" aria-hidden /> Different domain
    </span>
  );
}
