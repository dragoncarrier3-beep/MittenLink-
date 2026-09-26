"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckboxField, FormMessages, RadioGroupField, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { SOURCE_TYPE_LABELS } from "@/lib/labels";
import {
  addCandidateAction,
  createResearchTaskAction,
  importCandidateAction,
  saveSourceAction,
  updateCandidateFieldsAction,
  updateResearchTaskAction,
} from "@/app/admin/source-watch/actions";
import type { Option } from "@/lib/data/operations";

const sourceTypeOptions = Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export interface SourceDefaults {
  id?: string;
  name?: string;
  url?: string;
  source_type?: string;
  coverage?: string;
  county_id?: number | null;
  is_statewide?: boolean;
  check_frequency_days?: number;
  status?: string;
  automated_checks_authorized?: boolean;
  notes?: string | null;
}

export function SourceForm({ defaults, counties }: { defaults?: SourceDefaults; counties: Option[] }) {
  const [state, action] = useActionState(saveSourceAction, idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  const d = defaults ?? {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessages state={state} fieldLabels={{ name: "Source name", url: "Web address", source_type: "Source type", coverage: "Geographic coverage", check_frequency_days: "Check frequency", status: "Status", automated_checks_authorized: "Automated checks" }} />
      <RequiredNote />
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <TextField name="name" label="Source name" required state={state} defaultValue={d.name} maxLength={200} />
      <TextField name="url" label="Web address" type="url" required state={state} defaultValue={d.url} hint="The public page staff review, starting with https://" />
      <SelectField name="source_type" label="Source type" required state={state} options={sourceTypeOptions} defaultValue={d.source_type} />
      <TextField name="coverage" label="Geographic coverage" required state={state} defaultValue={d.coverage} hint='For example "Statewide", "Kent County", or "Upper Peninsula".' />
      <SelectField name="county_id" label="Primary county" state={state} options={counties} defaultValue={d.county_id ? String(d.county_id) : ""} placeholder="No single county" />
      <CheckboxField name="is_statewide" label="This source covers all of Michigan" state={state} defaultChecked={d.is_statewide} />
      <TextField name="check_frequency_days" label="Check frequency (days)" type="number" inputMode="numeric" required state={state} defaultValue={String(d.check_frequency_days ?? 30)} hint="How often a staff member should review this source." />
      <SelectField
        name="status"
        label="Status"
        required
        placeholder={null}
        state={state}
        defaultValue={d.status ?? "active"}
        options={[
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
          { value: "needs_attention", label: "Needs attention" },
        ]}
      />
      <RadioGroupField
        name="automated_checks_authorized"
        legend="Automated checks authorized?"
        required
        state={state}
        defaultValue={d.automated_checks_authorized ? "yes" : "no"}
        hint="Choose Yes only when the source owner has given MittenLink written permission (for example, a data-sharing agreement or a provided feed). MittenLink does not scrape websites."
        options={[
          { value: "no", label: "No — staff check this source manually" },
          { value: "yes", label: "Yes — the source owner has authorized automated retrieval" },
        ]}
      />
      <TextAreaField name="notes" label="Notes" rows={3} state={state} defaultValue={d.notes} />
      <div>
        <SubmitButton pendingLabel="Saving source…">{d.id ? "Save Changes" : "Add Source"}</SubmitButton>
      </div>
    </form>
  );
}

export function ManualCandidateForm({ sources, categories, counties, defaultSourceId }: { sources: Option[]; categories: Option[]; counties: Option[]; defaultSourceId?: string }) {
  const [state, action] = useActionState(addCandidateAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessages state={state} fieldLabels={{ name: "Resource name", url: "Web address", source_id: "Source" }} />
      <RequiredNote />
      <SelectField name="source_id" label="Where did you find it?" state={state} options={sources} defaultValue={defaultSourceId ?? ""} placeholder="Other / not a watched source" />
      <TextField name="name" label="Resource name" required state={state} maxLength={200} />
      <TextField name="url" label="Web address" type="url" state={state} hint="The page describing this resource, starting with https://" />
      <TextAreaField name="excerpt" label="Excerpt from the source" rows={5} state={state} maxLength={4000} hint="Paste the short description you read on the source (including any phone number or address). This helps the suggestions and the reviewer." />
      <SelectField name="suggested_category_id" label="Possible category" state={state} options={categories} placeholder="Not sure yet" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="possible_city" label="Possible city" state={state} autoComplete="off" />
        <SelectField name="possible_county_id" label="Possible county" state={state} options={counties} placeholder="Not sure yet" />
      </div>
      <div>
        <SubmitButton pendingLabel="Adding candidate…">Add Candidate</SubmitButton>
      </div>
    </form>
  );
}

export function ReviewFieldsForm({ id, categories, counties, defaults }: { id: string; categories: Option[]; counties: Option[]; defaults: { categoryId: number | null; city: string | null; countyId: number | null } }) {
  const [state, action] = useActionState(updateCandidateFieldsAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} />
      <input type="hidden" name="id" value={id} />
      <SelectField name="suggested_category_id" label="Category" state={state} options={categories} defaultValue={defaults.categoryId ? String(defaults.categoryId) : ""} placeholder="Not set" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="possible_city" label="City" state={state} defaultValue={defaults.city} />
        <SelectField name="possible_county_id" label="County" state={state} options={counties} defaultValue={defaults.countyId ? String(defaults.countyId) : ""} placeholder="Not set" />
      </div>
      <div>
        <SubmitButton variant="outline" pendingLabel="Saving…">Save Review Details</SubmitButton>
      </div>
    </form>
  );
}

export function ImportForm({ id, name, categories, counties, defaults }: { id: string; name: string; categories: Option[]; counties: Option[]; defaults: { categoryId: number | null; countyId: number | null } }) {
  const [state, action] = useActionState(importCandidateAction, idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ kind: "Record type", title: "Record name" }} />
      <input type="hidden" name="id" value={id} />
      <RadioGroupField
        name="kind"
        legend="Create as"
        required
        state={state}
        defaultValue="organization"
        options={[
          { value: "organization", label: "Organization (provider)", description: "An agency, nonprofit, or provider that offers services." },
          { value: "program", label: "Program", description: "A specific program or initiative." },
        ]}
      />
      <TextField name="title" label="Record name" required state={state} defaultValue={name} maxLength={200} />
      <SelectField name="category_id" label="Category" state={state} options={categories} defaultValue={defaults.categoryId ? String(defaults.categoryId) : ""} placeholder="No category yet" />
      <SelectField name="county_id" label="County served" state={state} options={counties} defaultValue={defaults.countyId ? String(defaults.countyId) : ""} placeholder="No county yet" />
      <p className="text-sm text-muted-foreground">
        Importing creates a <strong>pending draft</strong> record (not public) and a verification task. A verifier must confirm the details before anything is published.
      </p>
      <div>
        <SubmitButton pendingLabel="Importing…">Import as Draft</SubmitButton>
      </div>
    </form>
  );
}

export function ResearchTaskForm({
  staff,
  counties,
  categories,
  gapFlagId,
  defaults,
  submitLabel = "Create Task",
}: {
  staff: Option[];
  counties: Option[];
  categories: Option[];
  gapFlagId?: string;
  defaults?: { title?: string; details?: string; countyId?: number | null; categoryId?: number | null };
  submitLabel?: string;
}) {
  const [state, action] = useActionState(createResearchTaskAction, idle);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && !gapFlagId) ref.current?.reset();
  }, [state, gapFlagId]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ title: "Task title" }} />
      {gapFlagId && <input type="hidden" name="gap_flag_id" value={gapFlagId} />}
      <TextField name="title" label="Task title" required state={state} defaultValue={defaults?.title} maxLength={200} />
      <TextAreaField name="details" label="Details" rows={3} state={state} defaultValue={defaults?.details} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="county_id" label="County" state={state} options={counties} defaultValue={defaults?.countyId ? String(defaults.countyId) : ""} placeholder="Any county" />
        <SelectField name="category_id" label="Category" state={state} options={categories} defaultValue={defaults?.categoryId ? String(defaults.categoryId) : ""} placeholder="Any category" />
      </div>
      <SelectField name="assigned_to" label="Assign to" state={state} options={staff} placeholder="Unassigned" />
      <div>
        <SubmitButton pendingLabel="Creating task…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function TaskUpdateForm({ id, title, status, assignedTo, staff }: { id: string; title: string; status: string; assignedTo: string | null; staff: Option[] }) {
  const [state, action] = useActionState(updateResearchTaskAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3" aria-label={`Update task: ${title}`}>
      <FormMessages state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="status"
          label="Status"
          required
          placeholder={null}
          state={state}
          defaultValue={status}
          options={[
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In progress" },
            { value: "done", label: "Done" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <SelectField name="assigned_to" label="Assigned to" state={state} options={staff} defaultValue={assignedTo ?? ""} placeholder="Unassigned" />
      </div>
      <div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
          Update Task<span className="sr-only">: {title}</span>
        </SubmitButton>
      </div>
    </form>
  );
}
