import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { formatDateTime } from "@/lib/format";
import { label, METHOD_LABELS, VERIFICATION_LABELS } from "@/lib/labels";
import type { HistoryEntry } from "@/lib/data/admin-records";
import { PUBLICATION_LABELS, PUBLICATION_TONE } from "./admin-labels";

export function PublicationPill({ status }: { status: string }) {
  return <StatusPill tone={PUBLICATION_TONE[status] ?? "neutral"}>{PUBLICATION_LABELS[status] ?? status}</StatusPill>;
}

export function YesNo({ value, unknown = "Not recorded" }: { value: boolean | null | undefined; unknown?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">{unknown}</span>;
  return <span>{value ? "Yes" : "No"}</span>;
}

export function DemoFlag({ show }: { show: boolean }) {
  if (!show) return null;
  return <StatusPill tone="warning">Demo data</StatusPill>;
}

/** Link to the public page when the record is published. */
export function PublicPageLink({ href, published, title }: { href: string; published: boolean; title: string }) {
  if (!published) return <p className="text-sm text-muted-foreground">Not published — no public page is visible yet.</p>;
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline">
      View public page<span className="sr-only"> for {title}</span> <ExternalLink className="size-4" aria-hidden />
    </Link>
  );
}

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status changed",
  verified: "Verified",
  update_requested: "Update requested",
  unable_to_verify: "Unable to verify",
  escalated: "Escalated",
  change_approved: "Provider change approved",
  change_rejected: "Provider change rejected",
  note: "Note",
};

/** Staff-only verification history, including internal notes and sources checked. */
export function VerificationHistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return <p className="text-muted-foreground">No verification activity has been recorded for this record yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {history.map((h) => (
        <li key={h.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={h.new_status} />
            <span className="font-semibold">{ACTION_LABELS[h.action] ?? h.action}</span>
            {h.previous_status && h.previous_status !== h.new_status && (
              <span className="text-sm text-muted-foreground">from {label(VERIFICATION_LABELS, h.previous_status)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(h.created_at)} · {h.verifier ?? "System"}
            {h.method ? ` · ${label(METHOD_LABELS, h.method)}` : ""}
          </p>
          {h.public_summary && (
            <p className="mt-2">
              <span className="font-semibold">Public summary: </span>
              {h.public_summary}
            </p>
          )}
          {h.internal_notes && (
            <p className="mt-2 rounded-md bg-muted p-2 whitespace-pre-line">
              <Lock className="mr-1 inline size-4 text-muted-foreground" aria-hidden />
              <span className="font-semibold">Internal note (staff only): </span>
              {h.internal_notes}
            </p>
          )}
          {h.sources.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-semibold">Sources checked</p>
              <ul className="ml-5 list-disc text-sm">
                {h.sources.map((s, i) => (
                  <li key={i}>
                    {label(METHOD_LABELS, s.source_type)}
                    {s.description ? ` — ${s.description}` : ""}
                    {s.url && (
                      <>
                        {" "}
                        <a href={s.url} className="break-all text-primary underline" rel="noopener noreferrer" target="_blank">
                          {s.url}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Success banner for redirects that carry a ?saved= flag. */
export function SuccessBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-6 rounded-lg border border-success/40 bg-success-soft p-4 font-semibold text-success">
      {message}
    </div>
  );
}
