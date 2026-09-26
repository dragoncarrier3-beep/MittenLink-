"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckboxField, FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle, type ActionState } from "@/lib/server/action-types";
import { ORG_TYPE_LABELS } from "@/lib/labels";
import { CONFIDENCE_LABELS, CONTACT_KIND_LABELS, CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS, optionsFrom } from "./admin-labels";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface OrgEditDefaults {
  id: string;
  title: string;
  summary: string;
  description: string;
  orgType: string;
  website: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  accessibilityInfo: string | null;
}

/** Admin direct edit of core organization fields (audited as provider.edited). */
export function OrgEditForm({ action, defaults }: { action: Action; defaults: OrgEditDefaults }) {
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessages
        state={state}
        fieldLabels={{ title: "Organization name", summary: "Summary", description: "Description", orgType: "Organization type", website: "Website", publicPhone: "Public phone", publicEmail: "Public email", accessibilityInfo: "Accessibility information" }}
      />
      <RequiredNote />
      <input type="hidden" name="id" value={defaults.id} />
      <TextField name="title" label="Organization name" required maxLength={200} defaultValue={defaults.title} state={state} />
      <SelectField name="orgType" label="Organization type" required options={optionsFrom(ORG_TYPE_LABELS)} defaultValue={defaults.orgType} placeholder={null} state={state} />
      <TextAreaField name="summary" label="Summary" hint="One or two sentences shown in search results." rows={2} required maxLength={400} defaultValue={defaults.summary} state={state} />
      <TextAreaField name="description" label="Description" rows={6} maxLength={8000} defaultValue={defaults.description} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="website" label="Website" type="url" hint="Starts with https://" defaultValue={defaults.website} state={state} />
        <TextField name="publicPhone" label="Public phone" type="tel" defaultValue={defaults.publicPhone} state={state} />
      </div>
      <TextField name="publicEmail" label="Public email" type="email" defaultValue={defaults.publicEmail} state={state} />
      <TextAreaField name="accessibilityInfo" label="Accessibility information" rows={3} maxLength={4000} defaultValue={defaults.accessibilityInfo} state={state} />
      <div>
        <SubmitButton pendingLabel="Saving…">Save Organization</SubmitButton>
      </div>
    </form>
  );
}

export interface ContactDefaults {
  contactId?: string;
  kind?: string;
  label?: string | null;
  value?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  confidence?: string;
  status?: string;
  isPublic?: boolean;
}

/** Add or edit a contact provenance record. */
export function ContactProvenanceForm({ action, organizationId, defaults = {} }: { action: Action; organizationId: string; defaults?: ContactDefaults }) {
  const [state, formAction] = useActionState(action, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const editing = !!defaults.contactId;
  useEffect(() => {
    if (state.status === "success" && !editing) formRef.current?.reset();
  }, [state, editing]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ kind: "Type", value: "Value", sourceType: "Source type", sourceUrl: "Source URL", confidence: "Confidence", status: "Status" }} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {editing && <input type="hidden" name="contactId" value={defaults.contactId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="kind" label="Type" required options={optionsFrom(CONTACT_KIND_LABELS)} defaultValue={defaults.kind ?? "phone"} placeholder={null} state={state} />
        <TextField name="label" label="Label" hint='e.g. "Main office" or "Intake line"' defaultValue={defaults.label} state={state} />
      </div>
      <TextField name="value" label="Value" required defaultValue={defaults.value} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="sourceType" label="Source type" required options={optionsFrom(CONTACT_SOURCE_LABELS)} defaultValue={defaults.sourceType ?? "official_website"} placeholder={null} state={state} />
        <TextField name="sourceUrl" label="Source URL" type="url" hint="Where this was found. Starts with https://" defaultValue={defaults.sourceUrl} state={state} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="confidence" label="Confidence" required options={optionsFrom(CONFIDENCE_LABELS)} defaultValue={defaults.confidence ?? "medium"} placeholder={null} state={state} />
        <SelectField name="status" label="Status" required options={optionsFrom(CONTACT_STATUS_LABELS)} defaultValue={defaults.status ?? "active"} placeholder={null} state={state} />
      </div>
      <CheckboxField name="isPublic" label="Show this contact publicly" defaultChecked={defaults.isPublic ?? true} state={state} />
      <CheckboxField name="markVerified" label="I confirmed this today — record me as the verifier" state={state} />
      <div>
        <SubmitButton variant={editing ? "outline" : "default"} pendingLabel="Saving…">
          {editing ? "Save Contact Record" : "Add Contact Record"}
        </SubmitButton>
      </div>
    </form>
  );
}
