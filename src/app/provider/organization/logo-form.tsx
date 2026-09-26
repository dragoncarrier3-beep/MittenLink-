"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { idle } from "@/lib/server/action-types";
import { FormMessages, RequiredNote, SubmitButton, TextField } from "@/components/forms/fields";
import { uploadLogo, withdrawLogo } from "./logo-actions";

const MAX = 2 * 1024 * 1024;

export function LogoUploadForm({ defaultAlt }: { defaultAlt: string }) {
  const [state, action] = useActionState(uploadLogo, idle);
  const [clientError, setClientError] = useState<string | null>(null);
  const id = useId();
  const serverError = state.status === "error" ? state.fieldErrors?.logo : undefined;
  const error = clientError ?? serverError;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} fieldLabels={{ logo: "Logo file", alt_text: "Alternative text" }} />
      <RequiredNote />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-base font-semibold">
          Logo file
          <span className="ml-1 font-normal text-danger">
            <span aria-hidden>*</span>
            <span className="sr-only">(required)</span>
          </span>
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          PNG, JPEG or WebP, up to 2 MB. A square image at least 400 × 400 pixels looks best.
        </p>
        <input
          id={id}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp"
          required
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(" ")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > MAX) setClientError("The image is larger than 2 MB. Please choose a smaller file.");
            else if (f && !["image/png", "image/jpeg", "image/webp"].includes(f.type)) setClientError("Choose a PNG, JPEG or WebP image.");
            else setClientError(null);
          }}
          className="min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-semibold"
        />
        {error && (
          <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-danger" role={clientError ? "alert" : undefined}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">Error: </span>
              {error}
            </span>
          </p>
        )}
      </div>
      <TextField
        name="alt_text"
        label="Alternative text"
        required
        hint="Describe the logo for people who use screen readers. Usually your organization's name followed by “logo”."
        state={state}
        defaultValue={defaultAlt}
        maxLength={200}
      />
      <div>
        <SubmitButton pendingLabel="Uploading…">Upload logo for review</SubmitButton>
      </div>
    </form>
  );
}

export function WithdrawLogoButton({ mediaId }: { mediaId: string }) {
  const [state, action] = useActionState(withdrawLogo, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="mediaId" value={mediaId} />
      {state.status !== "idle" && <FormMessages state={state} />}
      {state.status !== "success" && (
        <div>
          <SubmitButton variant="outline" size="sm" pendingLabel="Withdrawing…">
            Withdraw pending logo
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
