"use client";

import { useActionState, useState } from "react";
import { idle, type ActionState } from "@/lib/server/action-types";
import { CheckboxField, FormMessages, RadioGroupField, RequiredNote, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { CheckboxGroup, ModerationNote, SourcesFields, SubmittedPanel } from "@/components/provider/form-bits";
import { WAITLIST_LABELS } from "@/lib/labels";
import type { Option } from "@/lib/data/provider";
import { submitServiceChange } from "../change-actions";

export interface ServiceFormValues {
  title: string;
  summary: string;
  description: string;
  eligibility: string;
  age_min: string;
  age_max: string;
  in_person: boolean;
  virtual_available: boolean;
  home_based: boolean;
  waitlist_status: string;
  is_free: boolean;
  referral_required: boolean;
  payment_options: string[];
  insurance_notes: string;
  payment_notes: string;
  contact_phone: string;
  contact_email: string;
  categories: string[];
  populations: string[];
  languages: string[];
  location_ids: string[];
}

type Props = {
  targetId: string | null;
  values: ServiceFormValues;
  replaces: string | null;
  options: { categories: Option[]; populations: Option[]; languages: Option[]; paymentOptions: Option[]; locations: Option[] };
  fieldLabels: Record<string, string>;
};

export function ServiceForm(props: Props) {
  const [round, setRound] = useState(0);
  return <ServiceFormInner key={round} {...props} onAgain={() => setRound((r) => r + 1)} />;
}

function DeliveryError({ state }: { state: ActionState }) {
  const msg = state.status === "error" ? state.fieldErrors?.in_person : undefined;
  if (!msg) return null;
  return (
    <p className="text-sm font-semibold text-danger">
      <span className="sr-only">Error: </span>
      {msg}
    </p>
  );
}

function ServiceFormInner({ targetId, values, replaces, options, fieldLabels, onAgain }: Props & { onAgain: () => void }) {
  const [state, action] = useActionState(submitServiceChange, idle);
  if (!targetId && state.status === "success") {
    return <SubmittedPanel state={state} backHref="/provider/services" backLabel="Back to services" againLabel="Add another service" onAgain={onAgain} />;
  }
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={{ ...fieldLabels, in_person: "Service delivery", source_label: "Source description", source_url: "Source web address", note: "Note for the reviewer" }} />
      <RequiredNote />
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      {replaces && <input type="hidden" name="replaces" value={replaces} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">About this service</legend>
        <TextField name="title" label="Service name" required state={state} defaultValue={values.title} maxLength={160} />
        <TextAreaField name="summary" label="Short description" required hint="One or two sentences shown in search results (up to 300 characters)." rows={3} maxLength={300} state={state} defaultValue={values.summary} />
        <TextAreaField name="description" label="Full description" hint="What happens, how often, and what people can expect." rows={6} maxLength={4000} state={state} defaultValue={values.description} />
      </fieldset>

      <CheckboxGroup name="categories" legend="Categories" options={options.categories} defaultValues={values.categories} state={state} columns={3} />
      <CheckboxGroup name="populations" legend="Populations served" options={options.populations} defaultValues={values.populations} state={state} />
      <CheckboxGroup name="languages" legend="Languages offered" options={options.languages} defaultValues={values.languages} state={state} columns={3} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Eligibility</legend>
        <TextAreaField name="eligibility" label="Who can use this service" hint="For example diagnosis, residency, or income requirements, in plain language." rows={3} maxLength={1000} state={state} defaultValue={values.eligibility} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="age_min" label="Minimum age" type="number" inputMode="numeric" hint="Leave blank if there is no minimum." state={state} defaultValue={values.age_min} />
          <TextField name="age_max" label="Maximum age" type="number" inputMode="numeric" hint="Leave blank if there is no maximum." state={state} defaultValue={values.age_max} />
        </div>
        <CheckboxField name="referral_required" label="A referral is required" state={state} defaultChecked={values.referral_required} />
      </fieldset>

      <fieldset className="flex flex-col gap-2" aria-describedby="delivery-hint">
        <legend className="mb-1 text-base font-semibold">How is this service delivered?</legend>
        <p id="delivery-hint" className="text-sm text-muted-foreground">
          Choose all that apply.
        </p>
        <DeliveryError state={state} />
        <CheckboxField name="in_person" label="In person" state={state} defaultChecked={values.in_person} />
        <CheckboxField name="virtual_available" label="Virtual (phone or video)" state={state} defaultChecked={values.virtual_available} />
        <CheckboxField name="home_based" label="Home based (staff come to you)" state={state} defaultChecked={values.home_based} />
      </fieldset>

      <CheckboxGroup
        name="location_ids"
        legend="Available at these locations"
        hint={options.locations.length ? "Leave all unchecked for services offered only virtually or in homes." : "Add a location first to link this service to an address."}
        options={options.locations}
        defaultValues={values.location_ids}
        state={state}
      />

      <RadioGroupField
        name="waitlist_status"
        legend="Accepting new clients"
        required
        options={Object.entries(WAITLIST_LABELS).map(([value, label]) => ({ value, label }))}
        state={state}
        defaultValue={values.waitlist_status}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Cost and payment</legend>
        <CheckboxField name="is_free" label="This service is free" state={state} defaultChecked={values.is_free} />
        <CheckboxGroup name="payment_options" legend="Payment options accepted" options={options.paymentOptions} defaultValues={values.payment_options} state={state} />
        <TextAreaField name="insurance_notes" label="Insurance notes" hint="For example which Medicaid health plans you accept." rows={3} maxLength={1000} state={state} defaultValue={values.insurance_notes} />
        <TextAreaField name="payment_notes" label="Payment notes" hint="Sliding scale, scholarships, or other cost details." rows={3} maxLength={1000} state={state} defaultValue={values.payment_notes} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Contact for this service</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="contact_phone" label="Contact phone" type="tel" inputMode="tel" state={state} defaultValue={values.contact_phone} maxLength={30} />
          <TextField name="contact_email" label="Contact email" type="email" inputMode="email" state={state} defaultValue={values.contact_email} maxLength={200} />
        </div>
      </fieldset>

      <SourcesFields state={state} />
      <ModerationNote />
      <div>
        <SubmitButton pendingLabel="Submitting…">{targetId ? (replaces ? "Submit revised update for review" : "Submit update for review") : "Submit new service for review"}</SubmitButton>
      </div>
    </form>
  );
}
