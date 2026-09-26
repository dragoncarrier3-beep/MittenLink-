"use client";

import { useActionState, useState } from "react";
import { idle } from "@/lib/server/action-types";
import { CheckboxField, FormMessages, RadioGroupField, RequiredNote, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { HoursEditor, ModerationNote, SourcesFields, SubmittedPanel } from "@/components/provider/form-bits";
import { LOCATION_STATUS_LABELS, TRI_STATE_OPTIONS } from "@/components/provider/constants";
import { submitLocationChange } from "../change-actions";

export interface LocationFormValues {
  name: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  phone: string;
  email: string;
  hours: { day: string; open: string; close: string }[];
  hours_note: string;
  wheelchair_accessible: string; // yes | no | unknown
  accessible_parking: string;
  transit_info: string;
  appointment_required: boolean;
  virtual_services: boolean;
  status: string;
}

type Props = {
  targetId: string | null;
  values: LocationFormValues;
  replaces: string | null;
  fieldLabels: Record<string, string>;
};

export function LocationForm(props: Props) {
  const [round, setRound] = useState(0);
  return <LocationFormInner key={round} {...props} onAgain={() => setRound((r) => r + 1)} />;
}

function LocationFormInner({ targetId, values, replaces, fieldLabels, onAgain }: Props & { onAgain: () => void }) {
  const [state, action] = useActionState(submitLocationChange, idle);
  if (!targetId && state.status === "success") {
    return <SubmittedPanel state={state} backHref="/provider/locations" backLabel="Back to locations" againLabel="Add another location" onAgain={onAgain} />;
  }
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={{ ...fieldLabels, source_label: "Source description", source_url: "Source web address", note: "Note for the reviewer" }} />
      <RequiredNote />
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      {replaces && <input type="hidden" name="replaces" value={replaces} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Address</legend>
        <TextField name="name" label="Location name" hint="For example “Lansing Office” or “Main Office”." required state={state} defaultValue={values.name} maxLength={120} />
        <TextField name="street" label="Street address" required autoComplete="address-line1" state={state} defaultValue={values.street} maxLength={200} />
        <TextField name="street2" label="Suite / unit" autoComplete="address-line2" state={state} defaultValue={values.street2} maxLength={120} />
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField name="city" label="City" required autoComplete="address-level2" state={state} defaultValue={values.city} maxLength={80} />
          <TextField name="zip" label="ZIP code" required inputMode="numeric" autoComplete="postal-code" state={state} defaultValue={values.zip} maxLength={5} />
        </div>
        <p className="text-sm text-muted-foreground">Locations must be in Michigan. The map position is set from the ZIP code and confirmed by a verifier.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Contact</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="phone" label="Location phone" type="tel" inputMode="tel" state={state} defaultValue={values.phone} maxLength={30} />
          <TextField name="email" label="Location email" type="email" inputMode="email" state={state} defaultValue={values.email} maxLength={200} />
        </div>
      </fieldset>

      <HoursEditor defaultHours={values.hours} state={state} />
      <TextField name="hours_note" label="Hours note" hint="For example “Closed on state holidays” or “Evening appointments by request”." state={state} defaultValue={values.hours_note} maxLength={300} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Accessibility and access</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <RadioGroupField name="wheelchair_accessible" legend="Wheelchair accessible entrance" options={TRI_STATE_OPTIONS} state={state} defaultValue={values.wheelchair_accessible} />
          <RadioGroupField name="accessible_parking" legend="Accessible parking" options={TRI_STATE_OPTIONS} state={state} defaultValue={values.accessible_parking} />
        </div>
        <TextAreaField name="transit_info" label="Public transportation" hint="Nearby bus routes or paratransit information." rows={3} maxLength={500} state={state} defaultValue={values.transit_info} />
        <CheckboxField name="appointment_required" label="An appointment is required" state={state} defaultChecked={values.appointment_required} />
        <CheckboxField name="virtual_services" label="Virtual (phone or video) services are available from this location" state={state} defaultChecked={values.virtual_services} />
      </fieldset>

      <RadioGroupField
        name="status"
        legend="Location status"
        options={Object.entries(LOCATION_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
          description: value === "temporarily_closed" ? "Shown with a notice; use the hours note to explain when you'll reopen." : value === "closed" ? "Removed from maps and nearby search after review." : undefined,
        }))}
        state={state}
        defaultValue={values.status}
        required
      />

      <SourcesFields state={state} />
      <ModerationNote />
      <div>
        <SubmitButton pendingLabel="Submitting…">{targetId ? (replaces ? "Submit revised update for review" : "Submit update for review") : "Submit new location for review"}</SubmitButton>
      </div>
    </form>
  );
}
