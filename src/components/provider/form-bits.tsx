"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { idle, type ActionState } from "@/lib/server/action-types";
import { SubmitButton, TextField, FormMessages } from "@/components/forms/fields";
import { buttonVariants } from "@/components/ui/button";
import { DAYS, multiKey, type DayKey } from "./constants";

type Option = { value: string; label: string };

function errorFor(state: ActionState | undefined, name: string) {
  return state?.status === "error" ? state.fieldErrors?.[name] : undefined;
}

/**
 * Accessible checkbox group: a fieldset with a legend, restoring selections
 * after a failed submit. Submits one value per checked box under `name`.
 */
export function CheckboxGroup({
  name,
  legend,
  options,
  defaultValues,
  state,
  hint,
  id,
  columns = 2,
  disabled,
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValues: string[];
  state?: ActionState;
  hint?: React.ReactNode;
  id?: string;
  columns?: 1 | 2 | 3;
  disabled?: boolean;
}) {
  const uid = useId();
  const error = errorFor(state, name);
  let values = defaultValues;
  if (state?.status === "error" && state.values?.[multiKey(name)]) {
    try {
      values = JSON.parse(state.values[multiKey(name)]) as string[];
    } catch {
      values = defaultValues;
    }
  }
  const describedBy = [hint ? `${uid}-hint` : null, error ? `${uid}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset id={id} className="flex scroll-mt-28 flex-col gap-2" aria-describedby={describedBy} aria-invalid={error ? true : undefined} disabled={disabled}>
      <legend className="mb-1 text-base font-semibold text-foreground">
        {legend} <span className="text-sm font-normal text-muted-foreground">(optional)</span>
      </legend>
      {hint && (
        <p id={`${uid}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <input type="hidden" name={`${name}__present`} value="1" />
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options are available yet.</p>
      ) : (
        <div key={values.join("|")} className={cn("grid gap-1", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
          {options.map((o) => (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted">
              <input type="checkbox" name={name} value={o.value} defaultChecked={values.includes(o.value)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <p id={`${uid}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
    </fieldset>
  );
}

type Hours = { day: string; open: string; close: string }[];

/** Weekly hours editor: per-day open/close time inputs with a "Closed" checkbox. */
export function HoursEditor({ defaultHours, state }: { defaultHours: Hours; state?: ActionState }) {
  const uid = useId();
  const error = errorFor(state, "hours");
  const restored = state?.status === "error" && state.values ? state.values : null;
  const initial = Object.fromEntries(
    DAYS.map((d) => {
      const h = defaultHours.find((x) => x.day === d.key);
      const closed = restored ? restored[`hours_${d.key}_closed`] === "on" : !h;
      const open = restored ? restored[`hours_${d.key}_open`] ?? "" : h?.open ?? "";
      const close = restored ? restored[`hours_${d.key}_close`] ?? "" : h?.close ?? "";
      return [d.key, { closed, open, close }];
    }),
  ) as Record<DayKey, { closed: boolean; open: string; close: string }>;
  const [closed, setClosed] = useState<Record<string, boolean>>(Object.fromEntries(DAYS.map((d) => [d.key, initial[d.key].closed])));
  const stateKey = restored ? JSON.stringify(restored) : "initial";

  return (
    <fieldset id="field-hours" className="flex scroll-mt-28 flex-col gap-3" aria-describedby={[`${uid}-hint`, error ? `${uid}-error` : null].filter(Boolean).join(" ")} aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-base font-semibold text-foreground">
        Weekly hours <span className="text-sm font-normal text-muted-foreground">(optional)</span>
      </legend>
      <p id={`${uid}-hint`} className="text-sm text-muted-foreground">
        Enter local (Eastern) times. Check “Closed” for days this location is not open.
      </p>
      {error && (
        <p id={`${uid}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
      <div key={stateKey} className="flex flex-col divide-y rounded-lg border bg-card">
        {DAYS.map((d) => {
          const isClosed = closed[d.key];
          return (
            <div key={d.key} role="group" aria-labelledby={`${uid}-${d.key}`} className="grid gap-2 p-3 sm:grid-cols-[7rem_auto_1fr_1fr] sm:items-center sm:gap-4">
              <span id={`${uid}-${d.key}`} className="font-semibold">
                {d.label}
              </span>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name={`hours_${d.key}_closed`}
                  defaultChecked={initial[d.key].closed}
                  onChange={(e) => setClosed((c) => ({ ...c, [d.key]: e.target.checked }))}
                  className="size-5 accent-[var(--primary)]"
                />
                Closed<span className="sr-only"> on {d.label}</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span>
                  {d.label} opens
                </span>
                <input
                  type="time"
                  name={`hours_${d.key}_open`}
                  defaultValue={initial[d.key].open}
                  disabled={isClosed}
                  className="min-h-11 rounded-lg border border-input bg-card px-3 text-base font-normal disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span>
                  {d.label} closes
                </span>
                <input
                  type="time"
                  name={`hours_${d.key}_close`}
                  defaultValue={initial[d.key].close}
                  disabled={isClosed}
                  className="min-h-11 rounded-lg border border-input bg-card px-3 text-base font-normal disabled:opacity-50"
                />
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Optional provenance fields passed to verifiers with the change request. */
export function SourcesFields({ state }: { state: ActionState }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <legend className="px-1 text-base font-semibold">Where can a verifier confirm this?</legend>
      <p className="text-sm text-muted-foreground">
        Optional. A link to your own website or another official page helps MittenLink review your update faster.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="source_label" label="Source description" state={state} placeholder="Our Services page" maxLength={200} />
        <TextField name="source_url" label="Source web address" type="url" inputMode="url" state={state} placeholder="https://" maxLength={500} />
      </div>
      <TextField name="note" label="Note for the reviewer" hint="Briefly describe what changed (up to 250 characters)." state={state} maxLength={250} />
    </fieldset>
  );
}

/** Explains moderation right above the submit button. */
export function ModerationNote() {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Changes are reviewed by a MittenLink verifier before they appear publicly. Your current published information stays visible until then.
      </span>
    </p>
  );
}

/** Success panel shown after submitting a new record, replacing the form. */
export function SubmittedPanel({ state, backHref, backLabel, againLabel, onAgain }: { state: ActionState; backHref: string; backLabel: string; againLabel: string; onAgain: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <FormMessages state={state} />
      <div className="flex flex-wrap gap-3">
        <Link href="/provider/verification" className={buttonVariants()}>
          View Verification &amp; Updates
        </Link>
        <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
          {backLabel}
        </Link>
        <button type="button" onClick={onAgain} className={buttonVariants({ variant: "ghost" })}>
          {againLabel}
        </button>
      </div>
    </div>
  );
}

/** Small inline form to withdraw a pending change request. */
export function WithdrawButton({
  changeRequestId,
  action,
  label = "Withdraw update",
}: {
  changeRequestId: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="changeRequestId" value={changeRequestId} />
      {state.status !== "idle" && <FormMessages state={state} />}
      {state.status !== "success" && (
        <div>
          <SubmitButton variant="outline" size="sm" pendingLabel="Withdrawing…">
            {label}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
