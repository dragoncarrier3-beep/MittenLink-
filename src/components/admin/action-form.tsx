"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormMessages, SubmitButton } from "@/components/forms/fields";
import { idle, type ActionState } from "@/lib/server/action-types";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "secondary" | "destructive" | "ghost";

export interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Small admin action form: hidden inputs + optional extra (uncontrolled)
 * fields + a submit button. When `confirm` is set, the button opens an
 * accessible confirmation dialog first. Results are announced with
 * FormMessages (role=status / role=alert).
 */
export function AdminActionForm({
  action,
  hidden = {},
  label,
  pendingLabel = "Saving…",
  variant = "outline",
  size = "default",
  confirm,
  children,
  className,
  inline = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  label: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: "default" | "sm";
  confirm?: ConfirmOptions;
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FormMessages state={state} />
      <form ref={formRef} action={formAction} className={cn(inline ? "flex flex-wrap items-end gap-2" : "flex flex-col gap-3")}>
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        <div>
          {confirm ? (
            <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => setOpen(true)}>
              {pending ? pendingLabel : label}
            </Button>
          ) : (
            <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
              {label}
            </SubmitButton>
          )}
        </div>
      </form>
      {confirm && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{confirm.title}</DialogTitle>
              <DialogDescription className="text-base text-foreground">{confirm.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                type="button"
                variant={confirm.destructive ? "destructive" : "default"}
                onClick={() => {
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
