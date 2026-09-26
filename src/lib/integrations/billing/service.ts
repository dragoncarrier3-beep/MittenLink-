import "server-only";
import type { SqlClient } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifications";
import { TIER_FOR_STATUS, type BillingProviderName, type PlanSettings, type SubscriptionRecord, type SubscriptionStatus } from "./types";

/*
 * Server-side billing service. The ONLY code that writes subscriptions,
 * billing_events and organizations.listing_tier. All functions run inside
 * the caller's service transaction, after the caller has authorized the
 * request (org manager check) or verified a provider webhook signature.
 *
 * Verification status is never read or written here: payment never affects
 * verification.
 */

const DEFAULT_PLAN: PlanSettings = { name: "MittenLink Enhanced", priceCents: 2900, currency: "usd", interval: "month", demoPricing: true };

export async function getPlanSettings(sql: SqlClient): Promise<PlanSettings> {
  const [row] = await sql.query<{ value: Record<string, unknown> }>("select value from public.platform_settings where key = 'enhanced_plan'");
  const v = row?.value ?? {};
  const price = Number(v.price_cents);
  return {
    name: typeof v.name === "string" && v.name ? v.name : DEFAULT_PLAN.name,
    priceCents: Number.isInteger(price) && price > 0 ? price : DEFAULT_PLAN.priceCents,
    currency: typeof v.currency === "string" && v.currency ? v.currency.toLowerCase() : DEFAULT_PLAN.currency,
    interval: v.interval === "year" ? "year" : "month",
    demoPricing: v.demo_pricing !== false,
  };
}

export async function getCurrentSubscription(sql: SqlClient, organizationId: string): Promise<SubscriptionRecord | null> {
  const [row] = await sql.query<SubscriptionRecord>(
    `select id, organization_id, status, billing_provider, provider_customer_id, provider_subscription_id, price_cents, currency,
            current_period_end, cancel_at_period_end, livemode, created_at
     from public.subscriptions where organization_id = $1
     order by (status <> 'cancelled') desc, created_at desc limit 1`,
    [organizationId],
  );
  return row ?? null;
}

/** Records a billing event. Returns false when the provider event was already processed (idempotency). */
export async function recordBillingEvent(
  sql: SqlClient,
  e: { subscriptionId: string | null; organizationId: string | null; provider: BillingProviderName; providerEventId?: string | null; eventType: string; summary: string; livemode: boolean },
): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    `insert into public.billing_events (subscription_id, organization_id, billing_provider, provider_event_id, event_type, summary, livemode)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (provider_event_id) where provider_event_id is not null do nothing
     returning id`,
    [e.subscriptionId, e.organizationId, e.provider, e.providerEventId ?? null, e.eventType, e.summary, e.livemode],
  );
  return rows.length > 0;
}

/** True when a provider event id has already been recorded. */
export async function billingEventExists(sql: SqlClient, providerEventId: string) {
  const rows = await sql.query<{ id: string }>("select id from public.billing_events where provider_event_id = $1", [providerEventId]);
  return rows.length > 0;
}

async function managers(sql: SqlClient, organizationId: string) {
  const rows = await sql.query<{ user_id: string }>(
    "select user_id from public.provider_members where organization_id = $1 and status = 'active' and member_role in ('owner', 'manager')",
    [organizationId],
  );
  return rows.map((r) => r.user_id);
}

const STATUS_NOTICES: Partial<Record<SubscriptionStatus, (org: string, demo: boolean) => { kind: string; title: string; body: string }>> = {
  active: (org, demo) => ({
    kind: "subscription_active",
    title: "Your Enhanced listing subscription is active.",
    body: `Enhanced features are now enabled for ${org}.${demo ? " This is a demonstration subscription; no payment was processed." : ""} Verification status is not affected by billing.`,
  }),
  past_due: (org) => ({
    kind: "subscription_past_due",
    title: "Your Enhanced subscription is past due.",
    body: `Update your billing details to keep Enhanced features for ${org}. Verification status is not affected.`,
  }),
  cancelled: (org) => ({
    kind: "subscription_cancelled",
    title: "Your Enhanced listing subscription was cancelled.",
    body: `${org} is now a Free Listing. Your listing stays published and its verification status is unchanged.`,
  }),
};

export interface SubscriptionStateInput {
  organizationId: string;
  provider: BillingProviderName;
  /** Existing local subscription to update (takes precedence over provider id lookup). */
  subscriptionId?: string | null;
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  status: SubscriptionStatus;
  priceCents: number;
  currency: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  livemode: boolean;
  actorId: string | null;
  reason: string;
}

/**
 * Creates or updates a subscription, keeps organizations.listing_tier in sync,
 * audits the change and notifies the organization's managers when the status
 * changes. Returns deferred email senders for deliverAfterCommit().
 */
export async function applySubscriptionState(sql: SqlClient, input: SubscriptionStateInput) {
  let existing: { id: string; status: SubscriptionStatus } | undefined;
  if (input.subscriptionId) {
    [existing] = await sql.query<{ id: string; status: SubscriptionStatus }>(
      "select id, status from public.subscriptions where id = $1 and organization_id = $2 for update",
      [input.subscriptionId, input.organizationId],
    );
  }
  if (!existing && input.providerSubscriptionId) {
    [existing] = await sql.query<{ id: string; status: SubscriptionStatus }>(
      "select id, status from public.subscriptions where provider_subscription_id = $1 for update",
      [input.providerSubscriptionId],
    );
  }

  let subscriptionId: string;
  const previousStatus = existing?.status ?? null;
  if (existing) {
    subscriptionId = existing.id;
    await sql.query(
      `update public.subscriptions set status = $2, provider_customer_id = coalesce($3, provider_customer_id),
         provider_subscription_id = coalesce($4, provider_subscription_id), price_cents = $5, currency = $6,
         current_period_end = $7, cancel_at_period_end = $8, livemode = $9
       where id = $1`,
      [subscriptionId, input.status, input.providerCustomerId ?? null, input.providerSubscriptionId ?? null, input.priceCents, input.currency, input.currentPeriodEnd, input.cancelAtPeriodEnd, input.livemode],
    );
  } else {
    const [row] = await sql.query<{ id: string }>(
      `insert into public.subscriptions (organization_id, plan, status, billing_provider, provider_customer_id, provider_subscription_id,
         price_cents, currency, current_period_end, cancel_at_period_end, livemode, created_by)
       values ($1, 'enhanced', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [input.organizationId, input.status, input.provider, input.providerCustomerId ?? null, input.providerSubscriptionId ?? null, input.priceCents, input.currency, input.currentPeriodEnd, input.cancelAtPeriodEnd, input.livemode, input.actorId],
    );
    subscriptionId = row.id;
  }

  const [org] = await sql.query<{ title: string; listing_tier: string }>(
    "select l.title, o.listing_tier from public.organizations o join public.listings l on l.id = o.id where o.id = $1 for update of o",
    [input.organizationId],
  );
  const previousTier = org?.listing_tier ?? "free";
  const newTier = TIER_FOR_STATUS[input.status];
  if (newTier !== previousTier) {
    await sql.query("update public.organizations set listing_tier = $2 where id = $1", [input.organizationId, newTier]);
  }

  const senders: (() => Promise<boolean>)[] = [];
  if (previousStatus !== input.status) {
    await audit(sql, {
      actorId: input.actorId,
      actorLabel: input.actorId ? null : input.provider === "stripe" ? "Stripe webhook" : "Billing service",
      action: "billing.plan_changed",
      entityType: "organization",
      entityId: input.organizationId,
      entityLabel: org?.title ?? null,
      previous: { subscription_status: previousStatus, listing_tier: previousTier },
      next: { subscription_status: input.status, listing_tier: newTier },
      metadata: { subscription_id: subscriptionId, billing_provider: input.provider, livemode: input.livemode, reason: input.reason },
    });
    const notice = STATUS_NOTICES[input.status]?.(org?.title ?? "your organization", input.provider === "demo" || !input.livemode);
    if (notice) {
      for (const userId of await managers(sql, input.organizationId)) {
        senders.push(await notify(sql, { userId, ...notice, link: "/provider/plan", email: true }));
      }
    }
  }
  return { subscriptionId, previousStatus, previousTier, newTier, senders };
}

/** Adds one billing interval to a date (used by the demo adapter). */
export function addInterval(from: Date, interval: "month" | "year") {
  const d = new Date(from);
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCDate(d.getUTCDate() + 30);
  return d;
}
