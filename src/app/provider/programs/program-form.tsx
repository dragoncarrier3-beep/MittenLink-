"use client";

import { useActionState, useState } from "react";
import { idle } from "@/lib/server/action-types";
import { CheckboxField, FormMessages, RequiredNote, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { CheckboxGroup, ModerationNote, SourcesFields, SubmittedPanel } from "@/components/provider/form-bits";
import type { Option } from "@/lib/data/provider";
import { submitProgramChange } from "../change-actions";

export interface ProgramFormValues {
  title: string;
  summary: string;
  description: string;
  eligibility: string;
  cost_text: string;
  is_free: boolean;
  application_instructions: string;
  start_date: string;
  end_date: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  virtual_available: boolean;
  categories: string[];
  populations: string[];
}

type Props = {
  targetId: string | null;
  values: ProgramFormValues;
  replaces: string | null;
  options: { categories: Option[]; populations: Option[] };
  fieldLabels: Record<string, string>;
};

export function ProgramForm(props: Props) {
  const [round, setRound] = useState(0);
  return <ProgramFormInner key={round} {...props} onAgain={() => setRound((r) => r + 1)} />;
}

function ProgramFormInner({ targetId, values, replaces, options, fieldLabels, onAgain }: Props & { onAgain: () => void }) {
  const [state, action] = useActionState(submitProgramChange, idle);
  if (!targetId && state.status === "success") {
    return <SubmittedPanel state={state} backHref="/provider/programs" backLabel="Back to programs" againLabel="Add another program" onAgain={onAgain} />;
  }
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={{ ...fieldLabels, source_label: "Source description", source_url: "Source web address", note: "Note for the reviewer" }} />
      <RequiredNote />
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      {replaces && <input type="hidden" name="replaces" value={replaces} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">About this program</legend>
        <TextField name="title" label="Program name" required state={state} defaultValue={values.title} maxLength={160} />
        <TextAreaField name="summary" label="Short description" required hint="One or two sentences shown in search results (up to 300 characters)." rows={3} maxLength={300} state={state} defaultValue={values.summary} />
        <TextAreaField name="description" label="Full description" rows={6} maxLength={4000} state={state} defaultValue={values.description} />
        <TextAreaField name="eligibility" label="Eligibility" hint="Who can take part, in plain language." rows={3} maxLength={1000} state={state} defaultValue={values.eligibility} />
        <TextAreaField name="application_instructions" label="How to apply" rows={3} maxLength={2000} state={state} defaultValue={values.application_instructions} />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Dates and cost</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="start_date" label="Start date" type="date" hint="Leave blank for ongoing programs." state={state} defaultValue={values.start_date} />
          <TextField name="end_date" label="End date" type="date" hint="Leave blank if there is no end date." state={state} defaultValue={values.end_date} />
        </div>
        <CheckboxField name="is_free" label="This program is free" state={state} defaultChecked={values.is_free} />
        <TextField name="cost_text" label="Cost details" hint="For example “$25 per session; scholarships available”." state={state} defaultValue={values.cost_text} maxLength={200} />
        <CheckboxField name="virtual_available" label="Participants can join virtually" state={state} defaultChecked={values.virtual_available} />
      </fieldset>

      <CheckboxGroup name="categories" legend="Categories" options={options.categories} defaultValues={values.categories} state={state} columns={3} />
      <CheckboxGroup name="populations" legend="Populations served" options={options.populations} defaultValues={values.populations} state={state} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Contact</legend>
        <TextField name="website" label="Program web page" type="url" inputMode="url" placeholder="https://" state={state} defaultValue={values.website} maxLength={500} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="contact_phone" label="Contact phone" type="tel" inputMode="tel" state={state} defaultValue={values.contact_phone} maxLength={30} />
          <TextField name="contact_email" label="Contact email" type="email" inputMode="email" state={state} defaultValue={values.contact_email} maxLength={200} />
        </div>
      </fieldset>

      <SourcesFields state={state} />
      <ModerationNote />
      <div>
        <SubmitButton pendingLabel="Submitting…">{targetId ? (replaces ? "Submit revised update for review" : "Submit update for review") : "Submit new program for review"}</SubmitButton>
      </div>
    </form>
  );
}
