"use client";

import { useActionState } from "react";
import { FormMessages, RequiredNote, SubmitButton, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { updateProfileAction } from "../actions";

export function ProfileForm({ defaults }: { defaults: { fullName: string; jobTitle: string; phone: string } }) {
  const [state, action] = useActionState(updateProfileAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessages state={state} fieldLabels={{ fullName: "Full name", jobTitle: "Job title", phone: "Phone" }} />
      <RequiredNote />
      <TextField name="fullName" label="Full name" required autoComplete="name" maxLength={120} defaultValue={defaults.fullName} state={state} />
      <TextField
        name="jobTitle"
        label="Job title"
        autoComplete="organization-title"
        maxLength={120}
        defaultValue={defaults.jobTitle}
        hint="Helpful if you manage or claim an organization's listing."
        state={state}
      />
      <TextField name="phone" label="Phone" type="tel" autoComplete="tel" defaultValue={defaults.phone} hint="Only MittenLink staff can see this." state={state} />
      <div>
        <SubmitButton pendingLabel="Saving…">Save Profile</SubmitButton>
      </div>
    </form>
  );
}
