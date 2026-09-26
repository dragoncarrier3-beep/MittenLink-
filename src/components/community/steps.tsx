import { Check, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  /** complete | current | upcoming | attention (needs action) | stopped (rejected) */
  state: "complete" | "current" | "upcoming" | "attention" | "stopped";
  description?: string;
}

const STATE_TEXT: Record<Step["state"], string> = {
  complete: "Completed",
  current: "Current step",
  upcoming: "Not started",
  attention: "Action needed",
  stopped: "Stopped",
};

/**
 * Visible, accessible step indicator: an ordered list where the current step
 * carries aria-current="step" and every step states its status in text.
 */
export function StepIndicator({ steps, label, className }: { steps: Step[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={className}>
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-0">
        {steps.map((step, i) => {
          const isCurrent = step.state === "current" || step.state === "attention" || step.state === "stopped";
          return (
            <li key={`${step.label}-${i}`} aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-2 sm:flex-1 sm:min-w-36">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  step.state === "complete" && "border-success bg-success text-white",
                  step.state === "current" && "border-primary bg-primary text-primary-foreground",
                  step.state === "upcoming" && "border-border bg-card text-muted-foreground",
                  step.state === "attention" && "border-warning bg-warning-soft text-warning",
                  step.state === "stopped" && "border-danger bg-danger-soft text-danger",
                )}
                aria-hidden
              >
                {step.state === "complete" ? (
                  <Check className="size-4" />
                ) : step.state === "attention" ? (
                  <AlertTriangle className="size-4" />
                ) : step.state === "stopped" ? (
                  <X className="size-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="flex min-w-0 flex-col pr-3">
                <span className={cn("text-sm font-semibold", step.state === "upcoming" ? "text-muted-foreground" : "text-foreground")}>{step.label}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="sr-only">Step {i + 1} of {steps.length}: </span>
                  {step.description ?? STATE_TEXT[step.state]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Claim status → the Draft → Submitted → Under Review → Decision progression. */
export function claimSteps(status: string): Step[] {
  const order = ["draft", "submitted", "under_review", "decision"];
  const position =
    status === "draft" ? 0 : status === "submitted" ? 1 : status === "under_review" || status === "more_info_required" ? 2 : 3;
  const steps: Step[] = [
    { label: "Draft", state: "upcoming" },
    { label: "Submitted", state: "upcoming" },
    { label: status === "more_info_required" ? "More Information Required" : "Under Review", state: "upcoming" },
    { label: status === "rejected" ? "Rejected" : "Approved", state: "upcoming" },
  ];
  order.forEach((_, i) => {
    if (i < position) steps[i].state = "complete";
    else if (i === position) steps[i].state = "current";
  });
  if (status === "more_info_required") {
    steps[2].state = "attention";
    steps[2].description = "Please respond";
  }
  if (status === "approved") steps[3].state = "complete";
  if (status === "rejected") steps[3].state = "stopped";
  if (status === "draft") steps[0].description = "Not yet submitted";
  return steps;
}
