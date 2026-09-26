"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/server/action-types";

/**
 * Accessible checkbox group (fieldset + legend). Values are submitted as
 * `${name}[]` so parseForm() always yields an array. Selections are restored
 * after a failed submit from the action state's echoed values.
 */
export function CheckboxGroupField({
  name,
  legend,
  options,
  state,
  defaultValues = [],
  hint,
  required,
  columns = 2,
  className,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  state?: ActionState;
  defaultValues?: string[];
  hint?: React.ReactNode;
  required?: boolean;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const id = useId();
  const field = `${name}[]`;
  const error = state?.status === "error" ? state.fieldErrors?.[field] ?? state.fieldErrors?.[name] : undefined;
  // formValues() keeps only the last value per key, so selected values are echoed as a CSV in `${name}__selected`.
  const echoed = state?.status === "error" ? state.values?.[`${name}__selected`] : undefined;
  const selected = new Set(echoed !== undefined ? echoed.split(",").filter(Boolean) : defaultValues);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={cn("flex flex-col gap-2", className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
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
      <div
        key={echoed ?? "initial"}
        className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}
      >
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-secondary">
            <input type="checkbox" name={field} value={o.value} defaultChecked={selected.has(o.value)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
            <span>{o.label}</span>
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

/** Confirmation panel that replaces a form after success; receives focus so it is announced. */
export function SuccessPanel({
  title,
  children,
  actions,
  warning,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: { label: string; href: string; variant?: "default" | "outline" }[];
  warning?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-xl border border-success/40 bg-success-soft p-6 text-foreground outline-none">
      <h2 className="flex items-start gap-2 text-2xl font-bold">
        <CheckCircle2 className="mt-1 size-6 shrink-0 text-success" aria-hidden />
        {title}
      </h2>
      {children && <div className="mt-3 flex flex-col gap-3 text-base">{children}</div>}
      {warning && <p className="mt-3 text-sm font-semibold text-warning">{warning}</p>}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className={buttonVariants({ variant: a.variant ?? "default" })}>
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Grouped form section with a visible heading (used by longer multi-section forms). */
export function FormSection({ title, description, children, id }: { title: string; description?: React.ReactNode; children: React.ReactNode; id?: string }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <h2 id={headingId} className="text-xl font-bold">
          {title}
        </h2>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
