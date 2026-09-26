"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { asService } from "@/lib/db";
import { AuthorizationError, assertOrganizationAccess, assertSignedIn } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/provider/active-org";
import { deliverAfterCommit } from "@/lib/server/notifications";
import { track } from "@/lib/server/analytics";
import { runAction, UserFacingError } from "@/lib/server/action";
import type { ActionState } from "@/lib/server/action-types";
import {
  CHECKOUT_FAILED_MESSAGE,
  StripeBillingAdapter,
  cancelSubscriptionRecord,
  completeDemoCheckout,
  getBillingAdapter,
  getCurrentSubscription,
  getPlanSettings,
  resolveDemoPastDue,
} from "@/lib/integrations/billing";

/** Only active owners/managers of the organization can manage billing. */
async function assertBillingManager() {
  const user = await assertSignedIn();
  const org = await getActiveOrganization(user);
  if (!org) throw new AuthorizationError("Choose an organization you manage first.");
  await assertOrganizationAccess(org.id);
  const [member] = await asService((sql) =>
    sql.query<{ member_role: string }>("select member_role from public.provider_members where organization_id = $1 and user_id = $2 and status = 'active'", [org.id, user.id]),
  );
  if (!member || !["owner", "manager"].includes(member.member_role)) {
    throw new AuthorizationError("Only organization owners and managers can manage the listing plan.");
  }
  return { user, org };
}

async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured && process.env.NODE_ENV === "production") return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : configured ?? "http://localhost:3000";
}

export async function startUpgrade(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  let redirectUrl: string | null = null;
  const state = await runAction(null, async () => {
    const { user, org } = await assertBillingManager();
    const { plan, current } = await asService(async (sql) => ({ plan: await getPlanSettings(sql), current: await getCurrentSubscription(sql, org.id) }));
    if (current && ["active", "trialing", "past_due"].includes(current.status)) {
      throw new UserFacingError("This organization already has an Enhanced subscription.");
    }
    const adapter = getBillingAdapter();
    await track("enhanced_upgrade_started", { listingId: org.id, properties: { provider: adapter.name } });
    const origin = await siteOrigin();
    try {
      const result = await adapter.createCheckout(
        { id: org.id, title: org.title },
        { id: user.id, email: user.email, fullName: user.fullName },
        {
          successUrl: `${origin}/provider/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/provider/plan?checkout=cancelled`,
        },
        plan,
      );
      redirectUrl = result.redirectUrl;
    } catch (err) {
      console.error("[billing] checkout could not start", err);
      throw new UserFacingError(CHECKOUT_FAILED_MESSAGE);
    }
    return { status: "success", message: "Redirecting to checkout…" };
  });
  if (redirectUrl) redirect(redirectUrl);
  return state;
}

export async function completeDemoCheckoutAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  let done = false;
  const state = await runAction(null, async () => {
    const { user, org } = await assertBillingManager();
    if (getBillingAdapter().name !== "demo") throw new UserFacingError("Demonstration checkout is not available because Stripe test mode is configured.");
    let result;
    try {
      result = await asService(async (sql) => completeDemoCheckout(sql, { id: org.id, title: org.title }, user.id, await getPlanSettings(sql)), user.id);
    } catch (err) {
      console.error("[billing] demo checkout failed", err);
      throw new UserFacingError(CHECKOUT_FAILED_MESSAGE);
    }
    if (result.alreadyActive) throw new UserFacingError("This organization already has an active Enhanced subscription.");
    await deliverAfterCommit(result.senders);
    revalidatePath("/provider", "layout");
    done = true;
    return { status: "success", message: "Demo checkout completed." };
  });
  if (done) redirect("/provider/plan?checkout=success");
  return state;
}

export async function cancelSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, async () => {
    const { user, org } = await assertBillingManager();
    if (fd.get("confirm") !== "on") {
      throw new UserFacingError("Please confirm that you want to cancel.", { confirm: "Check this box to confirm cancellation." });
    }
    const sub = await asService((sql) => getCurrentSubscription(sql, org.id));
    if (!sub || sub.status === "cancelled") throw new UserFacingError("There is no active subscription to cancel.");
    if (sub.billing_provider === "stripe") {
      const adapter = getBillingAdapter();
      if (adapter instanceof StripeBillingAdapter) {
        try {
          await adapter.cancel(sub);
        } catch (err) {
          console.error("[billing] stripe cancel failed", err);
          throw new UserFacingError("We couldn't reach the payment processor to cancel. Nothing was changed — please try again.");
        }
      }
    }
    const result = await asService((sql) => cancelSubscriptionRecord(sql, sub, user.id), user.id);
    const warning = await deliverAfterCommit(result.senders);
    revalidatePath("/provider", "layout");
    return {
      status: "success",
      message: "Your Enhanced subscription was cancelled. Your organization is now a Free Listing. It stays published and its verification status is unchanged.",
      warning,
    };
  });
}

export async function resolvePastDueAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  let portalUrl: string | null = null;
  const state = await runAction(null, async () => {
    const { user, org } = await assertBillingManager();
    const { sub, plan } = await asService(async (sql) => ({ sub: await getCurrentSubscription(sql, org.id), plan: await getPlanSettings(sql) }));
    if (!sub || sub.status !== "past_due") throw new UserFacingError("This subscription is not past due.");
    if (sub.billing_provider === "stripe") {
      const adapter = getBillingAdapter();
      if (!(adapter instanceof StripeBillingAdapter) || !sub.provider_customer_id) {
        throw new UserFacingError("Billing updates for this subscription are unavailable right now. Please contact MittenLink support.");
      }
      try {
        portalUrl = await adapter.createPortalSession(sub.provider_customer_id, `${await siteOrigin()}/provider/plan`);
      } catch (err) {
        console.error("[billing] portal session failed", err);
        throw new UserFacingError("We couldn't open the billing page. No changes were made — please try again.");
      }
      return { status: "success", message: "Opening billing…" };
    }
    const result = await asService((sql) => resolveDemoPastDue(sql, sub, user.id, plan), user.id);
    const warning = await deliverAfterCommit(result.senders);
    revalidatePath("/provider", "layout");
    return { status: "success", message: "The past-due balance was resolved for this demonstration. No payment was processed. Your Enhanced subscription is active.", warning };
  });
  if (portalUrl) redirect(portalUrl);
  return state;
}
