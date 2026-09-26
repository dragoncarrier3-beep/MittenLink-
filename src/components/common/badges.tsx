import { AlertTriangle, BadgeCheck, CircleDashed, Clock, Archive, HelpCircle, Sparkles, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_LABELS, type VerificationStatus } from "@/lib/labels";
import { formatMonthYear } from "@/lib/format";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "enhanced" | "lake";

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
  enhanced: "bg-enhanced-soft text-enhanced border-enhanced/30",
  lake: "bg-lake-soft text-secondary-foreground border-lake/30",
};

/** Generic status pill. Always pair color with text (never color alone). */
export function StatusPill({ tone = "neutral", children, className, icon }: { tone?: Tone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn("ml-badge inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "success",
  pending_review: "info",
  needs_update: "warning",
  unable_to_verify: "danger",
  unverified: "neutral",
  archived: "neutral",
};

const VERIFICATION_ICON: Record<VerificationStatus, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  verified: BadgeCheck,
  pending_review: Clock,
  needs_update: AlertTriangle,
  unable_to_verify: HelpCircle,
  unverified: CircleDashed,
  archived: Archive,
};

export function VerificationBadge({ status, className }: { status: string; className?: string }) {
  const s = (status in VERIFICATION_LABELS ? status : "unverified") as VerificationStatus;
  const Icon = VERIFICATION_ICON[s];
  return (
    <StatusPill tone={VERIFICATION_TONE[s]} className={className} icon={<Icon className="size-4" aria-hidden />}>
      {VERIFICATION_LABELS[s]}
    </StatusPill>
  );
}

/** "Last reviewed: August 2026" line shown with verification badges. */
export function LastReviewed({ date, className }: { date: Date | string | null | undefined; className?: string }) {
  if (!date) return <span className={cn("text-sm text-muted-foreground", className)}>Not yet reviewed</span>;
  return <span className={cn("text-sm text-muted-foreground", className)}>Last reviewed: {formatMonthYear(date)}</span>;
}

/**
 * Listing tier is shown separately from verification. Payment never affects
 * verification or ranking — this badge is purely informational.
 */
export function ListingTierBadge({ tier, className, showFree = false }: { tier: string | null | undefined; className?: string; showFree?: boolean }) {
  if (tier === "enhanced") {
    return (
      <StatusPill tone="enhanced" className={className} icon={<Sparkles className="size-4" aria-hidden />}>
        Enhanced Listing
      </StatusPill>
    );
  }
  if (!showFree) return null;
  return (
    <StatusPill tone="neutral" className={className} icon={<Tag className="size-4" aria-hidden />}>
      Free Listing
    </StatusPill>
  );
}

export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <StatusPill tone="warning" className={className}>
      Demonstration data
    </StatusPill>
  );
}

export type { Tone };
