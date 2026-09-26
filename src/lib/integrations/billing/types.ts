// Shared types for the Enhanced listing billing adapters.

export type SubscriptionStatus = "incomplete" | "trialing" | "active" | "past_due" | "cancelled";
export type BillingProviderName = "demo" | "stripe";

export interface PlanSettings {
  name: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
  demoPricing: boolean;
}

export interface BillingOrg {
  id: string;
  title: string;
}

export interface BillingUser {
  id: string;
  email: string;
  fullName: string;
}

export interface ReturnUrls {
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionRecord {
  id: string;
  organization_id: string;
  status: SubscriptionStatus;
  billing_provider: BillingProviderName;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  price_cents: number;
  currency: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  livemode: boolean;
  created_at: Date;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * A billing provider. Business rules (tiers, notifications, audit) live in
 * ./service.ts so every adapter produces the same outcomes.
 */
export interface BillingAdapter {
  readonly name: BillingProviderName;
  /** Starts checkout and returns where to send the browser next. */
  createCheckout(org: BillingOrg, user: BillingUser, returnUrls: ReturnUrls, plan: PlanSettings): Promise<{ redirectUrl: string }>;
  /** Cancels the subscription with the provider (local records are updated by the caller). */
  cancel(subscription: SubscriptionRecord): Promise<void>;
  /** Verifies and processes a provider webhook (Stripe only). */
  handleWebhook?(rawBody: string, signature: string | null): Promise<WebhookResult>;
}

/** Tier implied by a subscription status. Past-due keeps Enhanced during the grace period. */
export const TIER_FOR_STATUS: Record<SubscriptionStatus, "free" | "enhanced"> = {
  active: "enhanced",
  trialing: "enhanced",
  past_due: "enhanced",
  cancelled: "free",
  incomplete: "free",
};

export const CHECKOUT_FAILED_MESSAGE = "We couldn't complete the test checkout. No payment was processed.";
