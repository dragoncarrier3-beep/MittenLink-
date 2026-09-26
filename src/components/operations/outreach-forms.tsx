"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { OUTREACH_STATUS_LABELS } from "@/lib/labels";
import { createOutreachAction, logInteractionAction, sendClaimInvitationAction, updateOutreachAction } from "@/app/admin/outreach/actions";
import type { Option } from "@/lib/data/operations";

const statusOptions = Object.entries(OUTREACH_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const fieldLabels = { organization_id: "Organization", contact_name: "Contact name", email: "Email", phone: "Phone", status: "Outreach status", next_follow_up_at: "Next follow-up" };

export interface OutreachDefaults {
  id?: string;
  contact_name?: string;
  contact_role?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  next_follow_up_at?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
}

export function OutreachContactForm({ defaults, admins, organizations }: { defaults?: OutreachDefaults; admins: Option[]; organizations?: Option[] }) {
  const editing = !!defaults?.id;
  const [state, action] = useActionState(editing ? updateOutreachAction : createOutreachAction, idle);
  const d = defaults ?? {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessages state={state} fieldLabels={fieldLabels} />
      <RequiredNote />
      {editing && <input type="hidden" name="id" value={d.id} />}
      {!editing && organizations && <SelectField name="organization_id" label="Organization" required state={state} options={organizations} placeholder="Choose an organization" />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="contact_name" label="Contact name" required state={state} defaultValue={d.contact_name} autoComplete="off" />
        <TextField name="contact_role" label="Role" state={state} defaultValue={d.contact_role} autoComplete="off" />
        <TextField name="email" label="Email" type="email" state={state} defaultValue={d.email} autoComplete="off" />
        <TextField name="phone" label="Phone" type="tel" state={state} defaultValue={d.phone} autoComplete="off" />
        <SelectField name="status" label="Outreach status" required placeholder={null} state={state} options={statusOptions} defaultValue={d.status ?? "not_contacted"} />
        <TextField name="next_follow_up_at" label="Next follow-up" type="date" state={state} defaultValue={d.next_follow_up_at} />
      </div>
      <SelectField name="assigned_to" label="Assigned staff" state={state} options={admins} defaultValue={d.assigned_to ?? ""} placeholder="Unassigned" />
      <TextAreaField name="notes" label="Notes" rows={4} state={state} defaultValue={d.notes} hint="Staff only. Never shown publicly." />
      <div>
        <SubmitButton pendingLabel="Saving…">{editing ? "Save Changes" : "Add Outreach Contact"}</SubmitButton>
      </div>
    </form>
  );
}

export function InteractionForm({ id }: { id: string }) {
  const [state, action] = useActionState(logInteractionAction, idle);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ channel: "Channel", summary: "Summary" }} />
      <input type="hidden" name="id" value={id} />
      <SelectField
        name="channel"
        label="Channel"
        required
        state={state}
        options={[
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
          { value: "meeting", label: "Meeting" },
          { value: "mail", label: "Mail" },
          { value: "other", label: "Other" },
        ]}
      />
      <TextAreaField name="summary" label="Summary" required rows={3} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="status_after" label="Status after this contact" state={state} options={statusOptions} placeholder="Keep current status" />
        <TextField name="next_follow_up_at" label="Next follow-up" type="date" state={state} hint="Leave blank to keep the current date." />
      </div>
      <div>
        <SubmitButton pendingLabel="Logging…">Log Interaction</SubmitButton>
      </div>
    </form>
  );
}

export function ClaimInviteForm({ id, hasEmail }: { id: string; hasEmail: boolean }) {
  const [state, action] = useActionState(sendClaimInvitationAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} />
      <input type="hidden" name="id" value={id} />
      {!hasEmail && <p className="text-sm text-warning">Add an email address for this contact to send an invitation.</p>}
      <TextAreaField name="message" label="Personal note" rows={3} state={state} hint="Added to the invitation email and the interaction log." />
      <TextField name="next_follow_up_at" label="Follow up on" type="date" state={state} hint="Defaults to one week from today." />
      <div>
        <SubmitButton pendingLabel="Sending…">Send Claim Invitation</SubmitButton>
      </div>
    </form>
  );
}
