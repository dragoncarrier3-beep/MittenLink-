"use client";

import { useActionState } from "react";
import { CheckboxField, FormMessages, RequiredNote, SubmitButton, TextField } from "@/components/forms/fields";
import { idle, type ActionState } from "@/lib/server/action-types";

export interface SettingsDefaults {
  planName: string;
  planPrice: string;
  demoPricing: boolean;
  verificationIntervalDays: number;
  lowResultThreshold: number;
  familyReportsEnabled: boolean;
  defaultSearchRadius: number;
}

export function SettingsForm({ action, defaults }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; defaults: SettingsDefaults }) {
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessages
        state={state}
        fieldLabels={{
          planName: "Plan name", planPrice: "Monthly price", verificationIntervalDays: "Verification interval", lowResultThreshold: "Low-result threshold", defaultSearchRadius: "Default search radius",
        }}
      />
      <RequiredNote />
      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-lg font-bold">Enhanced Listing plan</legend>
        <TextField name="planName" label="Plan name" required maxLength={80} defaultValue={defaults.planName} state={state} />
        <TextField name="planPrice" label="Monthly price (US dollars)" hint="Billed monthly. Example: 29 or 29.00" required inputMode="decimal" defaultValue={defaults.planPrice} state={state} />
        <CheckboxField name="demoPricing" label="Show as demo pricing" hint='Adds a "Demo pricing" label wherever the price is shown.' defaultChecked={defaults.demoPricing} state={state} />
      </fieldset>
      <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
        <legend className="px-1 text-lg font-bold">Directory & search</legend>
        <TextField
          name="verificationIntervalDays"
          label="Verification interval (days)"
          hint="How long a verified record stays current before it is due for review (30–730)."
          required
          inputMode="numeric"
          defaultValue={String(defaults.verificationIntervalDays)}
          state={state}
        />
        <TextField
          name="lowResultThreshold"
          label="Low-result threshold"
          hint="Searches returning this many results or fewer are flagged for gap analysis (0–20)."
          required
          inputMode="numeric"
          defaultValue={String(defaults.lowResultThreshold)}
          state={state}
        />
        <TextField
          name="defaultSearchRadius"
          label="Default search radius (miles)"
          hint="Used for city and ZIP code searches (5–150)."
          required
          inputMode="numeric"
          defaultValue={String(defaults.defaultSearchRadius)}
          state={state}
        />
        <CheckboxField name="familyReportsEnabled" label="Allow family experience reports" hint="Controls whether community members can submit new family experience reports." defaultChecked={defaults.familyReportsEnabled} state={state} />
      </fieldset>
      <div>
        <SubmitButton pendingLabel="Saving settings…">Save Settings</SubmitButton>
      </div>
    </form>
  );
}
