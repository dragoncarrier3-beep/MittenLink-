"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessages, SubmitButton, TextAreaField } from "@/components/forms/fields";
import { idle } from "@/lib/server/action-types";
import { addInternalNoteAction } from "@/lib/actions/internal-notes";

export function InternalNoteForm({ entityType, entityId, revalidate }: { entityType: string; entityId: string; revalidate: string }) {
  const [state, action] = useActionState(addInternalNoteAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="mt-4 flex flex-col gap-3">
      <FormMessages state={state} />
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <TextAreaField name="body" label="Add an internal note" rows={3} required state={state} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Adding note…">
          Add Note
        </SubmitButton>
      </div>
    </form>
  );
}
