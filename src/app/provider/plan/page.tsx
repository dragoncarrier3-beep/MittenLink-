import type { Metadata } from "next";
import { AlertTriangle, Check, CheckCircle2, Info, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader, Panel, Section, DetailList } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { ListingTierBadge, StatusPill, type Tone } from "@/components/common/badges";
import { getBillingOverview, getOrganization, loadProviderContext, type BillingEventRecord } from "@/lib/data/provider";
import { StripeBillingAdapter, getBillingAdapter } from "@/lib/integrations/billing";
import { formatCents, formatDate } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABELS, label } from "@/lib/labels";
import { firstParam } from "../_lib/prefill";
import { CancelSubscriptionForm, ResolvePastDueButton, UpgradeButton } from "./plan-controls";

export const metadata: Metadata = { title: "Listing Plan" };

const SUB_TONE: Record<string, Tone> = { active: "success", trialing: "info", past_due: "warning", cancelled: "neutral", incomplete: "warning" };

const FREE_FEATURES = [
  "Organization profile",
  "Description",
  "Contact information",
  "Locations and hours",
  "Service categories",
  "Services and programs",
  "Basic accessibility information",
  "Full verification by MittenLink",
];
const ENHANCED_FEATURES = ["Everything in the Free Listing", "Organization logo", "Expanded description", "Featured services", "Profile analytics (views, traffic sources, saves)"];

export default async function PlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await loadProviderContext("/provider/plan");
  const adapter = getBillingAdapter();

  // Returning from Stripe Checkout: confirm with Stripe server-side (never trust the URL).
  let confirmNotice: { tone: "success" | "warning"; text: string } | null = null;
  const checkout = firstParam(sp.checkout);
  const sessionId = firstParam(sp.session_id);
  if (checkout === "success" && sessionId && adapter instanceof StripeBillingAdapter && ctx.canManageBilling) {
    try {
      const res = await adapter.confirmCheckout(sessionId, ctx.org.id, ctx.user.id);
      confirmNotice = res.ok
        ? { tone: "success", text: "Your Enhanced listing subscription is active. This was a Stripe test-mode checkout; no real payment was processed." }
        : { tone: "warning", text: "We're still confirming your checkout with the payment processor. This page will update once it's confirmed." };
    } catch (err) {
      console.error("[billing] could not confirm checkout", err);
      confirmNotice = { tone: "warning", text: "We couldn't confirm the test checkout yet. No payment was processed. Please refresh in a moment." };
    }
  } else if (checkout === "cancelled") {
    confirmNotice = { tone: "warning", text: "Checkout was cancelled. No payment was processed and your listing plan has not changed." };
  }

  const [org, billing] = await Promise.all([getOrganization(ctx.org.id), getBillingOverview(ctx.org.id)]);
  const { plan, subscription: sub, events } = billing;
  if (checkout === "success" && !confirmNotice && sub?.status === "active" && sub.billing_provider === "demo") {
    confirmNotice = { tone: "success", text: "Your Enhanced listing subscription is active. This was a demonstration checkout — no card was collected and no payment was processed." };
  }
  const priceText = `${formatCents(plan.priceCents, plan.currency)}/${plan.interval}${plan.demoPricing ? " — demonstration pricing" : ""}`;
  const hasLiveSub = !!sub && ["active", "trialing", "past_due"].includes(sub.status);

  return (
    <>
      <PageHeader title="Listing Plan" description="Choose how your organization appears on MittenLink. Every listing can be fully verified for free." />

      {confirmNotice && (
        <div
          role="status"
          className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${confirmNotice.tone === "success" ? "border-success/40 bg-success-soft" : "border-warning/40 bg-warning-soft"}`}
        >
          {confirmNotice.tone === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
          <p className="font-semibold">{confirmNotice.text}</p>
        </div>
      )}

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
        <p>
          <strong>Verification is free and never depends on payment.</strong> Enhanced placement is always labeled and never presented as a recommendation.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        <Section title="Current plan">
          <Panel className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <ListingTierBadge tier={org?.listing_tier} showFree />
              {sub && <StatusPill tone={SUB_TONE[sub.status] ?? "neutral"}>Subscription: {label(SUBSCRIPTION_STATUS_LABELS, sub.status)}</StatusPill>}
            </div>
            {sub ? (
              <DetailList
                items={[
                  { label: "Plan", value: `${plan.name} (${formatCents(sub.price_cents, sub.currency)}/${plan.interval})` },
                  { label: "Status", value: label(SUBSCRIPTION_STATUS_LABELS, sub.status) },
                  {
                    label: sub.status === "cancelled" ? "Ended" : sub.status === "trialing" ? "Trial ends" : sub.status === "past_due" ? "Payment was due" : "Current period ends",
                    value: sub.current_period_end ? formatDate(sub.current_period_end) : "—",
                  },
                  { label: "Billing", value: sub.billing_provider === "demo" ? "Demonstration billing — no payments are processed" : sub.livemode ? "Stripe" : "Stripe test mode — no real payments" },
                  { label: "Started", value: formatDate(sub.created_at) },
                ]}
              />
            ) : (
              <p className="text-muted-foreground">Your organization has a Free Listing. There is no subscription.</p>
            )}

            {sub?.status === "past_due" && (
              <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
                <p className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                  Your Enhanced subscription is past due. Enhanced features stay on for now. Verification status is not affected.
                </p>
                {ctx.canManageBilling && <ResolvePastDueButton provider={sub.billing_provider} />}
              </div>
            )}

            {!ctx.canManageBilling && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Only organization owners and managers can change the listing plan. Ask an owner or manager on your team if you'd like to make a change.
              </p>
            )}
          </Panel>
        </Section>

        <Section title="Compare plans">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel as="article" className="flex flex-col gap-4">
              <div>
                <h3 className="text-xl font-bold">Free Listing</h3>
                <p className="text-2xl font-bold">$0</p>
              </div>
              <ul className="flex flex-col gap-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {org?.listing_tier !== "enhanced" && <p className="font-semibold text-muted-foreground">Your current plan</p>}
            </Panel>
            <Panel as="article" className="flex flex-col gap-4 border-enhanced/40">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Sparkles className="size-5 text-enhanced" aria-hidden /> {plan.name}
                </h3>
                <p className="text-2xl font-bold">{priceText}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {ENHANCED_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">Enhanced listings are labeled “Enhanced Listing” and are never ranked as more trustworthy.</p>
              {hasLiveSub ? (
                <p className="font-semibold text-muted-foreground">Your current plan</p>
              ) : ctx.canManageBilling ? (
                <div className="flex flex-col gap-2">
                  <UpgradeButton />
                  <p className="text-sm text-muted-foreground">
                    {adapter.name === "demo"
                      ? "Demonstration checkout: no card is collected and no payment is processed."
                      : "Opens Stripe Checkout in test mode. Use a Stripe test card; no real payment is processed."}
                  </p>
                </div>
              ) : null}
            </Panel>
          </div>
        </Section>

        {hasLiveSub && ctx.canManageBilling && (
          <Section title="Cancel Enhanced" description="Cancellation takes effect immediately in this demonstration. Your organization returns to a Free Listing right away.">
            <Panel>
              <CancelSubscriptionForm />
            </Panel>
          </Section>
        )}

        <Section title="Billing history">
          <DataTable<BillingEventRecord>
            caption="Billing history"
            rows={events}
            rowKey={(e) => e.id}
            empty={<p className="rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground">No billing activity yet.</p>}
            columns={[
              { key: "date", header: "Date", primary: true, cell: (e) => formatDate(e.created_at) },
              { key: "summary", header: "Details", cell: (e) => e.summary ?? e.event_type },
              { key: "provider", header: "Processed by", cell: (e) => (e.billing_provider === "demo" ? "Demonstration (no payment)" : e.livemode ? "Stripe" : "Stripe test mode") },
            ]}
          />
        </Section>
      </div>
    </>
  );
}
