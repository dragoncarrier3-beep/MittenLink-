"use client";

import { useActionState } from "react";
import { FormMessages, RequiredNote, SubmitButton, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { signUpAction } from "../actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUpAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessages state={state} fieldLabels={{ fullName: "Full name", email: "Email", password: "Password", confirm: "Confirm password" }} />
      <RequiredNote />
      <input type="hidden" name="next" value={next} />
      <TextField name="fullName" label="Full name" autoComplete="name" required state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <TextField name="password" label="Password" type="password" autoComplete="new-password" required hint="Use at least 10 characters." state={state} />
      <TextField name="confirm" label="Confirm password" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton pendingLabel="Creating account…" size="lg">
        Create Account
      </SubmitButton>
    </form>
  );
}
