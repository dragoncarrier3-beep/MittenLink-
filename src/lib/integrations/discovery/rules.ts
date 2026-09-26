import type { CandidateInput, CategorySuggestion, DiscoveryAssistant, DiscoveryContext, ExtractedDetails } from "./types";

/**
 * Deterministic, always-available discovery assistant. It maps keywords to
 * categories/populations and extracts contact details with regular
 * expressions. No network calls; no model. Output is labeled
 * "Automated Suggestion (rules-based) — Requires Human Review".
 */

// Extra keywords per category slug (category names and descriptions are also used).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "autism-services": ["autism", "autistic", "asd", "aba", "neurodivergent"],
  employment: ["job", "jobs", "employment", "career", "vocational", "job coach", "supported employment", "workforce"],
  transportation: ["ride", "rides", "transport", "transportation", "transit", "paratransit", "bus", "wheelchair-accessible van", "travel training"],
  housing: ["housing", "home modification", "apartment", "supported living", "rent", "voucher"],
  "mental-health": ["mental health", "counseling", "behavioral health", "peer support", "therapy group", "crisis"],
  "assistive-technology": ["assistive technology", "device", "devices", "equipment", "aac", "loan closet", "lending library"],
  education: ["iep", "special education", "school", "tutoring", "transition planning", "education"],
  recreation: ["recreation", "adaptive sports", "kayak", "kayaking", "paddling", "paddleboard", "camp", "hand-cycling", "inclusive", "sports", "arts", "trail", "trails", "nature"],
  "independent-living": ["independent living", "life skills", "peer mentoring", "cil"],
  "caregiver-support": ["caregiver", "caregivers", "support group", "support meetings", "family support"],
  "legal-advocacy": ["legal", "rights", "advocacy", "attorney", "self-advocacy", "guardianship"],
  "financial-assistance": ["benefits", "ssi", "ssdi", "financial", "medicaid", "able account", "assistance program"],
  "therapy-services": ["occupational therapy", "speech therapy", "physical therapy", "speech", "ot", "pt"],
  "respite-care": ["respite", "caregiver break", "short-term care"],
  "early-intervention": ["early intervention", "early on", "infant", "infants", "toddler", "toddlers"],
  "deaf-hard-of-hearing": ["deaf", "hard of hearing", "asl", "interpreter", "interpreters", "captioning", "hearing"],
  "vision-services": ["blind", "low vision", "braille", "orientation and mobility", "visually impaired"],
  "health-care": ["clinic", "medical", "health care", "primary care", "dental", "dentist"],
};

const POPULATION_KEYWORDS: Record<string, string[]> = {
  children: ["child", "children", "kids", "pediatric", "youth", "infant", "toddler"],
  teens: ["teen", "teens", "adolescent", "high school", "young adult", "transition-age"],
  adults: ["adult", "adults", "residents", "people with disabilities", "adults with disabilities"],
  "older-adults": ["older adult", "older adults", "senior", "seniors", "age 60", "aging", "60+", "65+"],
  families: ["family", "families", "parent", "parents", "member families"],
  caregivers: ["caregiver", "caregivers", "respite"],
  veterans: ["veteran", "veterans", "military"],
  professionals: ["professional", "professionals", "educators", "clinicians", "providers"],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsWord = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(word.toLowerCase())}([^a-z0-9]|$)`).test(text);

function haystack(c: CandidateInput) {
  return `${c.name} ${c.excerpt ?? ""}`.toLowerCase();
}

export class RulesDiscoveryAssistant implements DiscoveryAssistant {
  readonly name = "Rules-based assistant";
  readonly kind = "rules" as const;
  readonly engineId = "rules";

  async suggestCategory(c: CandidateInput, ctx: DiscoveryContext): Promise<CategorySuggestion | null> {
    const text = haystack(c);
    let best: { slug: string; score: number; hits: string[] } | null = null;
    for (const cat of ctx.categories) {
      const words = new Set<string>([cat.name.toLowerCase(), ...(CATEGORY_KEYWORDS[cat.slug] ?? [])]);
      const hits = [...words].filter((w) => w.length > 1 && containsWord(text, w));
      // Name matches weigh more than excerpt-only matches.
      const nameHits = hits.filter((w) => containsWord(c.name.toLowerCase(), w)).length;
      const score = hits.length + nameHits * 0.5;
      if (score > 0 && (!best || score > best.score)) best = { slug: cat.slug, score, hits };
    }
    if (!best) return null;
    return {
      slug: best.slug,
      confidence: Math.min(0.9, Math.round((0.45 + best.score * 0.12) * 100) / 100),
      reason: `Matched keywords: ${best.hits.slice(0, 4).join(", ")}`,
    };
  }

  async suggestPopulations(c: CandidateInput, ctx: DiscoveryContext): Promise<string[]> {
    const text = haystack(c);
    const allowed = new Set(ctx.populations.map((p) => p.slug));
    return Object.entries(POPULATION_KEYWORDS)
      .filter(([slug, words]) => allowed.has(slug) && words.some((w) => containsWord(text, w)))
      .map(([slug]) => slug);
  }

  async extractOrganizationDetails(c: CandidateInput, ctx: DiscoveryContext): Promise<ExtractedDetails> {
    const raw = `${c.name}\n${c.excerpt ?? ""}`;
    const phone = raw.match(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/)?.[0] ?? null;
    const email = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase() ?? null;
    const zip = raw.match(/\b4[89]\d{3}\b/)?.[0] ?? null;
    const address =
      raw.match(/\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Highway|Hwy|Court|Ct|Way|Parkway|Pkwy)\b\.?/)?.[0] ?? null;

    const lower = raw.toLowerCase();
    let county: string | null = null;
    const countyMatch = raw.match(/\b([A-Z][A-Za-z.]+(?:\s[A-Z][A-Za-z.]+)?)\s+(?:County|counties)\b/);
    if (countyMatch) {
      const name = ctx.counties.find((n) => n.toLowerCase() === countyMatch[1].toLowerCase());
      if (name) county = name;
    }
    // Longest city names first so "Grand Rapids" wins over "Grand".
    let city: string | null = null;
    for (const place of [...ctx.cities].sort((a, b) => b.name.length - a.name.length)) {
      if (place.name.length > 3 && containsWord(lower, place.name.toLowerCase())) {
        city = place.name;
        county = county ?? place.county;
        break;
      }
    }
    if (!county) {
      const name = ctx.counties.find((n) => n.length > 3 && containsWord(lower, n.toLowerCase()));
      if (name) county = name;
    }
    return {
      phone,
      email,
      address,
      city: city ?? c.possibleCity,
      county: county ?? c.possibleCounty,
      zip,
      website: c.url,
    };
  }

  async summarize(c: CandidateInput, ctx: DiscoveryContext): Promise<string | null> {
    const excerpt = c.excerpt?.replace(/\s+/g, " ").trim();
    if (excerpt) {
      const first = excerpt.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? excerpt;
      return first.length > 240 ? `${first.slice(0, 237).trimEnd()}…` : first;
    }
    const cat = await this.suggestCategory(c, ctx);
    const catName = cat ? ctx.categories.find((x) => x.slug === cat.slug)?.name : null;
    const where = c.possibleCity ?? (c.possibleCounty ? `${c.possibleCounty} County` : null);
    if (!catName && !where) return null;
    return `${c.name}: possible ${catName ? catName.toLowerCase() + " " : ""}resource${where ? ` in ${where}` : ""}.`;
  }

  async analyze(c: CandidateInput, ctx: DiscoveryContext) {
    const [category, populations, organization, summary] = await Promise.all([
      this.suggestCategory(c, ctx),
      this.suggestPopulations(c, ctx),
      this.extractOrganizationDetails(c, ctx),
      this.summarize(c, ctx),
    ]);
    return { category, populations, organization, summary };
  }
}
