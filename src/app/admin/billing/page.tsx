import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { ListingTierBadge, StatusPill, type Tone } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { AdminActionForm } from "@/components/admin/action-form";
import { getBillingOverview } from "@/lib/data/admin-records";
import { formatCents, formatDateTime, formatShortDate } from "@/lib/format";
import { label, SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels";
import { setDemoSubscriptionStatusAction } from "./actions";

export const metadata: Metadata = { title: "Enhanced Listings" };

const STATUS_TONE: Record<string, Tone> = { active: "success", trialing: "info", past_due: "warning", cancelled: "neutral", incomplete: "neutral" };
const DEMO_STATUSES = ["active", "trialing", "past_due", "cancelled"] as const;

export default async function AdminBillingPage() {
  await requireAdmin("/admin/billing");
  const { subscriptions, events, enhancedCount } = await getBillingOverview();
  const counts = DEMO_STATUSES.map((s) => ({ status: s, n: subscriptions.filter((x) => x.status === s).length }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Enhanced Listings" }]}
        title="Enhanced Listings"
        description="Optional paid listing upgrades that add richer content. Enhanced Listings are never ranked above other results."
      />
      <div className="mb-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-foreground">
        <p className="font-semibold">Verification is independent of payment. Test mode only — no real charges.</p>
        <p className="mt-1 text-sm">Demo subscriptions can be switched between states below to show how the platform responds. Stripe subscriptions are read-only here.</p>
      </div>

      <section aria-labelledby="billing-summary" className="mb-8">
        <h2 id="billing-summary" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border bg-card p-4">
            <dt className="text-sm font-semibold text-muted-foreground">Enhanced now</dt>
            <dd className="text-3xl font-bold">{enhancedCount}</dd>
          </div>
          {counts.map((c) => (
            <div key={c.status} className="rounded-xl border bg-card p-4">
              <dt className="text-sm font-semibold text-muted-foreground">{SUBSCRIPTION_STATUS_LABELS[c.status]}</dt>
              <dd className="text-3xl font-bold">{c.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section title="Subscriptions">
        <DataTable
          caption="Subscriptions"
          rows={subscriptions}
          rowKey={(r) => r.id}
          empty={<EmptyState icon={CreditCard} title="No subscriptions yet" description="When an organization upgrades to an Enhanced Listing, it appears here." headingLevel={3} />}
          columns={[
            {
              key: "org",
              header: "Organization",
              primary: true,
              cell: (r) => (
                <span className="flex flex-col gap-1">
                  <Link href={`/admin/organizations/${r.organization_id}`} className="text-primary underline">
                    {r.org_title}
                  </Link>
                  <ListingTierBadge tier={r.listing_tier} showFree />
                </span>
              ),
            },
            { key: "status", header: "Status", cell: (r) => <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>{label(SUBSCRIPTION_STATUS_LABELS, r.status)}</StatusPill> },
            { key: "provider", header: "Provider", cell: (r) => (r.billing_provider === "demo" ? "Demo" : `Stripe${r.livemode ? " (live)" : " (test)"}`) },
            { key: "price", header: "Price", cell: (r) => `${formatCents(r.price_cents, r.currency)} / month` },
            { key: "period", header: "Current period end", cell: (r) => (r.current_period_end ? formatShortDate(r.current_period_end) : "—") },
            { key: "created", header: "Created", cell: (r) => formatShortDate(r.created_at) },
            {
              key: "action",
              header: "Demo controls",
              cell: (r) =>
                r.billing_provider === "demo" && !r.livemode ? (
                  <AdminActionForm
                    action={setDemoSubscriptionStatusAction}
                    hidden={{ subscriptionId: r.id }}
                    label={<>Set status<span className="sr-only"> for {r.org_title}</span></>}
                    size="sm"
                    pendingLabel="Updating…"
                    inline
                    confirm={{
                      title: `Change ${r.org_title}'s demo subscription?`,
                      description: "This simulates a billing event. The listing tier updates to match; verification status does not change. No payment is processed.",
                      confirmLabel: "Change status",
                    }}
                  >
                    <label className="flex flex-col gap-1 text-sm font-semibold">
                      New status<span className="sr-only"> for {r.org_title}</span>
                      <select name="status" defaultValue={r.status === "incomplete" ? "active" : r.status} className="min-h-9 rounded-md border border-input bg-card px-2 text-base font-normal">
                        {DEMO_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {SUBSCRIPTION_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </AdminActionForm>
                ) : (
                  <span className="text-sm text-muted-foreground">Managed in Stripe</span>
                ),
            },
          ]}
        />
      </Section>

      <Section title="Billing events" className="mt-10" description="The 50 most recent billing events, newest first.">
        <DataTable
          caption="Billing events"
          rows={events}
          rowKey={(r) => r.id}
          empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No billing events yet.</p>}
          columns={[
            { key: "when", header: "When", primary: true, cell: (r) => <span className="font-normal">{formatDateTime(r.created_at)}</span> },
            { key: "org", header: "Organization", cell: (r) => r.org_title ?? "—" },
            { key: "type", header: "Event", cell: (r) => <code className="text-sm">{r.event_type}</code> },
            { key: "summary", header: "Summary", cell: (r) => r.summary ?? "—" },
            { key: "provider", header: "Provider", cell: (r) => (r.billing_provider === "demo" ? "Demo" : `Stripe${r.livemode ? " (live)" : " (test)"}`) },
          ]}
        />
      </Section>
    </>
  );
}
