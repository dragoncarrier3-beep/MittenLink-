"use client";

import { useActionState } from "react";
import { FormMessages, SubmitButton, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { signInAction } from "../actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessages state={state} fieldLabels={{ email: "Email", password: "Password" }} />
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
      <SubmitButton pendingLabel="Signing in…" size="lg">
        Sign In
      </SubmitButton>
    </form>
  );
}
