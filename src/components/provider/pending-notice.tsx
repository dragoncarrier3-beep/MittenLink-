import { Clock, MessageSquareWarning } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/server/action-types";
import { WithdrawButton } from "./form-bits";

interface PendingLike {
  id: string;
  status: string;
  created_at: Date;
  submitted_by: string;
  submitted_by_name: string | null;
  review_message: string | null;
}

/**
 * "Update pending review — submitted {date}" notice for a record, with the
 * reviewer's question when more information is required, and a withdraw
 * control for the person who submitted it.
 */
export function PendingNotice({
  request,
  currentUserId,
  withdrawAction,
  compact = false,
  className,
}: {
  request: PendingLike;
  currentUserId: string;
  withdrawAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  compact?: boolean;
  className?: string;
}) {
  const moreInfo = request.status === "more_info_required";
  const Icon = moreInfo ? MessageSquareWarning : Clock;
  const mine = request.submitted_by === currentUserId;
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3", moreInfo ? "border-warning/40 bg-warning-soft" : "border-info/30 bg-info-soft", className)}>
      <p className="flex items-start gap-2 font-semibold">
        <Icon className={cn("mt-0.5 size-5 shrink-0", moreInfo ? "text-warning" : "text-info")} aria-hidden />
        <span>
          {moreInfo ? "More information requested" : "Update pending review"} — submitted {formatDate(request.created_at)}
          {!mine && request.submitted_by_name ? ` by ${request.submitted_by_name}` : ""}
        </span>
      </p>
      {moreInfo && request.review_message && (
        <blockquote className="ml-7 border-l-4 border-warning/50 pl-3 text-foreground">
          <span className="sr-only">Message from the MittenLink verifier: </span>
          {request.review_message}
        </blockquote>
      )}
      {!compact && (
        <p className="ml-7 text-sm text-muted-foreground">
          The public listing still shows the currently published information until a verifier approves this update.
        </p>
      )}
      {mine && (
        <div className="ml-7">
          <WithdrawButton changeRequestId={request.id} action={withdrawAction} />
        </div>
      )}
    </div>
  );
}
