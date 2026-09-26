"use client";

import { useActionState } from "react";
import {
  CheckboxField,
  FormMessages,
  RadioGroupField,
  RequiredNote,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/fields";
import { FormSection, SuccessPanel } from "@/components/community/form-parts";
import { PrivacyNotice } from "@/components/community/notices";
import { EXPERIENCE_LABELS, RATING_LABELS } from "@/lib/labels";
import { idle } from "@/lib/server/action-types";
import { submitFamilyReportAction } from "./actions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FIELD_LABELS = {
  serviceId: "Service",
  month: "Month",
  year: "Year",
  serviceType: "Type of service",
  experience: "Overall experience",
  accessibilityRating: "Accessibility",
  accessibilityNotes: "Accessibility notes",
  communicationRating: "Communication",
  comments: "Comments",
  email: "Email",
};

export function ExperienceForm({
  organizationId,
  organizationName,
  providerHref,
  services,
  signedIn,
  currentYear,
}: {
  organizationId: string;
  organizationName: string;
  providerHref: string;
  services: { value: string; label: string }[];
  signedIn: boolean;
  currentYear: number;
}) {
  const [state, action] = useActionState(submitFamilyReportAction, idle);

  if (state.status === "success") {
    const publish = state.data?.publish === true;
    return (
      <SuccessPanel
        title={state.message}
        actions={[
          { label: `Back to ${organizationName}`, href: providerHref },
          ...(signedIn ? [{ label: "View My Reports", href: "/account/reports", variant: "outline" as const }] : []),
        ]}
      >
        <p>Your report has been received and is now waiting for review by a MittenLink moderator.</p>
        <h3 className="text-lg font-bold">What happens next</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>A moderator reads every report before anything is shared. Reports that include private or identifying details are not published.</li>
          {publish ? (
            <li>You gave permission to publish. If approved, your report will appear on the provider&apos;s page without your name or contact details.</li>
          ) : (
            <li>You chose not to publish. Your report will be used only internally to help MittenLink keep listings accurate.</li>
          )}
          <li>If you shared an email address, we&apos;ll use it only if we need to ask a clarifying question.</li>
        </ul>
      </SuccessPanel>
    );
  }

  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={FIELD_LABELS} />
      <PrivacyNotice />
      <RequiredNote />
      <input type="hidden" name="organizationId" value={organizationId} />

      <FormSection title="About the service" description="Approximate details are fine. Please don't include names of staff or other families.">
        <p>
          <span className="font-semibold">Provider:</span> {organizationName}
        </p>
        {services.length > 0 && (
          <SelectField name="serviceId" label="Which service did you use?" options={services} placeholder="Not sure or not listed" state={state} />
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-semibold">
            Approximately when did you use this service? <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="month" label="Month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} placeholder="Choose a month" state={state} />
            <SelectField name="year" label="Year" options={years.map((y) => ({ value: y, label: y }))} placeholder="Choose a year" state={state} />
          </div>
        </fieldset>
        <TextField name="serviceType" label="Type of service" required hint="For example: speech therapy, respite care, job coaching, adaptive swimming." maxLength={200} state={state} />
      </FormSection>

      <FormSection title="Your experience">
        <RadioGroupField
          name="experience"
          legend="Overall, how was your experience?"
          required
          options={Object.entries(EXPERIENCE_LABELS).map(([value, label]) => ({ value, label }))}
          state={state}
        />
        <RadioGroupField
          name="accessibilityRating"
          legend="How accessible was the service?"
          hint="Think about the building, parking, communication access, sensory needs, or virtual options — whatever mattered to you."
          required
          options={Object.entries(RATING_LABELS).map(([value, label]) => ({ value, label }))}
          state={state}
        />
        <TextAreaField name="accessibilityNotes" label="Anything to share about accessibility?" rows={3} maxLength={1500} state={state} />
        <RadioGroupField
          name="communicationRating"
          legend="How was communication with the provider?"
          hint="For example: returning calls, explaining next steps, or offering interpreters."
          required
          options={Object.entries(RATING_LABELS)
            .filter(([value]) => value !== "not_applicable")
            .map(([value, label]) => ({ value, label }))}
          state={state}
        />
        <TextAreaField
          name="comments"
          label="Other comments"
          hint="What would be helpful for another family to know? Please don't describe diagnoses or health details."
          maxLength={3000}
          state={state}
        />
      </FormSection>

      <FormSection title="Sharing and follow-up">
        <CheckboxField
          name="publish"
          label="MittenLink may publish my report anonymously on this provider's page."
          hint="Published reports never include your name or email. If you leave this unchecked, your report is used only internally to help us keep listings accurate."
          state={state}
        />
        <TextField
          name="email"
          label="Your email"
          type="email"
          autoComplete="email"
          hint="Private. Only used if a moderator needs to ask a clarifying question."
          state={state}
        />
      </FormSection>

      <div>
        <SubmitButton pendingLabel="Sending report…" size="lg">
          Submit Report for Review
        </SubmitButton>
      </div>
    </form>
  );
}
