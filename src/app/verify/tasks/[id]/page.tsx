import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { isAdmin, requireStaff } from "@/lib/auth";
import { getTaskDetail } from "@/lib/data/staff";
import { FIELD_LABELS } from "@/lib/domain/change-requests";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { DataTable } from "@/components/common/data-table";
import { InternalNotes } from "@/components/staff/internal-notes";
import { ActionForm } from "@/components/staff/action-form";
import { PriorityPill, PUBLICATION_LABELS, WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { param, resultFor, type SearchParams } from "@/components/staff/result";
import { DueDate } from "@/components/staff/task-table";
import { formatDateTime, formatDay, formatHours, formatShortDate } from "@/lib/format";
import {
  CHANGE_STATUS_LABELS,
  CORRECTION_ISSUE_LABELS,
  EVENT_TYPE_LABELS,
  KIND_LABELS,
  METHOD_LABELS,
  ORG_TYPE_LABELS,
  RESOURCE_TYPE_LABELS,
  TASK_REASON_LABELS,
  VERIFICATION_LABELS,
  WAITLIST_LABELS,
  label,
} from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { taskAssignmentAction } from "../../actions";
import { VERIFY_RESULTS } from "../../results";
import { VerificationForm } from "./verification-form";

export const metadata: Metadata = { title: "Verification Task" };

const EXTRA_LABELS: Record<string, string> = {
  resource_type: "Resource type",
  url: "Link",
  source_name: "Source name",
  source_url: "Source link",
  reading_minutes: "Reading time (minutes)",
  organizer_name: "Organizer",
};

const HISTORY_ACTION_LABELS: Record<string, string> = {
  status_change: "Status changed",
  verified: "Verified",
  update_requested: "Update requested",
  unable_to_verify: "Unable to verify",
  escalated: "Escalated to admin",
  change_approved: "Provider change approved",
  change_rejected: "Provider change rejected",
  note: "Note",
};

function display(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "hours" && Array.isArray(value)) {
    const lines = formatHours(value as { day: string; open: string; close: string }[]);
    return lines.length ? lines.map((l) => `${l.day}: ${l.hours}`).join("; ") : "Not provided";
  }
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "None";
  if (field === "waitlist_status") return label(WAITLIST_LABELS, String(value));
  if (field === "org_type") return label(ORG_TYPE_LABELS, String(value));
  if (field === "event_type") return label(EVENT_TYPE_LABELS, String(value));
  if (field === "resource_type") return label(RESOURCE_TYPE_LABELS, String(value));
  if (field === "starts_at" || field === "ends_at") return formatDateTime(value as string | Date);
  if (field === "start_date" || field === "end_date") return formatDay(value as string | Date);
  if (value instanceof Date) return formatShortDate(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ExternalA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline underline-offset-2">
      {children}
      <ExternalLink className="size-4 shrink-0" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function safeHttp(url: string | null | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export default async function TaskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requireStaff("/verify");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const detail = await getTaskDetail(id);
  if (!detail) notFound();
  const { task, listing, organization: org, changeRequest: cr, correction } = detail;
  const admin = isAdmin(user);
  const open = ["open", "in_progress", "escalated"].includes(task.status);
  const canAct = open && (task.status !== "escalated" || admin);
  const mine = task.assigned_to === user.id;
  const result = resultFor(sp, VERIFY_RESULTS);
  const returnTo = param(sp, "from") === "admin" && admin ? "/admin/verification" : "/verify";
  const selfPath = `/verify/tasks/${task.id}`;
  const publicHref = listing.publication_status === "published" ? listingHref(listing.kind, listing.slug) : null;

  const assignmentButtons: { label: string; value: string; variant?: "default" | "outline" }[] = [];
  if (open && (task.status !== "escalated" || admin)) {
    if (!mine && (!task.assigned_to || admin)) assignmentButtons.push({ label: "Assign to me", value: "assign", variant: "outline" });
    if (task.status === "open" && (mine || !task.assigned_to || admin)) assignmentButtons.push({ label: "Start review", value: "start", variant: "default" });
    if (task.assigned_to && (mine || admin)) assignmentButtons.push({ label: "Unassign", value: "unassign", variant: "outline" });
  }

  const typedItems = detail.typed
    ? Object.entries(detail.typed).map(([k, v]) => ({ label: FIELD_LABELS[k] ?? EXTRA_LABELS[k] ?? k.replace(/_/g, " "), value: display(k, v) }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow={`Verification task · ${label(TASK_REASON_LABELS, task.reason)}`}
        title={listing.title}
        breadcrumbs={[
          { label: returnTo === "/admin/verification" ? "Admin verification" : "My Verification Queue", href: returnTo },
          { label: listing.title },
        ]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-base">
            <WorkflowStatus kind="task" status={task.status} />
            <PriorityPill priority={task.priority} />
            <VerificationBadge status={listing.verification_status} />
          </span>
        }
        actions={
          canAct ? (
            <a href="#verification-actions" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
              Go to verification actions
            </a>
          ) : undefined
        }
      />
      <ResultBanner message={result.message} warning={result.warning} />

      {task.status === "escalated" && (
        <div className="mb-6 flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            <strong>Escalated to administrators.</strong>{" "}
            {admin ? "Review the notes below and resolve the task, or assign it back to a verifier." : "An administrator will make the decision. You can still read the record and add internal notes."}
          </p>
        </div>
      )}
      {!open && (
        <div className="mb-6 flex gap-3 rounded-lg border border-success/40 bg-success-soft p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p>
            <strong>This task is {task.status === "cancelled" ? "cancelled" : "completed"}.</strong> {task.resolution ?? ""}
            {task.completed_at ? ` (${formatDateTime(task.completed_at)})` : ""}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <Panel as="section">
          <h2 className="text-xl font-bold">Task</h2>
          <DetailList
            className="mt-4"
            items={[
              { label: "Reason for review", value: label(TASK_REASON_LABELS, task.reason) },
              { label: "Assigned to", value: task.assignee_name ? `${task.assignee_name}${mine ? " (you)" : ""}` : "Unassigned" },
              { label: "Due date", value: <DueDate due={task.due_at} /> },
              { label: "Created", value: formatDateTime(task.created_at) },
              { label: "Details", value: task.details ? <span className="whitespace-pre-line">{task.details}</span> : null },
              ...(detail.openTasksForListing > 0 ? [{ label: "Other open tasks", value: `${detail.openTasksForListing} other open task(s) for this record` }] : []),
            ]}
          />
          {assignmentButtons.length > 0 && (
            <ActionForm
              className="mt-4"
              action={taskAssignmentAction}
              hidden={{ taskId: task.id, returnTo: returnTo === "/admin/verification" ? `${selfPath}?from=admin` : selfPath }}
              buttons={assignmentButtons.map((b) => ({ ...b, pendingLabel: "Updating…" }))}
              size="default"
            />
          )}
        </Panel>

        <Section title="Current record" id="current" description="What the public sees today.">
          <Panel>
            <DetailList
              items={[
                { label: "Name", value: listing.title },
                { label: "Type", value: label(KIND_LABELS, listing.kind) },
                {
                  label: "Public page",
                  value: publicHref ? (
                    <Link href={publicHref} className="text-primary underline underline-offset-2">
                      View public page<span className="sr-only"> for {listing.title}</span>
                    </Link>
                  ) : (
                    `Not public (${label(PUBLICATION_LABELS, listing.publication_status)})`
                  ),
                },
                {
                  label: "Verification",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <VerificationBadge status={listing.verification_status} />
                      <span className="text-sm text-muted-foreground">
                        Last verified {listing.last_verified_at ? formatShortDate(listing.last_verified_at) : "never"}
                        {listing.next_review_at ? ` · Next review ${formatDay(listing.next_review_at, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                      </span>
                    </span>
                  ),
                },
                { label: "Short description", value: listing.summary || null },
                { label: "Full description", value: listing.description ? <span className="whitespace-pre-line">{listing.description}</span> : null },
                { label: "Categories", value: detail.categories.join(", ") || null },
                { label: "Populations served", value: detail.populations.join(", ") || null },
                { label: "Languages", value: detail.languages.join(", ") || null },
                { label: "Service area", value: detail.serviceAreas.join(", ") || null },
                { label: "Virtual", value: listing.virtual_available ? "Yes" : "No" },
                { label: "Primary city / county", value: [listing.primary_city, listing.county ? `${listing.county} County` : null].filter(Boolean).join(", ") || null },
                ...typedItems,
                ...(listing.created_by_name ? [{ label: "Submitted by", value: `${listing.created_by_name} (${listing.created_by_email}) on ${formatShortDate(listing.created_at)}` }] : []),
              ]}
            />
          </Panel>
          {org && (
            <Panel className="mt-4">
              <h3 className="text-lg font-bold">{org.id === listing.id ? "Organization details" : `Organization: ${org.title}`}</h3>
              <DetailList
                className="mt-3"
                items={[
                  { label: "Organization type", value: label(ORG_TYPE_LABELS, org.org_type) },
                  { label: "Website", value: safeHttp(org.website) ? <ExternalA href={org.website!}>{org.website}</ExternalA> : org.website },
                  { label: "Public email", value: org.public_email },
                  { label: "Public phone", value: org.public_phone },
                  { label: "Accessibility", value: org.accessibility_info },
                  { label: "Claimed", value: org.claimed_at ? `Yes, since ${formatShortDate(org.claimed_at)}` : "Not claimed" },
                  { label: "Listing tier", value: org.listing_tier === "enhanced" ? <ListingTierBadge tier="enhanced" /> : "Free Listing (tier never affects verification)" },
                  ...(org.id !== listing.id ? [{ label: "Organization verification", value: <VerificationBadge status={org.verification_status} /> }] : []),
                ]}
              />
            </Panel>
          )}
          {detail.locations.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-3 text-lg font-bold">Locations ({detail.locations.length})</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {detail.locations.map((loc) => (
                  <li key={loc.id} className="rounded-xl border bg-card p-4">
                    <p className="font-semibold">
                      {loc.name} {loc.is_primary && <span className="text-sm font-normal text-muted-foreground">(primary)</span>}
                    </p>
                    <p>
                      {loc.street}
                      {loc.street2 ? `, ${loc.street2}` : ""}, {loc.city}, MI {loc.zip}
                    </p>
                    <p className="text-sm text-muted-foreground">{loc.county ? `${loc.county} County` : ""}</p>
                    <p className="mt-1 text-sm">
                      {loc.phone ? `Phone: ${loc.phone}` : "No location phone"}
                      {loc.email ? ` · Email: ${loc.email}` : ""}
                    </p>
                    <p className="text-sm">
                      Status: {loc.status === "open" ? "Open" : loc.status === "temporarily_closed" ? "Temporarily closed" : "Closed"} · Wheelchair accessible:{" "}
                      {loc.wheelchair_accessible === null ? "Unknown" : loc.wheelchair_accessible ? "Yes" : "No"} · Appointment required: {loc.appointment_required ? "Yes" : "No"}
                    </p>
                    {loc.hours?.length > 0 && <p className="text-sm text-muted-foreground">Hours: {display("hours", loc.hours)}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {cr && (
          <Section title="Proposed information" id="proposed" description="Changes submitted by the provider. Every row below is a proposed change.">
            <Panel>
              <DetailList
                items={[
                  { label: "Summary", value: cr.summary },
                  { label: "Applies to", value: `${cr.target_type === "location" ? "Location" : label(KIND_LABELS, cr.target_type)}${cr.target_label ? `: ${cr.target_label}` : ""}${cr.action === "create" ? " (new record)" : ""}` },
                  { label: "Submitted by", value: `${cr.submitted_by_name ?? "Provider"}${cr.submitted_by_email ? ` (${cr.submitted_by_email})` : ""} on ${formatShortDate(cr.created_at)}` },
                  { label: "Change status", value: label(CHANGE_STATUS_LABELS, cr.status) },
                  ...(cr.review_message ? [{ label: "Last message to provider", value: cr.review_message }] : []),
                ]}
              />
            </Panel>
            <DataTable
              className="mt-4"
              caption="Field-by-field comparison of current and proposed values"
              captionHidden={false}
              rows={Object.keys(cr.proposed).map((field) => ({ field }))}
              rowKey={(r) => r.field}
              columns={[
                { key: "field", header: "Field", primary: true, cell: (r) => FIELD_LABELS[r.field] ?? r.field },
                {
                  key: "current",
                  header: "Current value",
                  cell: (r) => (cr.action === "create" ? <span className="text-muted-foreground">New record</span> : <span className="whitespace-pre-line">{display(r.field, cr.current_snapshot?.[r.field])}</span>),
                },
                {
                  key: "proposed",
                  header: "Proposed value",
                  cell: (r) => (
                    <span className="flex flex-col gap-1">
                      <StatusPill tone="info" className="self-start">
                        {cr.action === "create" ? "New" : "Changed"}
                      </StatusPill>
                      <span className="font-semibold whitespace-pre-line">{display(r.field, cr.proposed[r.field])}</span>
                    </span>
                  ),
                },
              ]}
            />
            <div className="mt-4">
              <h3 className="text-lg font-bold">Sources offered by the provider</h3>
              {cr.sources?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {cr.sources.map((s, i) => (
                    <li key={i}>
                      {safeHttp(s.url) ? <ExternalA href={s.url!}>{s.label || s.url}</ExternalA> : <span>{s.label || s.url}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">The provider did not include sources. Confirm changes with the organization or its website.</p>
              )}
            </div>
          </Section>
        )}

        {correction && (
          <Section title="Community correction" id="correction">
            <Panel>
              <DetailList
                items={[
                  { label: "Issue", value: label(CORRECTION_ISSUE_LABELS, correction.issue_type) },
                  { label: "Details", value: <span className="whitespace-pre-line">{correction.details}</span> },
                  { label: "Reported", value: formatDateTime(correction.created_at) },
                  { label: "Reported by", value: correction.submitter_name ?? "Anonymous visitor" },
                  { label: "Contact email (private)", value: correction.submitter_email ?? "Not provided" },
                  { label: "Correction status", value: <WorkflowStatus kind="correction" status={correction.status} /> },
                ]}
              />
            </Panel>
          </Section>
        )}

        <Section title="Sources" id="sources" description="Where to confirm this information.">
          <Panel>
            <ul className="list-disc space-y-2 pl-5">
              {org && safeHttp(org.website) && (
                <li>
                  Organization website: <ExternalA href={org.website!}>{org.website}</ExternalA>
                </li>
              )}
              {detail.typed && safeHttp(detail.typed.website as string) && (
                <li>
                  Program website: <ExternalA href={detail.typed.website as string}>{String(detail.typed.website)}</ExternalA>
                </li>
              )}
              {detail.typed && safeHttp(detail.typed.source_url as string) && (
                <li>
                  Resource source: <ExternalA href={detail.typed.source_url as string}>{String(detail.typed.source_name ?? detail.typed.source_url)}</ExternalA>
                </li>
              )}
              {detail.typed && safeHttp(detail.typed.registration_url as string) && (
                <li>
                  Event registration: <ExternalA href={detail.typed.registration_url as string}>{String(detail.typed.registration_url)}</ExternalA>
                </li>
              )}
              {cr?.sources
                ?.filter((s) => safeHttp(s.url))
                .map((s, i) => (
                  <li key={i}>
                    Provider source: <ExternalA href={s.url!}>{s.label || s.url}</ExternalA>
                  </li>
                ))}
              {org?.public_phone && <li>Main phone: {org.public_phone}</li>}
            </ul>
          </Panel>
        </Section>

        <Section title="Contact provenance" id="provenance" description="Where each contact detail came from and when it was last confirmed. Staff only.">
          <DataTable
            caption="Contact provenance"
            rows={detail.contacts}
            rowKey={(c) => c.id}
            empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No contact provenance has been recorded for this organization.</p>}
            columns={[
              {
                key: "value",
                header: "Value",
                primary: true,
                cell: (c) => (
                  <span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {c.kind.charAt(0).toUpperCase() + c.kind.slice(1)}
                      {c.label ? ` · ${c.label}` : ""}
                      {c.location_name ? ` · ${c.location_name}` : ""}
                      {!c.is_public ? " · Not public" : ""}
                    </span>
                    <span className="break-all">{c.value}</span>
                  </span>
                ),
              },
              { key: "source", header: "Source type", cell: (c) => label(METHOD_LABELS, c.source_type) },
              { key: "url", header: "Source URL", cell: (c) => (safeHttp(c.source_url) ? <ExternalA href={c.source_url!}>{c.source_url}</ExternalA> : <span className="text-muted-foreground">None</span>) },
              { key: "discovered", header: "Discovered", cell: (c) => formatShortDate(c.discovered_at) },
              { key: "verified", header: "Last verified", cell: (c) => (c.last_verified_at ? formatShortDate(c.last_verified_at) : "Never") },
              { key: "by", header: "Verified by", cell: (c) => c.verified_by_name ?? "—" },
              { key: "confidence", header: "Confidence", cell: (c) => c.confidence.charAt(0).toUpperCase() + c.confidence.slice(1) },
              { key: "status", header: "Status", cell: (c) => (c.status === "active" ? "Active" : c.status === "outdated" ? "Outdated" : "Unverified") },
            ]}
          />
        </Section>

        <Section title="Verification history" id="history" description="Staff view, including internal notes and sources checked.">
          {detail.history.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-muted-foreground">No previous verification activity for this record.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {detail.history.map((h) => (
                <li key={h.id} className="rounded-xl border bg-card p-4">
                  <p className="font-semibold">
                    {label(HISTORY_ACTION_LABELS, h.action)} · {formatDateTime(h.created_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {h.previous_status ? `${label(VERIFICATION_LABELS, h.previous_status)} → ` : ""}
                    {label(VERIFICATION_LABELS, h.new_status)}
                    {h.method ? ` · Method: ${label(METHOD_LABELS, h.method)}` : ""} · By {h.verifier_name ?? "System"}
                  </p>
                  {h.public_summary && (
                    <p className="mt-2">
                      <span className="font-semibold">Public summary:</span> {h.public_summary}
                    </p>
                  )}
                  {h.internal_notes && (
                    <p className="mt-1 whitespace-pre-line">
                      <span className="font-semibold">Internal notes:</span> {h.internal_notes}
                    </p>
                  )}
                  {h.sources.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Sources checked:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {h.sources.map((s, i) => (
                          <li key={i}>
                            {label(METHOD_LABELS, s.source_type)}
                            {s.description ? ` — ${s.description}` : ""}
                            {safeHttp(s.url) && (
                              <>
                                {" "}
                                (<ExternalA href={s.url!}>{s.url}</ExternalA>)
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
          )}
        </Section>

        <Section title="Provider contact information" id="provider-contact" description="Use these to confirm details with the organization.">
          <Panel>
            {org ? (
              <DetailList
                items={[
                  { label: "Organization", value: org.title },
                  { label: "Main phone", value: org.public_phone },
                  { label: "Main email", value: org.public_email },
                  { label: "Website", value: org.website },
                  {
                    label: "Provider managers",
                    value: detail.managers.length ? (
                      <ul className="flex flex-col gap-1">
                        {detail.managers.map((m) => (
                          <li key={m.user_id}>
                            {m.full_name}
                            {m.job_title ? `, ${m.job_title}` : ""} — {m.email} <span className="text-sm text-muted-foreground">({m.member_role})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "No one manages this organization on MittenLink yet."
                    ),
                  },
                ]}
              />
            ) : (
              <p className="text-muted-foreground">This record is not linked to an organization.</p>
            )}
          </Panel>
        </Section>

        <InternalNotes entityType="listing" entityId={listing.id} revalidate={selfPath} title="Internal notes for this record" />

        {canAct ? (
          <section id="verification-actions" aria-labelledby="verification-actions-heading" className="scroll-mt-24 rounded-xl border-2 border-primary/30 bg-card p-5">
            <h2 id="verification-actions-heading" className="text-2xl font-bold">
              Verification actions
            </h2>
            <p className="mt-1 mb-5 text-muted-foreground">
              Choose the method you used, note your sources, then pick an outcome. Every outcome is recorded in the verification history and audit log.
            </p>
            <VerificationForm
              taskId={task.id}
              hasChangeRequest={!!cr && ["pending_review", "more_info_required"].includes(cr.status)}
              isEscalated={task.status === "escalated"}
              returnTo={returnTo}
              defaultSourceUrl={safeHttp(org?.website ?? null)}
            />
          </section>
        ) : open ? (
          <p className="rounded-xl border bg-card p-4 text-muted-foreground">Verification actions are available to administrators while this task is escalated.</p>
        ) : null}
      </div>
    </>
  );
}


