"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { idle } from "@/lib/server/action-types";
import { CheckboxField, FormMessages, SubmitButton } from "@/components/forms/fields";
import { buttonVariants } from "@/components/ui/button";
import { cancelSubscriptionAction, completeDemoCheckoutAction, resolvePastDueAction, startUpgrade } from "./actions";

export function UpgradeButton({ label = "Upgrade to Enhanced" }: { label?: string }) {
  const [state, action] = useActionState(startUpgrade, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.status === "error" && <FormMessages state={state} />}
      <div>
        <SubmitButton pendingLabel="Starting checkout…" size="lg">
          <Sparkles aria-hidden /> {label}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CancelSubscriptionForm() {
  const [state, action] = useActionState(cancelSubscriptionAction, idle);
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} fieldLabels={{ confirm: "Confirmation" }} />
      <CheckboxField
        name="confirm"
        state={state}
        label="I understand Enhanced features (logo, expanded description, featured services and analytics) end immediately."
        hint="Your listing stays published and verified. You can upgrade again at any time."
      />
      <div>
        <SubmitButton variant="destructive" pendingLabel="Cancelling…">
          Cancel Enhanced subscription
        </SubmitButton>
      </div>
    </form>
  );
}

export function ResolvePastDueButton({ provider }: { provider: "demo" | "stripe" }) {
  const [state, action] = useActionState(resolvePastDueAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.status !== "idle" && <FormMessages state={state} />}
      {state.status !== "success" && (
        <div>
          <SubmitButton pendingLabel="Working…">{provider === "demo" ? "Resolve past-due (demo)" : "Update billing"}</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function DemoCheckoutButtons() {
  const [state, action] = useActionState(completeDemoCheckoutAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton size="lg" pendingLabel="Completing…">
          Complete demo checkout
        </SubmitButton>
        <Link href="/provider/plan?checkout=cancelled" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
