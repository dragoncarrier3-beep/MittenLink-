import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, History, Inbox } from "lucide-react";
import { PageHeader, Panel, Section, DetailList } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge, type Tone } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { ChangeDiff } from "@/components/provider/change-diff";
import { WithdrawButton } from "@/components/provider/form-bits";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import {
  getDiffLookups,
  getOrganization,
  getReferenceOptions,
  getVerificationHistory,
  listChangeRequests,
  loadProviderContext,
  type ChangeRequestRecord,
  type PublicHistoryRecord,
} from "@/lib/data/provider";
import { formatDate, formatDay } from "@/lib/format";
import { CHANGE_STATUS_LABELS, KIND_LABELS, METHOD_LABELS, VERIFICATION_DESCRIPTIONS, VERIFICATION_LABELS, label, type VerificationStatus } from "@/lib/labels";
import { withdrawChangeRequest } from "../change-actions";

export const metadata: Metadata = { title: "Verification & Updates" };

const STATUS_TONE: Record<string, Tone> = {
  pending_review: "info",
  approved: "success",
  rejected: "danger",
  more_info_required: "warning",
  withdrawn: "neutral",
};

const TARGET_WORD: Record<string, string> = { organization: "Organization profile", location: "Location", service: "Service", program: "Program", event: "Event" };

function editHref(r: ChangeRequestRecord) {
  const base: Record<string, string> = { location: "/provider/locations", service: "/provider/services", program: "/provider/programs", event: "/provider/events" };
  if (r.target_type === "organization") return `/provider/organization?revise=${r.id}#edit`;
  return r.target_id ? `${base[r.target_type]}/${r.target_id}` : `${base[r.target_type]}/new?revise=${r.id}`;
}

export default async function VerificationPage() {
  const ctx = await loadProviderContext("/provider/verification");
  const [org, requests, history, ref] = await Promise.all([
    getOrganization(ctx.org.id),
    listChangeRequests(ctx.org.id),
    getVerificationHistory(ctx.org.id),
    getReferenceOptions(),
  ]);
  const lookups = await getDiffLookups(ctx.org.id, ref);
  const status = (org?.verification_status ?? "unverified") as VerificationStatus;
  const open = requests.filter((r) => ["pending_review", "more_info_required"].includes(r.status));
  const closed = requests.filter((r) => !["pending_review", "more_info_required"].includes(r.status));

  return (
    <>
      <PageHeader
        title="Verification & Updates"
        description="Track MittenLink's review of your listing and every update you have submitted. Verification is free and never depends on payment or listing plan."
      />
      <div className="flex flex-col gap-10">
        <Section title="Verification status">
          <Panel className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <VerificationBadge status={status} />
              <span className="text-muted-foreground">{org?.title}</span>
            </div>
            <p>{VERIFICATION_DESCRIPTIONS[status]}</p>
            <DetailList
              items={[
                { label: "Last verified", value: org?.last_verified_at ? `Reviewed by MittenLink on ${formatDate(org.last_verified_at)}` : "Not yet reviewed" },
                { label: "Next scheduled review", value: org?.next_review_at ? formatDay(org.next_review_at) : "Not scheduled" },
              ]}
            />
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                MittenLink reviews listings about every six months. Keeping your information current through this dashboard makes each review faster. Verification
                confirms listing details only — it is not a medical or professional endorsement.
              </span>
            </p>
          </Panel>
        </Section>

        <Section id="open" title="Updates in progress" description="Updates waiting for review or needing more information from you.">
          {open.length === 0 ? (
            <EmptyState icon={Inbox} title="No updates in progress" description="When you submit changes to your listing, they appear here until a verifier reviews them." headingLevel={3} />
          ) : (
            <ul className="flex flex-col gap-4">
              {open.map((r) => (
                <li key={r.id}>
                  <ChangeRequestCard r={r} currentUserId={ctx.user.id} lookups={lookups} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="history" title="Update history" description="Updates that were approved, not approved, or withdrawn.">
          {closed.length === 0 ? (
            <EmptyState icon={History} title="No past updates yet" headingLevel={3} />
          ) : (
            <ul className="flex flex-col gap-4">
              {closed.map((r) => (
                <li key={r.id}>
                  <ChangeRequestCard r={r} currentUserId={ctx.user.id} lookups={lookups} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Public verification history" description="This history is shown on your public listing.">
          <DataTable<PublicHistoryRecord>
            caption="Public verification history"
            rows={history}
            rowKey={(h) => h.id}
            empty={<EmptyState icon={History} title="No public verification history yet" headingLevel={3} />}
            columns={[
              { key: "date", header: "Date", primary: true, cell: (h) => formatDate(h.created_at) },
              { key: "record", header: "Record", cell: (h) => `${label(KIND_LABELS, h.listing_kind)}: ${h.listing_title}` },
              { key: "status", header: "Result", cell: (h) => <VerificationBadge status={h.new_status} /> },
              { key: "method", header: "Method", cell: (h) => (h.method ? label(METHOD_LABELS, h.method) : "—") },
              { key: "summary", header: "Summary", cell: (h) => h.public_summary ?? VERIFICATION_LABELS[h.new_status as VerificationStatus] ?? "—" },
            ]}
          />
        </Section>
      </div>
    </>
  );
}

function ChangeRequestCard({ r, currentUserId, lookups }: { r: ChangeRequestRecord; currentUserId: string; lookups: Awaited<ReturnType<typeof getDiffLookups>> }) {
  const isOpen = ["pending_review", "more_info_required"].includes(r.status);
  const mine = r.submitted_by === currentUserId;
  const headingId = `cr-${r.id}`;
  return (
    <article aria-labelledby={headingId} className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            {r.action === "create" ? `New ${TARGET_WORD[r.target_type].toLowerCase()}` : TARGET_WORD[r.target_type]}
            {r.target_title ? ` · ${r.target_title}` : ""}
          </p>
          <h3 id={headingId} className="text-lg font-bold">
            {r.summary}
          </h3>
          <p className="text-sm text-muted-foreground">
            Submitted {formatDate(r.created_at)}
            {r.submitted_by_name ? ` by ${r.submitted_by_name}` : ""}
            {r.reviewed_at ? ` · Reviewed ${formatDate(r.reviewed_at)}` : ""}
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"} className="self-start">
          {label(CHANGE_STATUS_LABELS, r.status)}
        </StatusPill>
      </div>

      {r.review_message && (
        <div className={`mt-4 rounded-lg border p-3 ${r.status === "more_info_required" ? "border-warning/40 bg-warning-soft" : "bg-muted/50"}`}>
          <p className="font-semibold">Message from the MittenLink verifier</p>
          <p className="mt-1 whitespace-pre-line">{r.review_message}</p>
        </div>
      )}

      <details className="mt-4 group" open={isOpen}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">
          {r.action === "create" ? "Submitted details" : "Field-by-field changes"}
        </summary>
        <div className="mt-2">
          <ChangeDiff
            proposed={r.proposed}
            current={r.current_snapshot}
            isCreate={r.action === "create"}
            lookups={lookups}
            fieldLabels={FIELD_LABELS}
            caption={`Changes in “${r.summary}”`}
          />
          {r.sources.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">Sources you provided</p>
              <ul className="ml-5 list-disc">
                {r.sources.map((src, i) => (
                  <li key={i}>
                    {src.url ? (
                      <a href={src.url} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                        {src.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      src.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {isOpen && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {r.status === "more_info_required" && (
            <Link href={editHref(r)} className={buttonVariants()}>
              Update and resubmit<span className="sr-only">: {r.summary}</span>
            </Link>
          )}
          {r.status === "pending_review" && (
            <Link href={editHref(r)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Revise this update<span className="sr-only">: {r.summary}</span>
            </Link>
          )}
          {mine && <WithdrawButton changeRequestId={r.id} action={withdrawChangeRequest} />}
        </div>
      )}
    </article>
  );
}
