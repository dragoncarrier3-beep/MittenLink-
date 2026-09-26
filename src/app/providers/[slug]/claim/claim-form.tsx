"use client";

import { useActionState } from "react";
import { FormMessages, RadioGroupField, RequiredNote, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { FormSection } from "@/components/community/form-parts";
import { CLAIM_RELATIONSHIP_LABELS } from "@/lib/labels";
import { idle } from "@/lib/server/action-types";
import { saveClaimAction } from "./actions";

export interface ClaimDefaults {
  relationship?: string;
  claimantName?: string;
  claimantTitle?: string;
  workEmail?: string;
  workPhone?: string;
  verificationDetails?: string;
  evidenceUrl?: string;
}

const LABELS = {
  relationship: "Relationship",
  claimantName: "Your name",
  claimantTitle: "Your title",
  workEmail: "Work email",
  workPhone: "Work phone",
  verificationDetails: "How we can confirm your role",
  evidenceUrl: "Evidence link",
};

export function ClaimForm({
  organizationId,
  slug,
  organizationName,
  websiteDomain,
  defaults,
  resubmitting,
}: {
  organizationId: string;
  slug: string;
  organizationName: string;
  websiteDomain: string | null;
  defaults: ClaimDefaults;
  resubmitting: boolean;
}) {
  const [state, action] = useActionState(saveClaimAction, idle);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={LABELS} />
      <RequiredNote />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />

      <FormSection title="Your connection to the organization">
        <RadioGroupField
          name="relationship"
          legend={`What is your relationship to ${organizationName}?`}
          required
          options={Object.entries(CLAIM_RELATIONSHIP_LABELS).map(([value, label]) => ({ value, label }))}
          defaultValue={defaults.relationship}
          state={state}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="claimantName" label="Your name" required autoComplete="name" maxLength={120} defaultValue={defaults.claimantName} state={state} />
          <TextField name="claimantTitle" label="Your title" required autoComplete="organization-title" maxLength={120} defaultValue={defaults.claimantTitle} state={state} />
        </div>
      </FormSection>

      <FormSection title="How to reach you" description="MittenLink uses this to confirm your role. It is never shown publicly.">
        <TextField
          name="workEmail"
          label="Work email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaults.workEmail}
          hint={
            websiteDomain
              ? `An email address ending in @${websiteDomain} usually speeds up review.`
              : "An email address on your organization's own domain usually speeds up review."
          }
          state={state}
        />
        <TextField name="workPhone" label="Work phone" type="tel" autoComplete="tel" defaultValue={defaults.workPhone} state={state} />
      </FormSection>

      <FormSection title="Verification information">
        <TextAreaField
          name="verificationDetails"
          label="How can we confirm your role?"
          required
          maxLength={3000}
          defaultValue={defaults.verificationDetails}
          hint="For example: your name appears on the staff page of our website, or our executive director can confirm your role at the main office number."
          state={state}
        />
        <TextField
          name="evidenceUrl"
          label="Link that shows your role"
          type="url"
          inputMode="url"
          defaultValue={defaults.evidenceUrl}
          hint="For example, a staff directory or board page. Start with https://"
          state={state}
        />
      </FormSection>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton name="intent" value="submit" size="lg" pendingLabel="Submitting…">
          {resubmitting ? "Resubmit Claim" : "Submit Claim"}
        </SubmitButton>
        <SubmitButton name="intent" value="draft" size="lg" variant="outline" pendingLabel="Saving…">
          Save Draft
        </SubmitButton>
      </div>
      <p className="text-sm text-muted-foreground">Drafts are private. MittenLink only reviews your claim after you submit it.</p>
    </form>
  );
}
