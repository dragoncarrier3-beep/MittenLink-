/**
 * AI-assisted discovery contracts.
 *
 * A DiscoveryAssistant only ever produces SUGGESTIONS for a human reviewer.
 * It never verifies, publishes, imports, or overrides an admin decision.
 * Duplicate matching is always done in SQL (see ./duplicates.ts), never by a model.
 */

export interface CandidateInput {
  name: string;
  url: string | null;
  excerpt: string | null;
  possibleCity: string | null;
  possibleCounty: string | null;
  sourceName: string | null;
}

export interface TaxonomyOption {
  slug: string;
  name: string;
  description?: string | null;
}

export interface DiscoveryContext {
  categories: TaxonomyOption[];
  populations: TaxonomyOption[];
  /** Michigan county names (without the word "County"). */
  counties: string[];
  /** Known Michigan cities with their county, used for location extraction. */
  cities: { name: string; county: string }[];
}

export interface ExtractedDetails {
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  website: string | null;
}

export interface CategorySuggestion {
  slug: string;
  confidence: number; // 0..1
  reason?: string | null;
}

/** Shape stored in source_watch_candidates.suggestions (compatible with seeded rows). */
export interface DiscoverySuggestions {
  category: CategorySuggestion | null;
  populations: string[];
  summary: string | null;
  organization: ExtractedDetails;
  duplicates: { listing_id: string; confidence: number }[];
  generated_at?: string;
}

export interface DiscoveryAssistant {
  readonly name: string;
  readonly kind: "ai" | "rules";
  /** Value stored in source_watch_candidates.suggestion_engine. */
  readonly engineId: string;
  suggestCategory(c: CandidateInput, ctx: DiscoveryContext): Promise<CategorySuggestion | null>;
  extractOrganizationDetails(c: CandidateInput, ctx: DiscoveryContext): Promise<ExtractedDetails>;
  suggestPopulations(c: CandidateInput, ctx: DiscoveryContext): Promise<string[]>;
  summarize(c: CandidateInput, ctx: DiscoveryContext): Promise<string | null>;
  /** All suggestions at once (duplicates are filled in separately via SQL). */
  analyze(c: CandidateInput, ctx: DiscoveryContext): Promise<Omit<DiscoverySuggestions, "duplicates">>;
}

export interface DuplicateMatch {
  listing_id: string;
  confidence: number; // 0..100
  kind: string;
  slug: string;
  title: string;
  publication_status: string;
  verification_status: string;
  city: string | null;
  county: string | null;
  website: string | null;
  phone: string | null;
  signals: { name_similarity: number; same_website_domain: boolean; same_phone: boolean };
}

export const AI_LABEL = "AI Suggested — Requires Human Review";
export const RULES_LABEL = "Automated Suggestion (rules-based) — Requires Human Review";
export const UNAVAILABLE_MESSAGE = "Automated suggestions are unavailable. You can continue reviewing this resource manually.";

/** True only when a real language model produced the stored suggestions. */
export function isModelEngine(engine: string | null | undefined) {
  return !!engine && engine.startsWith("anthropic:");
}

export function suggestionLabel(engine: string | null | undefined) {
  return isModelEngine(engine) ? AI_LABEL : RULES_LABEL;
}
