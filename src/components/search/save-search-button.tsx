"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { BellPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormMessages, RequiredNote, SubmitButton, TextField } from "@/components/forms/fields";
import { saveSearchAction } from "@/lib/actions/saved";
import { idle } from "@/lib/server/action-types";
import { cn } from "@/lib/utils";

/** "Save this search" for signed-in members; sign-in link otherwise. */
export function SaveSearchButton({ signedIn, queryString, defaultName }: { signedIn: boolean; queryString: string; defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveSearchAction, idle);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.status === "success") {
      const t = window.setTimeout(() => setOpen(false), 1800);
      return () => window.clearTimeout(t);
    }
  }, [state]);

  if (!signedIn) {
    const next = `/search${queryString ? `?${queryString}` : ""}`;
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={cn(buttonVariants({ variant: "outline" }))}>
        <BellPlus aria-hidden /> Sign in to save this search
      </Link>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setFormKey((k) => k + 1);
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BellPlus aria-hidden /> Save this search
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Save this search</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Saved searches appear in your account so you can run them again later.
          </DialogDescription>
        </DialogHeader>
        <form key={formKey} action={action} className="flex flex-col gap-4">
          <FormMessages state={state} fieldLabels={{ name: "Search name" }} />
          <RequiredNote />
          <TextField name="name" label="Search name" required maxLength={120} defaultValue={defaultName} state={state} />
          <input type="hidden" name="query" value={queryString} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Save search</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
