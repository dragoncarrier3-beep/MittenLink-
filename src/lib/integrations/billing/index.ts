import "server-only";
import type { SqlClient } from "@/lib/db";
import { StripeBillingAdapter } from "./stripe";
import { addInterval, applySubscriptionState, getCurrentSubscription, recordBillingEvent } from "./service";
import type { BillingAdapter, BillingOrg, PlanSettings, SubscriptionRecord } from "./types";

export * from "./types";
export { getPlanSettings, getCurrentSubscription, applySubscriptionState, recordBillingEvent } from "./service";
export { StripeBillingAdapter } from "./stripe";

/**
 * Demonstration billing adapter (default when Stripe test keys are absent).
 * Checkout happens on a clearly labeled MittenLink page; no card is collected
 * and no payment is processed.
 */
export class DemoBillingAdapter implements BillingAdapter {
  readonly name = "demo" as const;
  async createCheckout() {
    return { redirectUrl: "/provider/plan/demo-checkout" };
  }
  async cancel() {
    // Nothing to cancel with an external provider.
  }
}

let warnedLive = false;
let cached: { key: string; adapter: BillingAdapter } | null = null;

/**
 * Chooses the billing adapter:
 *  - Stripe when STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are set and the key
 *    is a TEST key (sk_test_…). Live keys (sk_live_…) are refused while
 *    DEMO_MODE is not explicitly "false" — the demo adapter is used instead.
 *  - Otherwise the demo adapter.
 */
export function getBillingAdapter(): BillingAdapter {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const demoMode = process.env.DEMO_MODE !== "false";
  const cacheKey = `${secret ?? ""}|${webhookSecret ?? ""}|${demoMode}`;
  if (cached?.key === cacheKey) return cached.adapter;

  let adapter: BillingAdapter = new DemoBillingAdapter();
  if (secret && webhookSecret) {
    const isTest = secret.startsWith("sk_test_") || secret.startsWith("rk_test_");
    const isLive = secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
    if (isTest || (isLive && !demoMode)) {
      adapter = new StripeBillingAdapter(secret, webhookSecret);
    } else if (!warnedLive) {
      console.warn(
        isLive
          ? "[billing] Refusing a LIVE Stripe key while DEMO_MODE is enabled. Using the demonstration billing adapter; no payments will be processed."
          : "[billing] STRIPE_SECRET_KEY is not a recognized test key. Using the demonstration billing adapter.",
      );
      warnedLive = true;
    }
  }
  cached = { key: cacheKey, adapter };
  return adapter;
}

/**
 * Completes a demonstration checkout: creates an active subscription for 30
 * days, upgrades the tier, and records a billing event that clearly states no
 * payment was processed. Service transaction only, after an org-manager check.
 */
export async function completeDemoCheckout(sql: SqlClient, org: BillingOrg, actorId: string, plan: PlanSettings) {
  const existing = await getCurrentSubscription(sql, org.id);
  if (existing && ["active", "trialing"].includes(existing.status)) {
    return { alreadyActive: true as const, senders: [] as (() => Promise<boolean>)[] };
  }
  const reuse = existing && ["past_due", "incomplete"].includes(existing.status) && existing.billing_provider === "demo" ? existing.id : null;
  const result = await applySubscriptionState(sql, {
    organizationId: org.id,
    provider: "demo",
    subscriptionId: reuse,
    providerSubscriptionId: reuse ? null : `demo_sub_${crypto.randomUUID().slice(0, 12)}`,
    providerCustomerId: `demo_cus_${org.id.slice(0, 12)}`,
    status: "active",
    priceCents: plan.priceCents,
    currency: plan.currency,
    currentPeriodEnd: addInterval(new Date(), plan.interval),
    cancelAtPeriodEnd: false,
    livemode: false,
    actorId,
    reason: "demo_checkout",
  });
  await recordBillingEvent(sql, {
    subscriptionId: result.subscriptionId,
    organizationId: org.id,
    provider: "demo",
    eventType: "checkout.completed",
    summary: "Demo checkout completed — no payment processed.",
    livemode: false,
  });
  return { alreadyActive: false as const, senders: result.senders };
}

/**
 * Cancels immediately (demo policy): status 'cancelled', tier back to Free at
 * once. The listing stays published and its verification is unchanged.
 */
export async function cancelSubscriptionRecord(sql: SqlClient, sub: SubscriptionRecord, actorId: string) {
  const result = await applySubscriptionState(sql, {
    organizationId: sub.organization_id,
    provider: sub.billing_provider,
    subscriptionId: sub.id,
    status: "cancelled",
    priceCents: sub.price_cents,
    currency: sub.currency,
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    livemode: sub.livemode,
    actorId,
    reason: "cancelled_by_provider",
  });
  await recordBillingEvent(sql, {
    subscriptionId: sub.id,
    organizationId: sub.organization_id,
    provider: sub.billing_provider,
    eventType: "subscription.cancelled",
    summary: sub.billing_provider === "demo" ? "Subscription cancelled by provider (demonstration — no charges involved)." : "Subscription cancelled by provider.",
    livemode: sub.livemode,
  });
  return result;
}

/** Demo-only: resolves a past-due demo subscription (simulates a successful renewal). */
export async function resolveDemoPastDue(sql: SqlClient, sub: SubscriptionRecord, actorId: string, plan: PlanSettings) {
  const result = await applySubscriptionState(sql, {
    organizationId: sub.organization_id,
    provider: "demo",
    subscriptionId: sub.id,
    status: "active",
    priceCents: sub.price_cents,
    currency: sub.currency,
    currentPeriodEnd: addInterval(new Date(), plan.interval),
    cancelAtPeriodEnd: false,
    livemode: false,
    actorId,
    reason: "demo_past_due_resolved",
  });
  await recordBillingEvent(sql, {
    subscriptionId: sub.id,
    organizationId: sub.organization_id,
    provider: "demo",
    eventType: "invoice.paid",
    summary: "Past-due balance resolved (demonstration) — no payment processed.",
    livemode: false,
  });
  return result;
}
