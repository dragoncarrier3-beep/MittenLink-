import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Copy, Download, Pause, Search, XCircle } from "lucide-react";
import { StatusPill, type Tone } from "@/components/common/badges";
import { CANDIDATE_STATUS_LABELS, OUTREACH_STATUS_LABELS, label } from "@/lib/labels";

const icon = (Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>) => <Icon className="size-4" aria-hidden />;

const CANDIDATE_TONE: Record<string, [Tone, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>]> = {
  new: ["info", CircleDashed],
  reviewing: ["lake", Search],
  possible_duplicate: ["warning", Copy],
  approved_for_import: ["success", CheckCircle2],
  rejected: ["neutral", XCircle],
  imported: ["success", Download],
};

export function CandidateStatusPill({ status }: { status: string }) {
  const [tone, Icon] = CANDIDATE_TONE[status] ?? ["neutral", CircleDashed];
  return (
    <StatusPill tone={tone} icon={icon(Icon)}>
      {label(CANDIDATE_STATUS_LABELS, status)}
    </StatusPill>
  );
}

const OUTREACH_TONE: Record<string, Tone> = {
  not_contacted: "neutral",
  outreach_sent: "info",
  follow_up_needed: "warning",
  responded: "lake",
  claim_invited: "info",
  claimed: "success",
  declined: "neutral",
  unable_to_reach: "danger",
};

export function OutreachStatusPill({ status }: { status: string }) {
  return <StatusPill tone={OUTREACH_TONE[status] ?? "neutral"}>{label(OUTREACH_STATUS_LABELS, status)}</StatusPill>;
}

export const SOURCE_STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", needs_attention: "Needs attention" };

export function SourceStatusPill({ status }: { status: string }) {
  if (status === "needs_attention") return <StatusPill tone="warning" icon={icon(AlertTriangle)}>Needs attention</StatusPill>;
  if (status === "paused") return <StatusPill tone="neutral" icon={icon(Pause)}>Paused</StatusPill>;
  return <StatusPill tone="success" icon={icon(CheckCircle2)}>Active</StatusPill>;
}

export const RESEARCH_TASK_STATUS_LABELS: Record<string, string> = { open: "Open", in_progress: "In progress", done: "Done", cancelled: "Cancelled" };

export function TaskStatusPill({ status }: { status: string }) {
  const tone: Tone = status === "done" ? "success" : status === "in_progress" ? "info" : status === "cancelled" ? "neutral" : "warning";
  return <StatusPill tone={tone}>{label(RESEARCH_TASK_STATUS_LABELS, status)}</StatusPill>;
}

export const LEVEL_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

/** Potential gap level / severity (text + icon, never color alone). */
export function LevelPill({ level, prefix }: { level: string; prefix?: string }) {
  const tone: Tone = level === "high" ? "danger" : level === "medium" ? "warning" : "neutral";
  const Icon = level === "high" ? AlertTriangle : level === "medium" ? Clock : CircleDashed;
  return (
    <StatusPill tone={tone} icon={icon(Icon)}>
      {prefix ? `${prefix}: ` : ""}
      {label(LEVEL_LABELS, level)}
    </StatusPill>
  );
}

export const GAP_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  researching: "Researching",
  source_watch_task: "Source Watch task created",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function GapStatusPill({ status }: { status: string }) {
  const tone: Tone = status === "resolved" ? "success" : status === "dismissed" ? "neutral" : status === "open" ? "warning" : "info";
  return <StatusPill tone={tone}>{label(GAP_STATUS_LABELS, status)}</StatusPill>;
}

export const INDICATOR_LABELS: Record<string, string> = { zero_supply: "No local resources", low_supply: "Low supply", unmet_demand: "Unmet search demand" };

export function DuplicateConfidence({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">Not checked</span>;
  return (
    <StatusPill tone={value >= 70 ? "warning" : "neutral"}>
      {value}%{value >= 70 ? " · likely" : ""}
      <span className="sr-only"> duplicate confidence</span>
    </StatusPill>
  );
}
