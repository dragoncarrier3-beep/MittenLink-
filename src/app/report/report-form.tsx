"use client";

import { useActionState } from "react";
import { FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { SuccessPanel } from "@/components/community/form-parts";
import { PrivacyNotice } from "@/components/community/notices";
import { CORRECTION_ISSUE_LABELS } from "@/lib/labels";
import { idle } from "@/lib/server/action-types";
import { submitCorrectionAction } from "./actions";

const ISSUE_OPTIONS = Object.entries(CORRECTION_ISSUE_LABELS).map(([value, label]) => ({ value, label }));

export function ReportForm({ listingId, listingTitle, listingHref, signedIn, defaultEmail }: { listingId: string; listingTitle: string; listingHref: string; signedIn: boolean; defaultEmail?: string | null }) {
  const [state, action] = useActionState(submitCorrectionAction, idle);

  if (state.status === "success") {
    return (
      <SuccessPanel
        title={state.message}
        actions={[
          { label: `Back to ${listingTitle}`, href: listingHref },
          ...(signedIn ? [{ label: "View My Reports", href: "/account/reports", variant: "outline" as const }] : [{ label: "Find Resources", href: "/search", variant: "outline" as const }]),
        ]}
      >
        <p>Thank you for helping keep MittenLink accurate for families across Michigan.</p>
        <h3 className="text-lg font-bold">What happens next</h3>
        <ol className="ml-5 list-decimal space-y-1">
          <li>A MittenLink resource verifier reviews your report, usually within a few business days.</li>
          <li>The verifier checks the information with the organization or an official source.</li>
          <li>If something needs to change, the listing is updated and its review date is refreshed.</li>
        </ol>
        {signedIn ? (
          <p>You can follow the status of your report in My Reports.</p>
        ) : (
          <p>If you shared an email address, we&apos;ll only use it if we need to ask you a follow-up question.</p>
        )}
      </SuccessPanel>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessages state={state} fieldLabels={{ issueType: "What's wrong", details: "Details", email: "Email" }} />
      <PrivacyNotice />
      <RequiredNote />
      <input type="hidden" name="listingId" value={listingId} />
      <SelectField name="issueType" label="What's wrong?" required options={ISSUE_OPTIONS} placeholder="Choose the type of problem" state={state} />
      <TextAreaField
        name="details"
        label="Details"
        required
        maxLength={4000}
        hint="Tell us what is out of date and, if you know it, the correct information. For example: “The phone number now goes to a different business. Their website lists (616) 555-0100.”"
        state={state}
      />
      <TextField
        name="email"
        label="Your email for follow-up questions"
        type="email"
        autoComplete="email"
        defaultValue={defaultEmail ?? undefined}
        hint="Private. Only MittenLink staff can see it, and we'll use it only if we need to ask about your report."
        state={state}
      />
      <div>
        <SubmitButton pendingLabel="Sending report…" size="lg">
          Send Report
        </SubmitButton>
      </div>
    </form>
  );
}
