"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckboxField, FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { buttonVariants } from "@/components/ui/button";
import { idle, type ActionState } from "@/lib/server/action-types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function slugPreview(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface CategoryDefaults {
  id?: number;
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: number | null;
  sortOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
}

export function CategoryForm({ action, defaults = {}, parents }: { action: Action; defaults?: CategoryDefaults; parents: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState(action, idle);
  const editing = !!defaults.id;
  const [name, setName] = useState(defaults.name ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && !editing) {
      formRef.current?.reset();
      setName("");
    }
  }, [state, editing]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" onInput={(e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "name") setName(t.value);
    }}>
      <FormMessages state={state} fieldLabels={{ name: "Name", slug: "Web address (slug)", description: "Description", parentId: "Parent category", sortOrder: "Sort order" }} />
      <RequiredNote />
      {editing && <input type="hidden" name="id" value={String(defaults.id)} />}
      <TextField name="name" label="Name" required maxLength={80} defaultValue={defaults.name} state={state} />
      <TextField
        name="slug"
        label="Web address (slug)"
        hint={<>Leave blank to generate it from the name{name ? <>: <strong>{slugPreview(name) || "—"}</strong></> : null}. Changing it changes category links.</>}
        maxLength={60}
        defaultValue={defaults.slug}
        state={state}
      />
      <TextAreaField name="description" label="Description" rows={2} maxLength={400} defaultValue={defaults.description} state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="parentId" label="Parent category" options={parents.filter((p) => p.value !== String(defaults.id ?? ""))} placeholder="None (top level)" defaultValue={defaults.parentId ? String(defaults.parentId) : ""} state={state} />
        <TextField name="sortOrder" label="Sort order" hint="Lower numbers appear first." inputMode="numeric" defaultValue={String(defaults.sortOrder ?? 100)} state={state} />
      </div>
      <CheckboxField name="isFeatured" label="Feature on the homepage" defaultChecked={defaults.isFeatured ?? false} state={state} />
      <CheckboxField name="isActive" label="Active (shown in public filters)" defaultChecked={defaults.isActive ?? true} state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Saving…">{editing ? "Save Category" : "Create Category"}</SubmitButton>
        {editing && (
          <Link href="/admin/categories" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

export function SynonymForm({ action, defaults }: { action: Action; defaults?: { term: string; alternatives: string[] } }) {
  const [state, formAction] = useActionState(action, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && !defaults) formRef.current?.reset();
  }, [state, defaults]);
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ term: "Search term", alternatives: "Alternatives" }} />
      {defaults && <input type="hidden" name="originalTerm" value={defaults.term} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(10rem,14rem)_1fr]">
        <TextField name="term" label="Search term" hint="One word, e.g. adhd" required maxLength={40} defaultValue={defaults?.term} state={state} />
        <TextField
          name="alternatives"
          label="Alternatives"
          hint="Comma-separated single words, e.g. attention, hyperactivity"
          required
          defaultValue={defaults?.alternatives.join(", ")}
          state={state}
        />
      </div>
      <div>
        <SubmitButton variant={defaults ? "outline" : "default"} pendingLabel="Saving…">
          {defaults ? "Save Synonyms" : "Add Synonyms"}
        </SubmitButton>
      </div>
    </form>
  );
}
