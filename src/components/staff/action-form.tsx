"use client";

import { useActionState } from "react";
import {
  CheckboxField,
  FormMessages,
  RadioGroupField,
  RequiredNote,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/fields";
import { idle, type ActionState } from "@/lib/server/action-types";
import { cn } from "@/lib/utils";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Variant = "default" | "outline" | "secondary" | "destructive" | "ghost";

export interface ActionButton {
  label: string;
  /** Sent as `intent` so one form can offer several decisions. */
  value?: string;
  variant?: Variant;
  pendingLabel?: string;
}

/**
 * Compact form for row-level actions that carry only hidden inputs
 * (e.g. "Assign to me"). Errors are shown inline above the button; on
 * success the server action redirects with a result banner.
 */
export function ActionForm({
  action,
  hidden,
  buttons,
  className,
  size = "sm",
  children,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  buttons: ActionButton[];
  className?: string;
  size?: "sm" | "default";
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className={cn("flex flex-col gap-2", className)}>
      {state.status === "error" && <FormMessages state={state} />}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <SubmitButton key={b.label} variant={b.variant ?? "outline"} size={size} name={b.value ? "intent" : undefined} value={b.value} pendingLabel={b.pendingLabel ?? "Working…"}>
            {b.label}
          </SubmitButton>
        ))}
      </div>
    </form>
  );
}

export type DecisionField =
  | { type: "textarea"; name: string; label: string; hint?: string; required?: boolean; rows?: number; maxLength?: number; defaultValue?: string }
  | { type: "text"; name: string; label: string; hint?: string; required?: boolean; defaultValue?: string }
  | { type: "select"; name: string; label: string; hint?: string; required?: boolean; options: { value: string; label: string }[]; defaultValue?: string; placeholder?: string | null }
  | { type: "radio"; name: string; label: string; hint?: string; required?: boolean; options: { value: string; label: string; description?: string }[]; defaultValue?: string }
  | { type: "checkbox"; name: string; label: string; hint?: string };

/**
 * Serializable, config-driven decision form used by staff review pages
 * (claims, family reports, submissions, merges). Field values are restored
 * after a failed submit and field errors are linked to their inputs.
 */
export function DecisionForm({
  action,
  hidden,
  fields,
  buttons,
  fieldLabels,
  showRequiredNote = true,
  className,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  fields: DecisionField[];
  buttons: ActionButton[];
  fieldLabels?: Record<string, string>;
  showRequiredNote?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  const labels = fieldLabels ?? Object.fromEntries(fields.map((f) => [f.name, f.label]));
  return (
    <form action={formAction} className={cn("flex flex-col gap-5", className)} noValidate>
      <FormMessages state={state} fieldLabels={labels} />
      {showRequiredNote && fields.some((f) => "required" in f && f.required) && <RequiredNote />}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => {
        switch (f.type) {
          case "textarea":
            return <TextAreaField key={f.name} name={f.name} label={f.label} hint={f.hint} required={f.required} rows={f.rows ?? 4} maxLength={f.maxLength} defaultValue={f.defaultValue} state={state} />;
          case "text":
            return <TextField key={f.name} name={f.name} label={f.label} hint={f.hint} required={f.required} defaultValue={f.defaultValue} state={state} />;
          case "select":
            return <SelectField key={f.name} name={f.name} label={f.label} hint={f.hint} required={f.required} options={f.options} defaultValue={f.defaultValue} placeholder={f.placeholder} state={state} />;
          case "radio":
            return <RadioGroupField key={f.name} name={f.name} legend={f.label} hint={f.hint} required={f.required} options={f.options} defaultValue={f.defaultValue} state={state} />;
          case "checkbox":
            return <CheckboxField key={f.name} name={f.name} label={f.label} hint={f.hint} state={state} />;
        }
      })}
      <div className="flex flex-wrap gap-3">
        {buttons.map((b) => (
          <SubmitButton key={b.label} variant={b.variant ?? "default"} name={b.value ? "intent" : undefined} value={b.value} pendingLabel={b.pendingLabel ?? "Saving…"}>
            {b.label}
          </SubmitButton>
        ))}
      </div>
    </form>
  );
}
