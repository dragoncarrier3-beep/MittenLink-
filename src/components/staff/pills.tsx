import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { StatusPill, type Tone } from "@/components/common/badges";
import {
  CHANGE_STATUS_LABELS,
  CLAIM_STATUS_LABELS,
  PRIORITY_LABELS,
  REPORT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  label,
} from "@/lib/labels";

const PRIORITY_TONE: Record<string, Tone> = { urgent: "danger", high: "warning", normal: "info", low: "neutral" };

/** Priority with text + icon + color (never color alone). */
export function PriorityPill({ priority }: { priority: string }) {
  const Icon = priority === "urgent" ? AlertTriangle : priority === "high" ? ArrowUp : priority === "low" ? ArrowDown : Minus;
  return (
    <StatusPill tone={PRIORITY_TONE[priority] ?? "neutral"} icon={<Icon className="size-4" aria-hidden />}>
      <span className="sr-only">Priority: </span>
      {label(PRIORITY_LABELS, priority)}
    </StatusPill>
  );
}

export const CORRECTION_STATUS_LABELS: Record<string, string> = { new: "New", in_review: "In Review", resolved: "Resolved", dismissed: "Dismissed" };
export const DUPLICATE_STATUS_LABELS: Record<string, string> = { open: "Open", merged: "Merged", kept_separate: "Kept Separate", ignored: "Ignored" };
export const SUBMISSION_STATUS_LABELS: Record<string, string> = { new: "New", reviewed: "Reviewed", added_to_source_watch: "Added to Source Watch", dismissed: "Dismissed" };
export const PUBLICATION_LABELS: Record<string, string> = { draft: "Draft", pending: "Pending", published: "Published", archived: "Archived" };

type Kind = "task" | "claim" | "report" | "change" | "correction" | "duplicate" | "submission";

const MAPS: Record<Kind, { labels: Record<string, string>; tones: Record<string, Tone> }> = {
  task: { labels: TASK_STATUS_LABELS, tones: { open: "info", in_progress: "lake", escalated: "warning", completed: "success", cancelled: "neutral" } },
  claim: { labels: CLAIM_STATUS_LABELS, tones: { draft: "neutral", submitted: "info", under_review: "lake", more_info_required: "warning", approved: "success", rejected: "danger" } },
  report: { labels: REPORT_STATUS_LABELS, tones: { submitted: "info", under_review: "lake", approved: "success", rejected: "danger", needs_clarification: "warning" } },
  change: { labels: CHANGE_STATUS_LABELS, tones: { pending_review: "info", approved: "success", rejected: "danger", more_info_required: "warning", withdrawn: "neutral" } },
  correction: { labels: CORRECTION_STATUS_LABELS, tones: { new: "info", in_review: "lake", resolved: "success", dismissed: "neutral" } },
  duplicate: { labels: DUPLICATE_STATUS_LABELS, tones: { open: "warning", merged: "success", kept_separate: "neutral", ignored: "neutral" } },
  submission: { labels: SUBMISSION_STATUS_LABELS, tones: { new: "info", reviewed: "success", added_to_source_watch: "lake", dismissed: "neutral" } },
};

/** Workflow status pill for any staff queue. */
export function WorkflowStatus({ kind, status }: { kind: Kind; status: string }) {
  const m = MAPS[kind];
  return <StatusPill tone={m.tones[status] ?? "neutral"}>{label(m.labels, status)}</StatusPill>;
}
