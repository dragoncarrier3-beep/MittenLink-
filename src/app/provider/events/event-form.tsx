"use client";

import { useActionState, useState } from "react";
import { idle, type ActionState } from "@/lib/server/action-types";
import { CheckboxField, FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { CheckboxGroup, ModerationNote, SourcesFields, SubmittedPanel } from "@/components/provider/form-bits";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import type { Option } from "@/lib/data/provider";
import { submitEventChange } from "../change-actions";

export interface EventFormValues {
  title: string;
  summary: string;
  description: string;
  event_type: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  venue_name: string;
  street: string;
  city: string;
  zip: string;
  is_in_person: boolean;
  virtual_available: boolean;
  registration_url: string;
  cost_text: string;
  is_free: boolean;
  accommodations: string;
  contact_email: string;
  contact_phone: string;
  categories: string[];
  populations: string[];
}

type Props = {
  targetId: string | null;
  values: EventFormValues;
  replaces: string | null;
  options: { categories: Option[]; populations: Option[] };
  fieldLabels: Record<string, string>;
};

export function EventForm(props: Props) {
  const [round, setRound] = useState(0);
  return <EventFormInner key={round} {...props} onAgain={() => setRound((r) => r + 1)} />;
}

function FormatError({ state }: { state: ActionState }) {
  const msg = state.status === "error" ? state.fieldErrors?.is_in_person : undefined;
  if (!msg) return null;
  return (
    <p className="text-sm font-semibold text-danger">
      <span className="sr-only">Error: </span>
      {msg}
    </p>
  );
}

function EventFormInner({ targetId, values, replaces, options, fieldLabels, onAgain }: Props & { onAgain: () => void }) {
  const [state, action] = useActionState(submitEventChange, idle);
  if (!targetId && state.status === "success") {
    return <SubmittedPanel state={state} backHref="/provider/events" backLabel="Back to events" againLabel="Add another event" onAgain={onAgain} />;
  }
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages
        state={state}
        fieldLabels={{
          ...fieldLabels,
          start_date: "Start date",
          start_time: "Start time",
          end_date: "End date",
          end_time: "End time",
          is_in_person: "Event format",
          source_label: "Source description",
          source_url: "Source web address",
          note: "Note for the reviewer",
        }}
      />
      <RequiredNote />
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      {replaces && <input type="hidden" name="replaces" value={replaces} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">About this event</legend>
        <TextField name="title" label="Event name" required state={state} defaultValue={values.title} maxLength={160} />
        <SelectField
          name="event_type"
          label="Event type"
          state={state}
          defaultValue={values.event_type}
          placeholder={null}
          options={Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <TextAreaField name="summary" label="Short description" required hint="One or two sentences (up to 300 characters)." rows={3} maxLength={300} state={state} defaultValue={values.summary} />
        <TextAreaField name="description" label="Full description" rows={5} maxLength={4000} state={state} defaultValue={values.description} />
      </fieldset>

      <fieldset className="flex flex-col gap-4" aria-describedby="event-time-hint">
        <legend className="mb-2 text-xl font-bold">Date and time</legend>
        <p id="event-time-hint" className="text-sm text-muted-foreground">
          Enter Michigan (Eastern) time. Daylight saving time is handled automatically.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="start_date" label="Start date" type="date" required state={state} defaultValue={values.start_date} />
          <TextField name="start_time" label="Start time" type="time" required state={state} defaultValue={values.start_time} />
          <TextField name="end_date" label="End date" type="date" hint="Leave blank if the event ends the same day." state={state} defaultValue={values.end_date} />
          <TextField name="end_time" label="End time" type="time" required state={state} defaultValue={values.end_time} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-semibold">Event format</legend>
        <FormatError state={state} />
        <CheckboxField name="is_in_person" label="In person" state={state} defaultChecked={values.is_in_person} />
        <CheckboxField name="virtual_available" label="Online" state={state} defaultChecked={values.virtual_available} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Venue</legend>
        <TextField name="venue_name" label="Venue name" state={state} defaultValue={values.venue_name} maxLength={160} />
        <TextField name="street" label="Street address" state={state} defaultValue={values.street} maxLength={200} />
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField name="city" label="City" state={state} defaultValue={values.city} maxLength={80} />
          <TextField name="zip" label="ZIP code" inputMode="numeric" state={state} defaultValue={values.zip} maxLength={5} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Registration and accessibility</legend>
        <TextField name="registration_url" label="Registration link" type="url" inputMode="url" placeholder="https://" state={state} defaultValue={values.registration_url} maxLength={500} />
        <CheckboxField name="is_free" label="This event is free" state={state} defaultChecked={values.is_free} />
        <TextField name="cost_text" label="Cost details" state={state} defaultValue={values.cost_text} maxLength={200} />
        <TextAreaField
          name="accommodations"
          label="Accessibility accommodations"
          hint="For example ASL interpretation, captioning, quiet room, or how to request accommodations."
          rows={3}
          maxLength={1000}
          state={state}
          defaultValue={values.accommodations}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="contact_phone" label="Contact phone" type="tel" inputMode="tel" state={state} defaultValue={values.contact_phone} maxLength={30} />
          <TextField name="contact_email" label="Contact email" type="email" inputMode="email" state={state} defaultValue={values.contact_email} maxLength={200} />
        </div>
      </fieldset>

      <CheckboxGroup name="categories" legend="Categories" options={options.categories} defaultValues={values.categories} state={state} columns={3} />
      <CheckboxGroup name="populations" legend="Populations served" options={options.populations} defaultValues={values.populations} state={state} />

      <SourcesFields state={state} />
      <ModerationNote />
      <div>
        <SubmitButton pendingLabel="Submitting…">{targetId ? (replaces ? "Submit revised update for review" : "Submit update for review") : "Submit new event for review"}</SubmitButton>
      </div>
    </form>
  );
}
