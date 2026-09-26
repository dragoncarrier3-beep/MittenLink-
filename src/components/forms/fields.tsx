"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/server/action-types";

/*
 * Accessible form primitives shared by every form in the app.
 * - Visible labels bound to inputs, programmatic required indicators
 * - Hint + error text linked with aria-describedby, aria-invalid on error
 * - Values are restored from the action state after a failed submit
 */

type Common = {
  name: string;
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  state?: ActionState;
  className?: string;
  defaultValue?: string | null;
};

function fieldError(state: ActionState | undefined, name: string) {
  return state?.status === "error" ? state.fieldErrors?.[name] : undefined;
}
function fieldValue(state: ActionState | undefined, name: string, fallback?: string | null) {
  if (state?.status === "error" && state.values && name in state.values) return state.values[name];
  return fallback ?? "";
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
  hintId,
  errorId,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hintId: string;
  errorId: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-base font-semibold text-foreground">
        {label}
        {required ? (
          <span className="ml-1 font-normal text-danger">
            <span aria-hidden>*</span>
            <span className="sr-only">(required)</span>
          </span>
        ) : (
          <span className="ml-1 text-sm font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-danger aria-[invalid=true]:border-2";

export function TextField({
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
  ...props
}: Common & { type?: string; autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; placeholder?: string; maxLength?: number }) {
  const id = useId();
  const error = fieldError(props.state, props.name);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} error={error} required={props.required} className={props.className} hintId={hintId} errorId={errorId}>
      <input
        id={id}
        name={props.name}
        type={type}
        key={fieldValue(props.state, props.name, props.defaultValue)}
        defaultValue={fieldValue(props.state, props.name, props.defaultValue)}
        required={props.required}
        aria-required={props.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function TextAreaField({ rows = 5, maxLength, ...props }: Common & { rows?: number; maxLength?: number }) {
  const id = useId();
  const error = fieldError(props.state, props.name);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} error={error} required={props.required} className={props.className} hintId={hintId} errorId={errorId}>
      <textarea
        id={id}
        name={props.name}
        rows={rows}
        maxLength={maxLength}
        key={fieldValue(props.state, props.name, props.defaultValue)}
        defaultValue={fieldValue(props.state, props.name, props.defaultValue)}
        required={props.required}
        aria-required={props.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClass, "min-h-28")}
      />
    </FieldShell>
  );
}

export function SelectField({
  options,
  placeholder = "Select an option",
  ...props
}: Common & { options: { value: string; label: string }[]; placeholder?: string | null }) {
  const id = useId();
  const error = fieldError(props.state, props.name);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [props.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const value = fieldValue(props.state, props.name, props.defaultValue);
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} error={error} required={props.required} className={props.className} hintId={hintId} errorId={errorId}>
      <select
        id={id}
        name={props.name}
        key={value}
        defaultValue={value}
        required={props.required}
        aria-required={props.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ name, label, hint, state, defaultChecked, className }: { name: string; label: React.ReactNode; hint?: React.ReactNode; state?: ActionState; defaultChecked?: boolean; className?: string }) {
  const id = useId();
  const error = fieldError(state, name);
  const restored = state?.status === "error" && state.values ? state.values[name] === "on" : defaultChecked;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={restored}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
          className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
        />
        <label htmlFor={id} className="text-base text-foreground">
          {label}
        </label>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="ml-8 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="ml-8 text-sm font-semibold text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
    </div>
  );
}

export function RadioGroupField({
  name,
  legend,
  options,
  state,
  defaultValue,
  required,
  hint,
  className,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string; description?: string }[];
  state?: ActionState;
  defaultValue?: string;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const error = fieldError(state, name);
  const value = fieldValue(state, name, defaultValue);
  return (
    <fieldset
      className={cn("flex flex-col gap-2", className)}
      aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1 text-base font-semibold text-foreground">
        {legend}
        {required ? (
          <span className="ml-1 font-normal text-danger">
            <span aria-hidden>*</span>
            <span className="sr-only">(required)</span>
          </span>
        ) : (
          <span className="ml-1 text-sm font-normal text-muted-foreground">(optional)</span>
        )}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex flex-col gap-2" key={value}>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-secondary">
            <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} required={required} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
            <span>
              <span className="font-semibold">{o.label}</span>
              {o.description && <span className="block text-sm text-muted-foreground">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Error summary for forms: receives focus when a submit fails so keyboard and
 * screen-reader users hear what went wrong, with links to each invalid field.
 */
export function FormMessages({ state, fieldLabels }: { state: ActionState; fieldLabels?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") ref.current?.focus();
  }, [state]);

  if (state.status === "idle") return null;
  if (state.status === "success") {
    return (
      <div ref={ref} tabIndex={-1} role="status" className="flex flex-col gap-1 rounded-lg border border-success/40 bg-success-soft p-4 text-foreground outline-none">
        <p className="flex items-start gap-2 font-semibold text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          {state.message}
        </p>
        {state.warning && <p className="ml-7 text-sm text-warning">{state.warning}</p>}
      </div>
    );
  }
  const errors = Object.entries(state.fieldErrors ?? {});
  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby="form-error-heading" className="rounded-lg border-2 border-danger/50 bg-danger-soft p-4 text-foreground outline-none">
      <h2 id="form-error-heading" className="flex items-start gap-2 text-base font-bold text-danger">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
        {state.message}
      </h2>
      {errors.length > 0 && (
        <ul className="mt-2 ml-7 list-disc space-y-1">
          {errors.map(([field, msg]) => (
            <li key={field}>
              <a
                href={`#`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.querySelector<HTMLElement>(`[name="${field}"]`);
                  el?.focus();
                }}
                className="underline"
              >
                {fieldLabels?.[field] ? `${fieldLabels[field]}: ` : ""}
                {msg}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel = "Saving…", variant, size, className, name, value }: { children: React.ReactNode; pendingLabel?: string; variant?: "default" | "outline" | "secondary" | "destructive" | "ghost"; size?: "default" | "sm" | "lg"; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-disabled={pending} className={className} name={name} value={value}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden /> <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function RequiredNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Fields marked with <span className="text-danger" aria-hidden>*</span>
      <span className="sr-only">an asterisk</span> are required.
    </p>
  );
}
