"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { CheckboxField, FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { buttonVariants } from "@/components/ui/button";
import { idle, type ActionState } from "@/lib/server/action-types";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { optionsFrom } from "./admin-labels";

export interface GuideDefaults {
  id?: string;
  title?: string;
  summary?: string;
  resourceType?: string;
  url?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  body?: string | null;
  readingMinutes?: number | null;
  statewide?: boolean;
  categoryIds?: string[];
  populationIds?: string[];
  verificationStatus?: string;
}

function CheckboxGroup({
  name,
  legend,
  hint,
  options,
  selected,
  state,
  required,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string }[];
  selected: string[];
  state: ActionState;
  required?: boolean;
}) {
  const id = useId();
  const error = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  // Controlled so selections survive the automatic form reset after a failed submit.
  const [checked, setChecked] = useState<string[]>(selected);
  return (
    <fieldset aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined} aria-invalid={error ? true : undefined}>
      <legend className="text-base font-semibold">
        {legend}
        {required ? (
          <span className="ml-1 font-normal text-danger">
            <span aria-hidden>*</span>
            <span className="sr-only">(required)</span>
          </span>
        ) : (
          <span className="ml-1 text-sm font-normal text-muted-foreground">(optional)</span>
        )}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-muted">
            <input type="checkbox" name={name} value={o.value} checked={checked.includes(o.value)}
              onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, o.value] : prev.filter((v) => v !== o.value)))} className="size-5 shrink-0 accent-[var(--primary)]" />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ResourceForm({
  action,
  defaults = {},
  categories,
  populations,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: GuideDefaults;
  categories: { value: string; label: string }[];
  populations: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState(action, idle);
  const editing = !!defaults.id;
  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5">
      <FormMessages
        state={state}
        fieldLabels={{
          title: "Title", summary: "Summary", resourceType: "Resource type", "categories[]": "Categories", url: "Resource link", sourceName: "Source name",
          sourceUrl: "Source link", body: "Guide text", readingMinutes: "Reading time",
        }}
      />
      <RequiredNote />
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="title" label="Title" required maxLength={200} defaultValue={defaults.title} state={state} />
      <TextAreaField name="summary" label="Summary" hint="One or two plain-language sentences shown in search results." rows={2} required maxLength={400} defaultValue={defaults.summary} state={state} />
      <SelectField name="resourceType" label="Resource type" required options={optionsFrom(RESOURCE_TYPE_LABELS)} defaultValue={defaults.resourceType ?? "guide"} placeholder={null} state={state} />
      <CheckboxGroup name="categories[]" legend="Categories" hint="The first category checked is treated as the primary category." options={categories} selected={defaults.categoryIds ?? []} state={state} required />
      <CheckboxGroup name="populations[]" legend="Audience" hint="Who this guide is written for." options={populations} selected={defaults.populationIds ?? []} state={state} />
      <TextField name="url" label="Resource link" hint="For videos, resource lists or external guides. Starts with https://" type="url" defaultValue={defaults.url} state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="sourceName" label="Source name" hint="e.g. Michigan Department of Health and Human Services" defaultValue={defaults.sourceName} state={state} />
        <TextField name="sourceUrl" label="Source link" type="url" defaultValue={defaults.sourceUrl} state={state} />
      </div>
      <TextAreaField name="body" label="Guide text" hint="Write in plain language. Separate paragraphs with a blank line." rows={14} maxLength={20000} defaultValue={defaults.body} state={state} />
      <TextField
        name="readingMinutes"
        label="Reading time (minutes)"
        hint="Leave blank to estimate from the guide text."
        inputMode="numeric"
        defaultValue={defaults.readingMinutes ? String(defaults.readingMinutes) : ""}
        state={state}
      />
      <CheckboxField name="statewide" label="Applies statewide (all of Michigan)" defaultChecked={defaults.statewide ?? true} state={state} />
      {!editing && (
        <SelectField
          name="publish"
          label="Visibility"
          required
          placeholder={null}
          options={[
            { value: "published", label: "Publish now" },
            { value: "draft", label: "Save as draft (hidden from the public)" },
          ]}
          defaultValue="published"
          state={state}
        />
      )}
      {defaults.verificationStatus !== "verified" && (
        <CheckboxField
          name="markVerified"
          label="I reviewed this guide's sources — mark it Verified"
          hint="Otherwise the guide is saved as Pending Review for a verifier to check."
          state={state}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Saving guide…">{editing ? "Save Changes" : "Create Guide"}</SubmitButton>
        <Link href={editing ? `/admin/resources/${defaults.id}` : "/admin/resources"} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
