import "server-only";
import Stripe from "stripe";
import { asService } from "@/lib/db";
import { deliverAfterCommit } from "@/lib/server/notifications";
import { applySubscriptionState, billingEventExists, getPlanSettings, recordBillingEvent } from "./service";
import type { BillingAdapter, BillingOrg, BillingUser, PlanSettings, ReturnUrls, SubscriptionRecord, SubscriptionStatus, WebhookResult } from "./types";

/*
 * Stripe (TEST MODE) billing adapter. Selected only when STRIPE_SECRET_KEY and
 * STRIPE_WEBHOOK_SECRET are configured; live keys are refused in demo mode
 * (see ./index.ts). Local state is changed only after Stripe confirms it:
 * either by retrieving the Checkout Session server-side on return, or through
 * a signature-verified webhook. Query parameters are never trusted.
 */

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "incomplete"; // incomplete, paused
  }
}

interface SubscriptionSnapshot {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  status: SubscriptionStatus;
  priceCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  livemode: boolean;
  organizationId: string | null;
}

function snapshot(sub: Stripe.Subscription, fallbackPrice: PlanSettings): SubscriptionSnapshot {
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? null;
  return {
    providerSubscriptionId: sub.id,
    providerCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    status: mapStripeStatus(sub.status),
    priceCents: item?.price?.unit_amount ?? fallbackPrice.priceCents,
    currency: item?.price?.currency ?? fallbackPrice.currency,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    livemode: !!sub.livemode,
    organizationId: (sub.metadata?.organization_id as string | undefined) ?? null,
  };
}

export class StripeBillingAdapter implements BillingAdapter {
  readonly name = "stripe" as const;
  private stripe: Stripe;

  constructor(secretKey: string, private webhookSecret: string) {
    this.stripe = new Stripe(secretKey, { appInfo: { name: "MittenLink" }, maxNetworkRetries: 1, timeout: 15000 });
  }

  async createCheckout(org: BillingOrg, user: BillingUser, urls: ReturnUrls, plan: PlanSettings) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.priceCents,
            recurring: { interval: plan.interval },
            product_data: { name: plan.name, description: `Enhanced listing for ${org.title}. Verification is free and never depends on payment.` },
          },
        },
      ],
      customer_email: user.email,
      client_reference_id: org.id,
      metadata: { organization_id: org.id, user_id: user.id },
      subscription_data: { metadata: { organization_id: org.id, user_id: user.id } },
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { redirectUrl: session.url };
  }

  async cancel(subscription: SubscriptionRecord) {
    if (!subscription.provider_subscription_id) return;
    try {
      await this.stripe.subscriptions.cancel(subscription.provider_subscription_id);
    } catch (err) {
      // Already cancelled at Stripe → treat as success so local state can follow.
      if (err instanceof Stripe.errors.StripeInvalidRequestError && /canceled|No such subscription/i.test(err.message)) return;
      throw err;
    }
  }

  /** Billing portal for updating a card on a past-due subscription (test mode). */
  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return session.url;
  }

  /**
   * Confirms a Checkout Session after the browser returns. The session is
   * retrieved from Stripe (never trusted from the URL) and must belong to the
   * expected organization. Idempotent.
   */
  async confirmCheckout(sessionId: string, expectedOrgId: string, actorId: string) {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return { ok: false as const, reason: "invalid" };
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.metadata?.organization_id !== expectedOrgId) return { ok: false as const, reason: "mismatch" };
    if (session.status !== "complete" || !session.subscription) return { ok: false as const, reason: "incomplete" };
    const sub = typeof session.subscription === "string" ? await this.stripe.subscriptions.retrieve(session.subscription) : session.subscription;
    await this.syncSubscription(sub, { eventId: `checkout:${session.id}`, eventType: "checkout.completed", actorId, organizationId: expectedOrgId, summary: "Stripe test-mode checkout completed." });
    return { ok: true as const };
  }

  private async syncSubscription(
    sub: Stripe.Subscription,
    opts: { eventId: string; eventType: string; actorId: string | null; organizationId?: string | null; summary: string; forceStatus?: SubscriptionStatus },
  ) {
    const senders = await asService(async (sql) => {
      if (await billingEventExists(sql, opts.eventId)) return undefined;
      const plan = await getPlanSettings(sql);
      const snap = snapshot(sub, plan);
      let organizationId = opts.organizationId ?? snap.organizationId;
      if (!organizationId) {
        const [row] = await sql.query<{ organization_id: string }>("select organization_id from public.subscriptions where provider_subscription_id = $1", [snap.providerSubscriptionId]);
        organizationId = row?.organization_id ?? null;
      }
      if (!organizationId) {
        console.warn(`[billing:stripe] ${opts.eventType} for unknown subscription ${snap.providerSubscriptionId}; ignored`);
        return undefined;
      }
      const [org] = await sql.query<{ id: string }>("select id from public.organizations where id = $1", [organizationId]);
      if (!org) return undefined;
      const result = await applySubscriptionState(sql, {
        organizationId,
        provider: "stripe",
        providerSubscriptionId: snap.providerSubscriptionId,
        providerCustomerId: snap.providerCustomerId,
        status: opts.forceStatus ?? snap.status,
        priceCents: snap.priceCents,
        currency: snap.currency,
        currentPeriodEnd: snap.currentPeriodEnd,
        cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
        livemode: snap.livemode,
        actorId: opts.actorId,
        reason: opts.eventType,
      });
      await recordBillingEvent(sql, {
        subscriptionId: result.subscriptionId,
        organizationId,
        provider: "stripe",
        providerEventId: opts.eventId,
        eventType: opts.eventType,
        summary: snap.livemode ? opts.summary : `${opts.summary} (test mode — no real payment)`,
        livemode: snap.livemode,
      });
      return result.senders;
    });
    if (senders) await deliverAfterCommit(senders);
  }

  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
    if (!signature) return { status: 400, body: { error: "Missing Stripe-Signature header" } };
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      return { status: 400, body: { error: "Invalid signature" } };
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await this.stripe.subscriptions.retrieve(subId);
        await this.syncSubscription(sub, {
          eventId: event.id,
          eventType: "checkout.completed",
          actorId: null,
          organizationId: session.metadata?.organization_id ?? null,
          summary: "Stripe checkout completed.",
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub, { eventId: event.id, eventType: "subscription.updated", actorId: null, summary: `Stripe subscription updated (${sub.status}).` });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub, { eventId: event.id, eventType: "subscription.cancelled", actorId: null, summary: "Stripe subscription cancelled.", forceStatus: "cancelled" });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const ref = invoice.parent?.subscription_details?.subscription;
        const subId = typeof ref === "string" ? ref : ref?.id;
        if (!subId) break;
        const sub = await this.stripe.subscriptions.retrieve(subId);
        await this.syncSubscription(sub, { eventId: event.id, eventType: "invoice.payment_failed", actorId: null, summary: "Stripe renewal payment failed.", forceStatus: "past_due" });
        break;
      }
      default:
        return { status: 200, body: { received: true, ignored: event.type } };
    }
    return { status: 200, body: { received: true } };
  }
}
