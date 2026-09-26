import "server-only";
import { asService } from "@/lib/db";

export type AnalyticsEvent =
  | "search_performed"
  | "search_zero_results"
  | "filter_applied"
  | "filter_abandoned"
  | "provider_viewed"
  | "service_viewed"
  | "claim_started"
  | "claim_completed"
  | "correction_submitted"
  | "resource_saved"
  | "enhanced_upgrade_started"
  | "family_report_submitted";

/**
 * Privacy-conscious operational analytics: no user ids, no IP addresses,
 * no free-text beyond what the event needs. Failures never affect the user.
 */
export async function track(event: AnalyticsEvent, opts: { listingId?: string | null; properties?: Record<string, string | number | boolean | null> } = {}) {
  try {
    await asService((sql) =>
      sql.query("insert into public.analytics_events (event_name, listing_id, properties) values ($1, $2, $3)", [
        event,
        opts.listingId ?? null,
        JSON.stringify(opts.properties ?? {}),
      ]),
    );
  } catch (err) {
    console.warn("[analytics] event dropped", event, err instanceof Error ? err.message : err);
  }
}
