"use client";

import { useActionState } from "react";
import { FormMessages, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { assignGapResearchAction, createGapTaskAction } from "@/app/admin/search-analytics/actions";
import type { Option } from "@/lib/data/operations";

export function GapTaskForm({ flagId, defaultTitle, staff }: { flagId: string; defaultTitle: string; staff: Option[] }) {
  const [state, action] = useActionState(createGapTaskAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ title: "Task title" }} />
      <input type="hidden" name="flag_id" value={flagId} />
      <TextField name="title" label="Task title" required state={state} defaultValue={defaultTitle} maxLength={200} />
      <TextAreaField name="details" label="Details" rows={3} state={state} hint="Which sources to check, who to call, what to look for." />
      <SelectField name="assigned_to" label="Assign to" state={state} options={staff} placeholder="Unassigned" />
      <div>
        <SubmitButton pendingLabel="Creating task…">Create Source Watch Task</SubmitButton>
      </div>
    </form>
  );
}

export function AssignResearchForm({ flagId, staff, current, title }: { flagId: string; staff: Option[]; current: string | null; title: string }) {
  const [state, action] = useActionState(assignGapResearchAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3" aria-label={`Assign research: ${title}`}>
      <FormMessages state={state} fieldLabels={{ assigned_to: "Staff member" }} />
      <input type="hidden" name="flag_id" value={flagId} />
      <SelectField name="assigned_to" label="Staff member" required state={state} options={staff} defaultValue={current ?? ""} placeholder="Choose a staff member" />
      <div>
        <SubmitButton variant="outline" pendingLabel="Assigning…">
          Assign Research<span className="sr-only">: {title}</span>
        </SubmitButton>
      </div>
    </form>
  );
}
