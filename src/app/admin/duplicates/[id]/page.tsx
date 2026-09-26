import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { asService } from "@/lib/db";
import { PageHeader, Panel, Section } from "@/components/common/page";
import { ListingTierBadge, VerificationBadge } from "@/components/common/badges";
import { ActionForm, DecisionForm } from "@/components/staff/action-form";
import { DuplicateSignals } from "@/components/staff/duplicate-signals";
import { InternalNotes } from "@/components/staff/internal-notes";
import { PUBLICATION_LABELS, WorkflowStatus } from "@/components/staff/pills";
import { ResultBanner } from "@/components/staff/result-banner";
import { resultFor, type SearchParams } from "@/components/staff/result";
import { formatShortDate } from "@/lib/format";
import { label } from "@/lib/labels";
import { listingHref } from "@/lib/links";
import { mergeDuplicateAction, resolveSuggestionAction } from "../actions";

export const metadata: Metadata = { title: "Review Potential Duplicate" };

interface Rec {
  id: string; title: string; slug: string; kind: string; publication_status: string; verification_status: string; last_verified_at: Date | null; created_at: Date;
  website: string | null; public_email: string | null; public_phone: string | null; claimed_at: Date | null; listing_tier: string | null;
  addresses: string[] | null; services: number; programs: number; events: number; managers: number; reports: number; open_tasks: number; active_subscription: boolean;
}

const REC_SQL = `
  select l.id, l.title, l.slug, l.kind, l.publication_status, l.verification_status, l.last_verified_at, l.created_at,
    o.website, o.public_email, o.public_phone, o.claimed_at, o.listing_tier,
    (select array_agg(ol.street || ', ' || ol.city || ' ' || ol.zip order by ol.is_primary desc, ol.name) from organization_locations ol where ol.organization_id = l.id) as addresses,
    (select count(*)::int from services s where s.organization_id = l.id) as services,
    (select count(*)::int from programs p where p.organization_id = l.id) as programs,
    (select count(*)::int from events e where e.organization_id = l.id) as events,
    (select count(*)::int from provider_members m where m.organization_id = l.id and m.status = 'active') as managers,
    (select count(*)::int from family_experience_reports r where r.organization_id = l.id) as reports,
    (select count(*)::int from verification_tasks vt where vt.listing_id = l.id and vt.status in ('open', 'in_progress', 'escalated')) as open_tasks,
    exists (select 1 from subscriptions su where su.organization_id = l.id and su.status in ('active', 'trialing', 'past_due')) as active_subscription
  from listings l left join organizations o on o.id = l.id where l.id = $1`;

function norm(v: unknown) {
  return typeof v === "string" ? v.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9@.]/g, "") : JSON.stringify(v);
}

function describe(r: Rec) {
  return `${label(PUBLICATION_LABELS, r.publication_status)} · ${r.verification_status.replace(/_/g, " ")} · ${r.services} service(s)${r.claimed_at ? " · claimed" : ""}`;
}

export default async function DuplicateReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin("/admin/duplicates");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const data = await asService(async (sql) => {
    const [s] = await sql.query<{ id: string; listing_a: string; listing_b: string; confidence: number; signals: Record<string, unknown>; status: string; created_at: Date; resolved_at: Date | null; resolver: string | null }>(
      `select d.*, p.full_name as resolver from duplicate_suggestions d left join profiles p on p.id = d.resolved_by where d.id = $1`,
      [id],
    );
    if (!s) return null;
    const [a] = await sql.query<Rec>(REC_SQL, [s.listing_a]);
    const [b] = await sql.query<Rec>(REC_SQL, [s.listing_b]);
    const [merge] = await sql.query<{ surviving_listing_id: string; created_at: Date }>(
      "select surviving_listing_id, created_at from listing_merges where (surviving_listing_id = $1 and merged_listing_id = $2) or (surviving_listing_id = $2 and merged_listing_id = $1) order by created_at desc limit 1",
      [s.listing_a, s.listing_b],
    );
    return { s, a, b, merge };
  });
  if (!data || !data.a || !data.b) notFound();
  const { s, a, b, merge } = data;
  const result = resultFor(sp, {
    merged: merge ? `Records merged. ${merge.surviving_listing_id === a.id ? b.title : a.title} was archived and its details moved to ${merge.surviving_listing_id === a.id ? a.title : b.title}.` : "Records merged.",
  });

  // Recommend keeping the verified / richer / older record.
  const rank = (r: Rec) => (r.verification_status === "verified" ? 1000 : 0) + (r.claimed_at ? 100 : 0) + r.services * 10 + r.managers * 5;
  const recommended = rank(a) > rank(b) || (rank(a) === rank(b) && a.created_at <= b.created_at) ? a : b;

  const rows: { label: string; a: React.ReactNode; b: React.ReactNode; same?: boolean }[] = [
    { label: "Name", a: a.title, b: b.title, same: norm(a.title) === norm(b.title) },
    { label: "Website", a: a.website ?? "Not provided", b: b.website ?? "Not provided", same: !!a.website && norm(a.website).replace(/\/$/, "") === norm(b.website).replace(/\/$/, "") },
    { label: "Phone", a: a.public_phone ?? "Not provided", b: b.public_phone ?? "Not provided", same: !!a.public_phone && a.public_phone.replace(/\D/g, "") === (b.public_phone ?? "").replace(/\D/g, "") },
    { label: "Email", a: a.public_email ?? "Not provided", b: b.public_email ?? "Not provided", same: !!a.public_email && norm(a.public_email) === norm(b.public_email) },
    { label: "Addresses", a: a.addresses?.join("; ") ?? "None", b: b.addresses?.join("; ") ?? "None" },
    { label: "Services", a: String(a.services), b: String(b.services) },
    { label: "Programs / events", a: `${a.programs} / ${a.events}`, b: `${b.programs} / ${b.events}` },
    { label: "Verification", a: <VerificationBadge status={a.verification_status} />, b: <VerificationBadge status={b.verification_status} /> },
    { label: "Last verified", a: a.last_verified_at ? formatShortDate(a.last_verified_at) : "Never", b: b.last_verified_at ? formatShortDate(b.last_verified_at) : "Never" },
    { label: "Publication", a: label(PUBLICATION_LABELS, a.publication_status), b: label(PUBLICATION_LABELS, b.publication_status) },
    { label: "Claimed", a: a.claimed_at ? `Yes (${a.managers} manager${a.managers === 1 ? "" : "s"})` : "No", b: b.claimed_at ? `Yes (${b.managers} manager${b.managers === 1 ? "" : "s"})` : "No" },
    { label: "Listing tier", a: a.listing_tier === "enhanced" ? <ListingTierBadge tier="enhanced" /> : "Free", b: b.listing_tier === "enhanced" ? <ListingTierBadge tier="enhanced" /> : "Free" },
    { label: "Family reports", a: String(a.reports), b: String(b.reports) },
    { label: "Open verification tasks", a: String(a.open_tasks), b: String(b.open_tasks) },
    { label: "Created", a: formatShortDate(a.created_at), b: formatShortDate(b.created_at) },
  ];

  const recordLink = (r: Rec) =>
    r.publication_status === "published" ? (
      <Link href={listingHref(r.kind, r.slug)} className="text-primary underline underline-offset-2">
        {r.title}
        <span className="sr-only"> (public page)</span>
      </Link>
    ) : (
      r.title
    );
  const billingWarning = [a, b].filter((r) => r.active_subscription);

  return (
    <>
      <PageHeader
        eyebrow="Potential duplicate"
        title={`${a.title} and ${b.title}`}
        breadcrumbs={[{ label: "Potential Duplicates", href: "/admin/duplicates" }, { label: "Review" }]}
        description={
          <span className="flex flex-wrap items-center gap-2 text-base">
            <WorkflowStatus kind="duplicate" status={s.status} /> Confidence {s.confidence}% · found {formatShortDate(s.created_at)}
            {s.resolved_at ? ` · resolved by ${s.resolver ?? "an administrator"} on ${formatShortDate(s.resolved_at)}` : ""}
          </span>
        }
      />
      <ResultBanner message={result.message} warning={result.warning} />

      <div className="flex flex-col gap-8">
        <Section title="Why these were matched" id="signals">
          <Panel>
            <DuplicateSignals signals={s.signals} />
          </Panel>
        </Section>

        <Section title="Side-by-side comparison" id="compare">
          {/* Desktop: comparison table. Mobile: stacked per-field cards. */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Comparison of the two records</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 text-sm font-bold">Detail</th>
                  <th scope="col" className="px-4 py-3 text-sm font-bold">Record A: {a.title}</th>
                  <th scope="col" className="px-4 py-3 text-sm font-bold">Record B: {b.title}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t align-top">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {r.label}
                      {r.same && <span className="block text-sm font-normal text-success">Same on both</span>}
                    </th>
                    <td className="px-4 py-3 break-words">{r.label === "Name" ? recordLink(a) : r.a}</td>
                    <td className="px-4 py-3 break-words">{r.label === "Name" ? recordLink(b) : r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Comparison of the two records">
            {rows.map((r) => (
              <li key={r.label} className="rounded-xl border bg-card p-4">
                <p className="font-semibold">
                  {r.label}
                  {r.same && <span className="ml-2 text-sm font-normal text-success">Same on both</span>}
                </p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="font-semibold text-muted-foreground">A</dt>
                  <dd className="min-w-0 break-words">{r.label === "Name" ? recordLink(a) : r.a}</dd>
                  <dt className="font-semibold text-muted-foreground">B</dt>
                  <dd className="min-w-0 break-words">{r.label === "Name" ? recordLink(b) : r.b}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </Section>

        <InternalNotes entityType="duplicate" entityId={s.id} revalidate={`/admin/duplicates/${s.id}`} title="Internal notes for this suggestion" />

        {s.status === "open" ? (
          <>
            <section aria-labelledby="merge-heading" className="rounded-xl border-2 border-danger/30 bg-card p-5">
              <h2 id="merge-heading" className="text-2xl font-bold">
                Merge these records
              </h2>
              <p className="mt-1 mb-4 text-muted-foreground">
                Choose the record to keep. The other record is archived, and its locations, services, programs, events, contacts, categories, service areas,
                saved items, family reports, claims, provider managers, outreach, and open tasks move to the record you keep. Empty contact fields on the kept
                record are filled from the archived one. A snapshot of the archived record is saved.
              </p>
              {billingWarning.length > 0 && (
                <p className="mb-4 flex gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                  <span>
                    {billingWarning.map((r) => r.title).join(" and ")} {billingWarning.length === 1 ? "has" : "have"} an Enhanced Listing subscription. Merging does not
                    change billing — review it on the Enhanced Listings page afterwards.
                  </span>
                </p>
              )}
              <DecisionForm
                action={mergeDuplicateAction}
                hidden={{ suggestionId: s.id }}
                fields={[
                  {
                    type: "radio",
                    name: "survivor",
                    label: "Record to keep",
                    required: true,
                    defaultValue: recommended.id,
                    options: [a, b].map((r) => ({
                      value: r.id,
                      label: `Keep ${r.title}${r.id === recommended.id ? " (recommended)" : ""}`,
                      description: describe(r),
                    })),
                  },
                  {
                    type: "checkbox",
                    name: "acknowledge",
                    label: "I understand this archives the record I don't keep and moves its details to the record I keep. This cannot be undone automatically.",
                  },
                ]}
                buttons={[{ label: "Merge records", variant: "destructive", pendingLabel: "Merging…" }]}
              />
            </section>
            <section aria-labelledby="other-heading" className="rounded-xl border bg-card p-5">
              <h2 id="other-heading" className="text-xl font-bold">
                Not the same organization?
              </h2>
              <p className="mt-1 mb-4 text-muted-foreground">
                <strong>Keep Separate</strong> records that these are different organizations. <strong>Ignore</strong> dismisses the suggestion without a decision.
                Either way, this pair won&apos;t be suggested again.
              </p>
              <ActionForm
                action={resolveSuggestionAction}
                hidden={{ suggestionId: s.id }}
                size="default"
                buttons={[
                  { label: "Keep Separate", value: "kept_separate" },
                  { label: "Ignore Suggestion", value: "ignored", variant: "ghost" },
                ]}
              />
            </section>
          </>
        ) : (
          <p className="rounded-xl border bg-card p-4">
            This suggestion is <strong>{label({ merged: "merged", kept_separate: "kept separate", ignored: "ignored" }, s.status)}</strong>. No further action is needed.
          </p>
        )}
      </div>
    </>
  );
}
