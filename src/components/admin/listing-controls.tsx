"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormMessages, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { VERIFICATION_LABELS } from "@/lib/labels";
import { setListingPublicationAction, setListingVerificationAction } from "./listing-actions";
import { optionsFrom, PUBLICATION_LABELS, VERIFICATION_METHOD_OPTIONS } from "./admin-labels";

/** Set verification status with method, public summary and internal note. */
export function VerificationControl({ listingId, current }: { listingId: string; current: string }) {
  const [state, action] = useActionState(setListingVerificationAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessages state={state} fieldLabels={{ status: "Verification status", method: "Method", publicSummary: "Public summary", internalNotes: "Internal note" }} />
      <input type="hidden" name="listingId" value={listingId} />
      <SelectField name="status" label="Verification status" required options={optionsFrom(VERIFICATION_LABELS)} defaultValue={current} placeholder={null} state={state} />
      <SelectField
        name="method"
        label="Method used"
        hint="Required when marking a record Verified."
        options={VERIFICATION_METHOD_OPTIONS}
        placeholder="No method (status change only)"
        state={state}
      />
      <TextField name="publicSummary" label="Public summary" hint="Shown on the public page's verification history. Leave blank to use the standard wording for the method." maxLength={500} state={state} />
      <TextAreaField name="internalNotes" label="Internal note" hint="Staff only. Never shown publicly." rows={3} maxLength={4000} state={state} />
      <div>
        <SubmitButton pendingLabel="Updating…">Update Verification</SubmitButton>
      </div>
    </form>
  );
}

type Publication = "published" | "draft" | "archived";

const PUBLICATION_CONFIRM: Record<Publication, { button: string; title: (t: string) => string; description: string; confirm: string; variant: "default" | "outline" | "destructive" }> = {
  published: { button: "Publish", title: (t) => `Publish ${t}?`, description: "The record will appear in public search and on its public page.", confirm: "Publish", variant: "default" },
  draft: { button: "Unpublish (Draft)", title: (t) => `Unpublish ${t}?`, description: "The record will be hidden from the public and saved as a draft. You can publish it again at any time.", confirm: "Unpublish", variant: "outline" },
  archived: { button: "Archive", title: (t) => `Archive ${t}?`, description: "Archived records are hidden from the public but kept with their full history. Nothing is deleted.", confirm: "Archive record", variant: "destructive" },
};

/** Publish / unpublish / archive buttons with confirmations (one shared result message). */
export function PublicationControl({ listingId, current, title }: { listingId: string; current: string; title: string }) {
  const [state, action, pending] = useActionState(setListingPublicationAction, idle);
  const [choice, setChoice] = useState<Publication | null>(null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = choice ? PUBLICATION_CONFIRM[choice] : null;
  return (
    <div className="flex flex-col gap-3">
      <FormMessages state={state} />
      <p>
        Current status: <strong>{PUBLICATION_LABELS[current] ?? current}</strong>
      </p>
      <form ref={formRef} action={action}>
        <input type="hidden" name="listingId" value={listingId} />
        <input ref={inputRef} type="hidden" name="publication" defaultValue="" />
      </form>
      <div className="flex flex-wrap gap-3">
        {(Object.keys(PUBLICATION_CONFIRM) as Publication[])
          .filter((p) => p !== current)
          .map((p) => (
            <Button key={p} type="button" variant={PUBLICATION_CONFIRM[p].variant} disabled={pending} onClick={() => {
              setChoice(p);
              setOpen(true);
            }}>
              {PUBLICATION_CONFIRM[p].button}
            </Button>
          ))}
      </div>
      {pending && <p className="text-sm text-muted-foreground">Saving…</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {cfg && choice && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">{cfg.title(title)}</DialogTitle>
                <DialogDescription className="text-base text-foreground">{cfg.description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button
                  type="button"
                  variant={choice === "archived" ? "destructive" : "default"}
                  onClick={() => {
                    if (inputRef.current) inputRef.current.value = choice;
                    setOpen(false);
                    formRef.current?.requestSubmit();
                  }}
                >
                  {cfg.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
