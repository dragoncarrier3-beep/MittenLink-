"use client";

import { useActionState } from "react";
import { FormMessages, SubmitButton } from "@/components/forms/fields";
import { idle, type ActionState } from "@/lib/server/action-types";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A single-button form for simple workflow actions (e.g. "Mark checked today").
 * Announces success or failure with FormMessages (role=status / role=alert).
 */
export function ActionButton({
  action,
  hidden,
  label,
  pendingLabel = "Saving…",
  variant = "outline",
  size = "default",
  className,
  srContext,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  /** Extra screen-reader text so the button makes sense out of context. */
  srContext?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className={cn("flex flex-col gap-2", className)}>
      <FormMessages state={state} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
          {label}
          {srContext && <span className="sr-only"> {srContext}</span>}
        </SubmitButton>
      </div>
    </form>
  );
}
