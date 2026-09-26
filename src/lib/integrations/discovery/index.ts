import "server-only";
import type { SqlClient } from "@/lib/db";
import { AnthropicDiscoveryAssistant } from "./anthropic";
import { findDuplicateMatches } from "./duplicates";
import { RulesDiscoveryAssistant } from "./rules";
import type { CandidateInput, DiscoveryAssistant, DiscoveryContext, DiscoverySuggestions } from "./types";

export * from "./types";
export { findDuplicateMatches, domainOf, phoneDigits } from "./duplicates";
export { RulesDiscoveryAssistant } from "./rules";

/**
 * The configured assistant: Anthropic when ANTHROPIC_API_KEY is set,
 * otherwise the deterministic rules-based assistant (always available).
 */
export function getDiscoveryAssistant(): DiscoveryAssistant {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new AnthropicDiscoveryAssistant(key, process.env.ANTHROPIC_MODEL);
  return new RulesDiscoveryAssistant();
}

/** Loads taxonomy + gazetteer lists used by the assistants. */
export async function loadDiscoveryContext(sql: SqlClient): Promise<DiscoveryContext> {
  const [categories, populations, counties, cities] = await Promise.all([
    sql.query<{ slug: string; name: string; description: string | null }>("select slug, name, description from public.categories where is_active order by sort_order, name"),
    sql.query<{ slug: string; name: string }>("select slug, name from public.populations order by sort_order, name"),
    sql.query<{ name: string }>("select name from public.counties order by name"),
    sql.query<{ name: string; county: string }>(
      "select distinct on (p.name) p.name, c.name as county from public.places p join public.counties c on c.id = p.county_id where p.kind = 'city' order by p.name, p.population desc nulls last",
    ),
  ]);
  return { categories, populations, counties: counties.map((c) => c.name), cities };
}

export type GenerateResult =
  | { ok: true; suggestions: DiscoverySuggestions; engine: string; kind: "ai" | "rules"; fellBack: boolean }
  | { ok: false };

/**
 * Produces suggestions for a candidate. Tries the configured assistant; on any
 * failure falls back to rules. Duplicate matches always come from SQL.
 * Returns { ok: false } only if even the rules-based assistant fails.
 */
export async function generateSuggestions(
  sql: SqlClient,
  candidate: CandidateInput,
  opts: { ignoreDomain?: string | null; excludeListingId?: string | null } = {},
): Promise<GenerateResult> {
  let ctx: DiscoveryContext;
  try {
    ctx = await loadDiscoveryContext(sql);
  } catch (err) {
    console.error("[discovery] could not load context", err);
    return { ok: false };
  }
  const primary = getDiscoveryAssistant();
  let assistant: DiscoveryAssistant = primary;
  let fellBack = false;
  let core: Omit<DiscoverySuggestions, "duplicates"> | null = null;
  try {
    core = await primary.analyze(candidate, ctx);
  } catch (err) {
    console.warn(`[discovery] ${primary.name} failed; falling back to rules`, err instanceof Error ? err.message : err);
    if (primary.kind !== "rules") {
      assistant = new RulesDiscoveryAssistant();
      fellBack = true;
      try {
        core = await assistant.analyze(candidate, ctx);
      } catch (err2) {
        console.error("[discovery] rules assistant failed", err2);
      }
    }
  }
  if (!core) return { ok: false };

  let duplicates: DiscoverySuggestions["duplicates"] = [];
  try {
    const matches = await findDuplicateMatches(sql, {
      name: candidate.name,
      url: candidate.url,
      phone: core.organization.phone,
      ignoreDomain: opts.ignoreDomain,
      excludeListingId: opts.excludeListingId,
    });
    duplicates = matches.map((m) => ({ listing_id: m.listing_id, confidence: m.confidence }));
  } catch (err) {
    console.error("[discovery] duplicate lookup failed", err);
  }
  return {
    ok: true,
    suggestions: { ...core, duplicates, generated_at: new Date().toISOString() },
    engine: assistant.engineId,
    kind: assistant.kind,
    fellBack,
  };
}
