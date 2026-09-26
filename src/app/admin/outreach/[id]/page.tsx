import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Mail, MessageSquare, Phone, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getLookups, getOutreach } from "@/lib/data/operations";
import { CLAIM_STATUS_LABELS, OUTREACH_STATUS_LABELS, label } from "@/lib/labels";
import { formatDateTime, formatDay, formatShortDate, telHref } from "@/lib/format";
import { listingHref } from "@/lib/links";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { ListingTierBadge, StatusPill, VerificationBadge } from "@/components/common/badges";
import { InternalNotes } from "@/components/staff/internal-notes";
import { OutreachStatusPill } from "@/components/operations/status";
import { ClaimInviteForm, InteractionForm, OutreachContactForm } from "@/components/operations/outreach-forms";

export const metadata: Metadata = { title: "Outreach Contact" };

const UUID = /^[0-9a-f-]{36}$/i;
const CHANNEL_LABELS: Record<string, string> = { email: "Email", phone: "Phone", meeting: "Meeting", mail: "Mail", other: "Other" };
const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = { email: Mail, phone: Phone, meeting: Users, mail: Mail, other: MessageSquare };

export default async function OutreachDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  await requireAdmin(`/admin/outreach/${id}`);
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const [data, lookups] = await Promise.all([getOutreach(id), getLookups()]);
  if (!data) notFound();
  const { contact: c, interactions, org } = data;
  const admins = lookups.admins.map((a) => ({ value: a.id, label: a.full_name }));

  return (
    <>
      <PageHeader
        title={`${c.contact_name} — ${c.organization_title}`}
        eyebrow="Outreach contact"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Outreach", href: "/admin/outreach" }, { label: c.contact_name }]}
        actions={<OutreachStatusPill status={c.status} />}
      />
      {sp.saved === "created" && (
        <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft p-4 font-semibold text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> Outreach contact added.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-4 text-xl font-bold">Summary</h2>
            <DetailList
              items={[
                { label: "Contact", value: `${c.contact_name}${c.contact_role ? `, ${c.contact_role}` : ""}` },
                {
                  label: "Email",
                  value: c.email ? (
                    <a href={`mailto:${c.email}`} className="break-all text-primary underline">
                      {c.email}
                    </a>
                  ) : null,
                },
                {
                  label: "Phone",
                  value: c.phone ? (
                    <a href={telHref(c.phone)} className="text-primary underline">
                      {c.phone}
                    </a>
                  ) : null,
                },
                { label: "Outreach status", value: label(OUTREACH_STATUS_LABELS, c.status) },
                { label: "Last contacted", value: c.last_contacted_at ? formatShortDate(c.last_contacted_at) : "Never" },
                {
                  label: "Next follow-up",
                  value: c.next_follow_up_at ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {formatDay(c.next_follow_up_at)}
                      {c.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : c.is_due ? <StatusPill tone="warning">Due today</StatusPill> : null}
                    </span>
                  ) : (
                    "None scheduled"
                  ),
                },
                { label: "Assigned staff", value: c.assignee_name ?? "Unassigned" },
              ]}
            />
          </Panel>

          <Section title="Interaction log" description="Every logged email, call, meeting, and claim invitation, newest first.">
            {interactions.length === 0 ? (
              <Panel>
                <p className="text-muted-foreground">No interactions logged yet.</p>
              </Panel>
            ) : (
              <ol className="flex flex-col gap-3">
                {interactions.map((i) => {
                  const Icon = CHANNEL_ICONS[i.channel] ?? MessageSquare;
                  return (
                    <li key={i.id} className="rounded-xl border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 font-semibold">
                          <Icon className="size-4 text-muted-foreground" aria-hidden /> {label(CHANNEL_LABELS, i.channel)}
                        </p>
                        {i.status_after && <OutreachStatusPill status={i.status_after} />}
                      </div>
                      <p className="mt-2 whitespace-pre-line">{i.summary}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {i.author ?? "Staff"} · {formatDateTime(i.occurred_at)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Log an interaction</h2>
            <InteractionForm id={c.id} />
          </Panel>

          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Edit contact</h2>
            <OutreachContactForm
              admins={admins}
              defaults={{
                id: c.id,
                contact_name: c.contact_name,
                contact_role: c.contact_role,
                email: c.email,
                phone: c.phone,
                status: c.status,
                next_follow_up_at: c.next_follow_up_at,
                assigned_to: c.assigned_to,
                notes: c.notes,
              }}
            />
          </Panel>

          <InternalNotes entityType="outreach" entityId={c.id} revalidate={`/admin/outreach/${c.id}`} />
        </div>

        <aside className="flex flex-col gap-6" aria-label="Organization and claim">
          <Panel as="section">
            <h2 className="text-xl font-bold">Organization</h2>
            <p className="mt-2 font-semibold">{c.organization_title}</p>
            {org && (
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadge status={org.verification_status} />
                <ListingTierBadge tier={org.listing_tier} showFree />
              </div>
            )}
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="font-semibold text-muted-foreground">Claim status</dt>
                <dd>
                  {org?.claimed_at ? `Claimed ${formatShortDate(org.claimed_at)}` : org?.claim_status ? `Latest claim: ${label(CLAIM_STATUS_LABELS, org.claim_status)}` : "Not claimed yet"}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 flex flex-col gap-2">
              <li>
                <Link href={`/admin/organizations/${c.organization_id}`} className="text-primary underline">
                  Open organization record<span className="sr-only">: {c.organization_title}</span>
                </Link>
              </li>
              {org?.publication_status === "published" && (
                <li>
                  <Link href={listingHref("organization", c.organization_slug)} className="text-primary underline">
                    View public profile<span className="sr-only">: {c.organization_title}</span>
                  </Link>
                </li>
              )}
              {org?.claim_status && (
                <li>
                  <Link href="/admin/claims" className="text-primary underline">
                    Review claims queue
                  </Link>
                </li>
              )}
            </ul>
          </Panel>

          {c.status !== "claimed" && (
            <Panel as="section">
              <h2 className="text-xl font-bold">Invite to claim</h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">
                Logs an email interaction, sets the status to Claim Invited, and sends a friendly invitation to {c.email ?? "the contact"}.
              </p>
              <ClaimInviteForm id={c.id} hasEmail={!!c.email} />
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
