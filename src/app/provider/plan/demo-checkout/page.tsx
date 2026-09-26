import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { PageHeader, Panel, DetailList } from "@/components/common/page";
import { getBillingOverview, loadProviderContext } from "@/lib/data/provider";
import { getBillingAdapter } from "@/lib/integrations/billing";
import { formatCents } from "@/lib/format";
import { DemoCheckoutButtons } from "../plan-controls";

export const metadata: Metadata = { title: "Demonstration Checkout" };

export default async function DemoCheckoutPage() {
  const ctx = await loadProviderContext("/provider/plan/demo-checkout");
  if (getBillingAdapter().name !== "demo") redirect("/provider/plan");
  if (!ctx.canManageBilling) redirect("/provider/plan");
  const { plan, subscription } = await getBillingOverview(ctx.org.id);
  if (subscription && ["active", "trialing"].includes(subscription.status)) redirect("/provider/plan");

  return (
    <>
      <PageHeader
        title="Demonstration checkout"
        breadcrumbs={[{ label: "Listing Plan", href: "/provider/plan" }, { label: "Demonstration checkout" }]}
      />
      <div className="mb-6 flex items-start gap-3 rounded-lg border-2 border-warning/50 bg-warning-soft p-4">
        <FlaskConical className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="text-lg font-bold">Demonstration checkout — no card is collected and no payment is processed.</p>
          <p className="mt-1">
            This page stands in for a payment processor during the MittenLink demonstration. Completing it records a demonstration subscription only.
          </p>
        </div>
      </div>
      <Panel className="flex max-w-2xl flex-col gap-5">
        <h2 className="text-xl font-bold">Order summary</h2>
        <DetailList
          items={[
            { label: "Organization", value: ctx.org.title },
            { label: "Plan", value: plan.name },
            { label: "Price", value: `${formatCents(plan.priceCents, plan.currency)} per ${plan.interval}${plan.demoPricing ? " (demonstration pricing)" : ""}` },
            { label: "Billing period", value: plan.interval === "year" ? "12 months" : "30 days" },
            { label: "Charged today", value: "$0.00 — demonstration, no payment processed" },
          ]}
        />
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Verification is free and never depends on payment. Enhanced placement is always labeled and never presented as a recommendation.
        </p>
        <DemoCheckoutButtons />
      </Panel>
    </>
  );
}
