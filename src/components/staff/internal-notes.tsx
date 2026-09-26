import { Lock } from "lucide-react";
import { asService } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { InternalNoteForm } from "./internal-note-form";

/**
 * Staff-only internal notes for an entity. Render ONLY on staff pages that
 * already passed a verifier/admin guard. Notes are never shown publicly.
 */
export async function InternalNotes({ entityType, entityId, revalidate, title = "Internal notes" }: { entityType: string; entityId: string; revalidate: string; title?: string }) {
  const notes = await asService((sql) =>
    sql.query<{ id: string; body: string; created_at: Date; author: string | null }>(
      `select n.id, n.body, n.created_at, p.full_name as author from public.internal_notes n
       left join public.profiles p on p.id = n.author_id
       where n.entity_type = $1 and n.entity_id = $2 order by n.created_at desc`,
      [entityType, entityId],
    ),
  ).catch(() => []);
  return (
    <section aria-labelledby={`notes-${entityId}`} className="rounded-xl border bg-card p-5">
      <h2 id={`notes-${entityId}`} className="flex items-center gap-2 text-lg font-bold">
        <Lock className="size-4 text-muted-foreground" aria-hidden /> {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Visible to MittenLink staff only. Never shown on public pages.</p>
      {notes.length === 0 ? (
        <p className="mt-3 text-muted-foreground">No internal notes yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-muted p-3">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {n.author ?? "Staff"} · {formatDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <InternalNoteForm entityType={entityType} entityId={entityId} revalidate={revalidate} />
    </section>
  );
}
