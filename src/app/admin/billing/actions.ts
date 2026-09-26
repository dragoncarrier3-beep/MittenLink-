"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { asService } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { deliverAfterCommit } from "@/lib/server/notifications";
import { applySubscriptionState, recordBillingEvent, type SubscriptionStatus } from "@/lib/integrations/billing";
import { parseForm, runAction, UserFacingError, type ActionState } from "@/lib/server/action";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/labels";

const Schema = z.object({
  subscriptionId: z.string().uuid(),
  status: z.enum(["active", "past_due", "cancelled", "trialing"], { error: "Choose a status." }),
});

const DAY = 86_400_000;

/**
 * Demo only: lets an administrator switch a DEMO subscription between states
 * to show how the platform behaves. Stripe subscriptions are read-only here.
 * Verification status is never touched.
 */
export async function setDemoSubscriptionStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const user = await assertRole("admin", "super_admin");
    const parsed = parseForm(Schema, formData);
    if (!parsed.ok) return parsed.state;
    const { subscriptionId, status } = parsed.data;

    const result = await asService(async (sql) => {
      const [sub] = await sql.query<{
        id: string; organization_id: string; status: SubscriptionStatus; billing_provider: string; price_cents: number; currency: string;
        current_period_end: Date | null; livemode: boolean; title: string;
      }>(
        `select s.id, s.organization_id, s.status, s.billing_provider, s.price_cents, s.currency, s.current_period_end, s.livemode, l.title
         from public.subscriptions s join public.listings l on l.id = s.organization_id where s.id = $1 for update of s`,
        [subscriptionId],
      );
      if (!sub) throw new UserFacingError("This subscription no longer exists.");
      if (sub.billing_provider !== "demo" || sub.livemode) throw new UserFacingError("Only demo subscriptions can be changed here. Stripe subscriptions are managed in Stripe.");
      if (sub.status === status) throw new UserFacingError(`This subscription is already ${SUBSCRIPTION_STATUS_LABELS[status]}.`);

      const now = Date.now();
      let periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if ((status === "active" || status === "trialing") && (!periodEnd || periodEnd.getTime() < now)) {
        periodEnd = new Date(now + (status === "trialing" ? 14 : 30) * DAY);
      }
      if (status === "past_due" && (!periodEnd || periodEnd.getTime() > now)) periodEnd = new Date(now - DAY);

      const applied = await applySubscriptionState(sql, {
        organizationId: sub.organization_id,
        provider: "demo",
        subscriptionId: sub.id,
        status,
        priceCents: sub.price_cents,
        currency: sub.currency,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        livemode: false,
        actorId: user.id,
        reason: "admin_demo_status_change",
      });
      await recordBillingEvent(sql, {
        subscriptionId: sub.id,
        organizationId: sub.organization_id,
        provider: "demo",
        eventType: "admin.status_changed",
        summary: `Status changed by administrator (demo): ${SUBSCRIPTION_STATUS_LABELS[sub.status]} → ${SUBSCRIPTION_STATUS_LABELS[status]}. No payment processed.`,
        livemode: false,
      });
      await audit(sql, {
        actorId: user.id,
        action: "billing.status_changed",
        entityType: "subscription",
        entityId: sub.id,
        entityLabel: sub.title,
        previous: { status: sub.status, listing_tier: applied.previousTier },
        next: { status, listing_tier: applied.newTier },
        metadata: { organization_id: sub.organization_id, billing_provider: "demo", demo: true },
      });
      return { title: sub.title, tier: applied.newTier, senders: applied.senders };
    }, user.id);

    const warning = await deliverAfterCommit(result.senders);
    revalidatePath("/admin/billing");
    revalidatePath("/admin/organizations");
    return {
      status: "success",
      message: `${result.title} is now ${SUBSCRIPTION_STATUS_LABELS[status]} (${result.tier === "enhanced" ? "Enhanced Listing" : "Free Listing"}). Verification status is unchanged.`,
      warning,
    };
  });
}
