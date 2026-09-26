"use client";

import { useActionState } from "react";
import { FormMessages, RadioGroupField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { resolveTaskAction } from "../../actions";

const METHOD_OPTIONS = [
  { value: "provider_confirmation", label: "Provider confirmation", description: "An authorized representative confirmed the information." },
  { value: "official_website", label: "Official website", description: "Checked against the organization's own website." },
  { value: "government_source", label: "Government source", description: "Checked against a public government listing or directory." },
  { value: "phone_confirmation", label: "Phone confirmation", description: "Confirmed by calling the organization." },
  { value: "email_confirmation", label: "Email confirmation", description: "Confirmed by email with the organization." },
  { value: "manual_research", label: "Manual research", description: "Reviewed using other public sources." },
];

const SOURCE_OPTIONS = [
  { value: "official_website", label: "Official website" },
  { value: "government_source", label: "Government source" },
  { value: "provider_confirmation", label: "Provider confirmation" },
  { value: "phone_confirmation", label: "Phone confirmation" },
  { value: "email_confirmation", label: "Email confirmation" },
  { value: "manual_research", label: "Manual research" },
  { value: "other", label: "Other" },
];

const SOURCE_ROWS = 3;

const FIELD_LABELS: Record<string, string> = {
  method: "Verification method",
  publicSummary: "Public summary",
  internalNotes: "Internal notes",
  messageToProvider: "Message to provider",
  intent: "Action",
  ...Object.fromEntries(Array.from({ length: SOURCE_ROWS }, (_, i) => [`sourceUrl_${i}`, `Source ${i + 1} web address`])),
};

export function VerificationForm({
  taskId,
  hasChangeRequest,
  isEscalated,
  returnTo,
  defaultSourceUrl,
}: {
  taskId: string;
  hasChangeRequest: boolean;
  isEscalated: boolean;
  returnTo: string;
  defaultSourceUrl?: string | null;
}) {
  const [state, action] = useActionState(resolveTaskAction, idle);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessages state={state} fieldLabels={FIELD_LABELS} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <RadioGroupField
        name="method"
        legend="Verification method"
        hint="Required when you verify or mark the record unable to verify."
        options={METHOD_OPTIONS}
        state={state}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">
          Sources checked <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </legend>
        <p className="-mt-2 text-sm text-muted-foreground">Record up to three sources you checked. Sources are stored with the verification history and visible to staff only.</p>
        {Array.from({ length: SOURCE_ROWS }, (_, i) => (
          <fieldset key={i} className="grid gap-3 rounded-lg border bg-muted/40 p-4 md:grid-cols-[minmax(10rem,14rem)_1fr]">
            <legend className="px-1 text-sm font-bold">Source {i + 1}</legend>
            <SelectField name={`sourceType_${i}`} label="Source type" options={SOURCE_OPTIONS} placeholder={null} defaultValue={i === 0 ? "official_website" : "other"} state={state} />
            <TextField
              name={`sourceUrl_${i}`}
              label="Web address"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={i === 0 ? defaultSourceUrl ?? "" : ""}
              state={state}
            />
            <TextField name={`sourceDescription_${i}`} label="What you checked" className="md:col-span-2" placeholder="For example: Contact page, called main line" state={state} />
          </fieldset>
        ))}
      </fieldset>

      <TextAreaField
        name="publicSummary"
        label="Public summary"
        rows={3}
        maxLength={500}
        hint="Shown on the public listing's verification history. Leave blank to use the standard wording for your method and outcome — for example, “Information reviewed against the organization's official website.” Never include private details."
        state={state}
      />
      <TextAreaField
        name="internalNotes"
        label="Internal notes"
        rows={3}
        maxLength={4000}
        hint="Private to MittenLink staff. Required when escalating — explain what an administrator needs to decide."
        state={state}
      />
      <TextAreaField
        name="messageToProvider"
        label="Message to provider"
        rows={3}
        maxLength={2000}
        hint={
          hasChangeRequest
            ? "Required for Request Update and Reject Change. Sent to the provider who submitted the update. Optional note when approving."
            : "Required for Request Update. Sent to the organization's managers on MittenLink."
        }
        state={state}
      />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">What each action does</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>{hasChangeRequest ? "Approve & Publish Update" : "Verify"}</strong> —{" "}
            {hasChangeRequest ? "publishes the provider's proposed changes and marks the record Verified." : "marks the record Verified and schedules the next review."}
          </li>
          <li>
            <strong>Request Update</strong> — marks the record Needs Update and asks the organization to confirm details.
          </li>
          <li>
            <strong>Mark Unable to Verify</strong> — tells the public the information could not be confirmed.
          </li>
          {!isEscalated && (
            <li>
              <strong>Escalate to Admin</strong> — sends the task to administrators for a decision (no public change).
            </li>
          )}
          {hasChangeRequest && (
            <li>
              <strong>Reject Change</strong> — declines the provider's update; the public record stays as it is.
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton name="intent" value="verify" pendingLabel="Saving…">
          {hasChangeRequest ? "Approve & Publish Update" : "Verify"}
        </SubmitButton>
        <SubmitButton name="intent" value="request_update" variant="outline" pendingLabel="Saving…">
          Request Update
        </SubmitButton>
        <SubmitButton name="intent" value="unable_to_verify" variant="outline" pendingLabel="Saving…">
          Mark Unable to Verify
        </SubmitButton>
        {!isEscalated && (
          <SubmitButton name="intent" value="escalate" variant="outline" pendingLabel="Saving…">
            Escalate to Admin
          </SubmitButton>
        )}
        {hasChangeRequest && (
          <SubmitButton name="intent" value="reject_change" variant="destructive" pendingLabel="Saving…">
            Reject Change
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
