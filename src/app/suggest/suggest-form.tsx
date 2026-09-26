"use client";

import { useActionState } from "react";
import { FormMessages, RequiredNote, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { SuccessPanel } from "@/components/community/form-parts";
import { PrivacyNotice } from "@/components/community/notices";
import { idle } from "@/lib/server/action-types";
import { submitSuggestionAction } from "./actions";

type Option = { value: string; label: string };

const LABELS = {
  name: "Resource name",
  url: "Website",
  description: "Description",
  city: "City or town",
  countyId: "County",
  categoryId: "Category",
  email: "Email",
};

export function SuggestForm({
  mode,
  counties,
  categories,
  defaults,
  signedIn,
}: {
  mode: "resource" | "need";
  counties: Option[];
  categories: Option[];
  defaults: { q: string; location: string; countyId: string; email: string };
  signedIn: boolean;
}) {
  const [state, action] = useActionState(submitSuggestionAction, idle);

  if (state.status === "success") {
    return (
      <SuccessPanel
        title={state.message}
        actions={[
          { label: "Search MittenLink", href: "/search" },
          ...(signedIn ? [{ label: "View My Reports", href: "/account/reports", variant: "outline" as const }] : []),
        ]}
      >
        {mode === "resource" ? (
          <p>
            Our team will look into it. If the resource serves people with disabilities in Michigan and we can confirm its details from an official
            source, we&apos;ll add it to MittenLink and mark it with its verification status.
          </p>
        ) : (
          <p>
            MittenLink staff review these requests to find gaps in the directory. Your request helps us decide where to look for new resources — even
            when we can&apos;t reply to every message.
          </p>
        )}
      </SuccessPanel>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessages state={state} fieldLabels={{ ...LABELS, description: mode === "need" ? "What you were looking for" : "Description" }} />
      <PrivacyNotice />
      <RequiredNote />
      {mode === "resource" ? (
        <>
          <input type="hidden" name="kind" value="resource_suggestion" />
          <TextField name="name" label="Name of the organization, program, or resource" required maxLength={200} state={state} />
          <TextField name="url" label="Website" type="url" inputMode="url" hint="Start with https://" state={state} />
          <TextAreaField
            name="description"
            label="What does it offer?"
            required
            maxLength={3000}
            hint="Who it serves and what kind of help it provides."
            state={state}
          />
          <SelectField name="categoryId" label="Category" options={categories} placeholder="Choose the closest category" state={state} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="city" label="City or town" autoComplete="address-level2" maxLength={120} state={state} />
            <SelectField name="countyId" label="County" options={counties} placeholder="Choose a county" state={state} />
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="kind" value="unmet_need" />
          <TextAreaField
            name="description"
            label="What were you looking for?"
            required
            maxLength={3000}
            defaultValue={defaults.q}
            hint="For example: “Respite care for a teenager on weekends” or “A dentist experienced with sensory needs.”"
            state={state}
          />
          <SelectField name="categoryId" label="Closest category" options={categories} placeholder="Not sure" state={state} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="city" label="City, town, or ZIP code" autoComplete="address-level2" maxLength={120} defaultValue={defaults.location} state={state} />
            <SelectField name="countyId" label="County" options={counties} placeholder="Choose a county" defaultValue={defaults.countyId} state={state} />
          </div>
        </>
      )}
      <TextField
        name="email"
        label="Your email"
        type="email"
        autoComplete="email"
        defaultValue={defaults.email}
        hint="Private. We'll only use it if we have a question or find what you were looking for."
        state={state}
      />
      <div>
        <SubmitButton pendingLabel="Sending…" size="lg">
          {mode === "resource" ? "Send Suggestion" : "Send Request"}
        </SubmitButton>
      </div>
    </form>
  );
}
