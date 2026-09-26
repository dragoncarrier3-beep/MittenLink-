"use client";

import { useActionState } from "react";
import { CheckboxField, FormMessages, RadioGroupField, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { CheckboxGroupField, FormSection } from "@/components/community/form-parts";
import { PrivacyNotice } from "@/components/community/notices";
import { CLAIM_RELATIONSHIP_LABELS, ORG_TYPE_LABELS } from "@/lib/labels";
import { idle } from "@/lib/server/action-types";
import { submitOrganizationAction } from "./actions";

type Option = { value: string; label: string };

const LABELS: Record<string, string> = {
  name: "Organization name",
  orgType: "Type of organization",
  description: "Description",
  website: "Website",
  publicPhone: "Public phone",
  publicEmail: "Public email",
  locationName: "Location name",
  street: "Street address",
  city: "City",
  zip: "ZIP code",
  "categories[]": "Categories",
  accessibility: "Accessibility information",
  submitterName: "Your name",
  submitterTitle: "Your title",
  submitterEmail: "Your email",
  relationship: "Relationship",
  authorized: "Authorization",
};

export function OrganizationForm({
  categories,
  populations,
  languages,
  user,
}: {
  categories: Option[];
  populations: Option[];
  languages: Option[];
  user: { name: string; title: string; email: string };
}) {
  const [state, action] = useActionState(submitOrganizationAction, idle);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={LABELS} />
      <RequiredNote />

      <FormSection title="1. About the organization" id="section-about">
        <TextField name="name" label="Organization name" required autoComplete="organization" maxLength={160} state={state} />
        <SelectField
          name="orgType"
          label="Type of organization"
          required
          options={Object.entries(ORG_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          placeholder="Choose a type"
          state={state}
        />
        <TextAreaField
          name="description"
          label="Description"
          required
          maxLength={4000}
          rows={6}
          hint="In plain language: who you serve, what you offer, and how people can get started. The first sentence is used as your listing summary."
          state={state}
        />
      </FormSection>

      <FormSection title="2. Public contact information" description="This is shown on your public listing once it's approved. Add at least one.">
        <TextField name="website" label="Website" type="url" inputMode="url" hint="Start with https://" state={state} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="publicPhone" label="Public phone" type="tel" autoComplete="tel" state={state} />
          <TextField name="publicEmail" label="Public email" type="email" hint="A general inbox, like info@…" state={state} />
        </div>
      </FormSection>

      <FormSection title="3. Primary location" description="Your main office or the place people visit. You can add more locations after your listing is approved.">
        <TextField name="locationName" label="Location name" hint="For example: Main Office or Downtown Clinic." maxLength={120} state={state} />
        <TextField name="street" label="Street address" required autoComplete="street-address" maxLength={200} state={state} />
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <TextField name="city" label="City" required autoComplete="address-level2" maxLength={120} state={state} />
          <TextField name="zip" label="ZIP code" required autoComplete="postal-code" inputMode="numeric" maxLength={5} hint="5 digits" state={state} />
        </div>
        <p className="text-sm text-muted-foreground">State: Michigan. MittenLink lists organizations that serve people in Michigan.</p>
        <CheckboxField name="virtual" label="We also offer services by phone or video." state={state} />
      </FormSection>

      <FormSection title="4. Services and who you serve">
        <CheckboxGroupField name="categories" legend="Categories" required options={categories} hint="Choose every category that fits your main services." columns={3} state={state} />
        <CheckboxGroupField name="populations" legend="Who do you serve?" options={populations} columns={3} state={state} />
        <CheckboxGroupField name="languages" legend="Languages offered" options={languages} columns={3} state={state} />
        <TextAreaField
          name="accessibility"
          label="Accessibility information"
          rows={4}
          maxLength={2000}
          hint="For example: step-free entrance, accessible parking, ASL interpreters on request, quiet waiting room, large-print materials."
          state={state}
        />
      </FormSection>

      <FormSection title="5. About you" description="Only MittenLink staff see this. We may contact you to confirm the listing.">
        <PrivacyNotice />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="submitterName" label="Your name" required autoComplete="name" defaultValue={user.name} maxLength={120} state={state} />
          <TextField name="submitterTitle" label="Your title" required autoComplete="organization-title" defaultValue={user.title} maxLength={120} state={state} />
        </div>
        <TextField
          name="submitterEmail"
          label="Your email"
          type="email"
          required
          autoComplete="email"
          defaultValue={user.email}
          hint="An email on your organization's domain helps us confirm the listing faster."
          state={state}
        />
        <RadioGroupField
          name="relationship"
          legend="Your relationship to the organization"
          required
          options={Object.entries(CLAIM_RELATIONSHIP_LABELS).map(([value, label]) => ({ value, label }))}
          state={state}
        />
        <CheckboxField
          name="requestManagement"
          defaultChecked
          label="I'd like to manage this listing after it's approved."
          hint="We'll create a management request for you. Administrators confirm your role before granting access."
          state={state}
        />
        <CheckboxField
          name="authorized"
          label={
            <>
              I&apos;m authorized to represent this organization, and the information above is accurate. <span className="text-danger">*</span>
              <span className="sr-only">(required)</span>
            </>
          }
          state={state}
        />
      </FormSection>

      <div className="flex flex-col gap-2">
        <SubmitButton size="lg" pendingLabel="Submitting…">
          Submit for Review
        </SubmitButton>
        <p className="text-sm text-muted-foreground">Your listing stays private until a MittenLink verifier reviews and approves it.</p>
      </div>
    </form>
  );
}
