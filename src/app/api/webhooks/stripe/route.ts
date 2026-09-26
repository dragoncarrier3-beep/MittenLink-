import { getBillingAdapter } from "@/lib/integrations/billing";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint. The signature is verified against the RAW request
 * body (stripe.webhooks.constructEvent) before anything is processed; events
 * are idempotent through billing_events.provider_event_id.
 */
export async function POST(request: Request) {
  const adapter = getBillingAdapter();
  if (adapter.name !== "stripe" || !adapter.handleWebhook) {
    return Response.json({ error: "Stripe billing is not configured. The demonstration billing adapter is active." }, { status: 404 });
  }
  const rawBody = await request.text();
  try {
    const result = await adapter.handleWebhook(rawBody, request.headers.get("stripe-signature"));
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    console.error("[webhooks:stripe] processing failed", err);
    // 500 lets Stripe retry; already-processed events are skipped idempotently.
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
