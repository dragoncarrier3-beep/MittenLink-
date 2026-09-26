"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { idle } from "@/lib/server/action-types";
import { FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { CheckboxGroup, ModerationNote, SourcesFields } from "@/components/provider/form-bits";
import type { Option } from "@/lib/data/provider";
import { submitOrganizationChange } from "../change-actions";

export interface OrganizationFormValues {
  title: string;
  summary: string;
  description: string;
  website: string;
  public_phone: string;
  public_email: string;
  accessibility_info: string;
  org_type: string;
  expanded_description: string;
  categories: string[];
  populations: string[];
  languages: string[];
}

export function OrganizationForm({
  values,
  replaces,
  isEnhanced,
  options,
  orgTypeOptions,
  fieldLabels,
}: {
  values: OrganizationFormValues;
  replaces: string | null;
  isEnhanced: boolean;
  options: { categories: Option[]; populations: Option[]; languages: Option[] };
  orgTypeOptions: Option[];
  fieldLabels: Record<string, string>;
}) {
  const [state, action] = useActionState(submitOrganizationChange, idle);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={{ ...fieldLabels, source_label: "Source description", source_url: "Source web address", note: "Note for the reviewer" }} />
      <RequiredNote />
      {replaces && <input type="hidden" name="replaces" value={replaces} />}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Basic information</legend>
        <TextField name="title" label="Organization name" required state={state} defaultValue={values.title} maxLength={160} autoComplete="organization" />
        <SelectField name="org_type" label="Organization type" state={state} defaultValue={values.org_type} options={orgTypeOptions} placeholder={null} />
        <TextAreaField
          name="summary"
          label="Short description"
          hint="One or two sentences shown in search results (up to 300 characters)."
          rows={3}
          maxLength={300}
          state={state}
          defaultValue={values.summary}
        />
        <div id="field-description" className="scroll-mt-28">
          <TextAreaField
            name="description"
            label="Full description"
            hint="What you do, who you serve, and how people can get started. Plain language works best."
            rows={8}
            maxLength={4000}
            state={state}
            defaultValue={values.description}
          />
        </div>
      </fieldset>

      <fieldset id="field-contact" className="flex scroll-mt-28 flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Public contact information</legend>
        <TextField name="website" label="Website" type="url" inputMode="url" placeholder="https://" state={state} defaultValue={values.website} maxLength={500} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="public_phone" label="Public phone" type="tel" inputMode="tel" autoComplete="tel" state={state} defaultValue={values.public_phone} maxLength={30} />
          <TextField name="public_email" label="Public email" type="email" inputMode="email" autoComplete="email" state={state} defaultValue={values.public_email} maxLength={200} />
        </div>
      </fieldset>

      <div id="field-accessibility" className="scroll-mt-28">
        <TextAreaField
          name="accessibility_info"
          label="Accessibility information"
          hint="For example: step-free entrance, elevator, accessible restrooms, ASL interpreters on request, sensory-friendly spaces."
          rows={5}
          maxLength={2000}
          state={state}
          defaultValue={values.accessibility_info}
        />
      </div>

      <CheckboxGroup id="field-categories" name="categories" legend="Service categories" options={options.categories} defaultValues={values.categories} state={state} columns={3} />
      <CheckboxGroup id="field-populations" name="populations" legend="Populations served" options={options.populations} defaultValues={values.populations} state={state} />
      <CheckboxGroup id="field-languages" name="languages" legend="Languages offered" options={options.languages} defaultValues={values.languages} state={state} columns={3} />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-enhanced/30 bg-enhanced-soft/40 p-4">
        <legend className="px-1 text-base font-semibold">Enhanced listing content</legend>
        {isEnhanced ? (
          <TextAreaField
            name="expanded_description"
            label="Expanded description"
            hint="Additional detail shown on your Enhanced Listing, such as program highlights or what to expect at a first visit."
            rows={8}
            maxLength={6000}
            state={state}
            defaultValue={values.expanded_description}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="expanded_description_locked" className="font-semibold">
              Expanded description <span className="text-sm font-normal text-muted-foreground">(Enhanced Listing feature)</span>
            </label>
            <textarea
              id="expanded_description_locked"
              disabled
              rows={3}
              aria-describedby="expanded-locked-hint"
              className="min-h-20 w-full rounded-lg border border-input bg-muted px-3 py-2 text-base"
              defaultValue=""
            />
            <p id="expanded-locked-hint" className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                An expanded description is available with MittenLink Enhanced. Your free listing already includes your full description, contact
                information, locations, services and full verification.{" "}
                <Link href="/provider/plan" className="font-semibold text-primary underline">
                  Compare listing plans
                </Link>
              </span>
            </p>
          </div>
        )}
      </fieldset>

      <SourcesFields state={state} />
      <ModerationNote />
      <div>
        <SubmitButton pendingLabel="Submitting…">{replaces ? "Submit revised update for review" : "Submit update for review"}</SubmitButton>
      </div>
    </form>
  );
}
