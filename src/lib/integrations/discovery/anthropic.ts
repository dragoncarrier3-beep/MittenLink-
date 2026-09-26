import "server-only";
import { z } from "zod";
import type { CandidateInput, CategorySuggestion, DiscoveryAssistant, DiscoveryContext, DiscoverySuggestions, ExtractedDetails } from "./types";

/**
 * Discovery assistant backed by the Anthropic Messages API. Used only when
 * ANTHROPIC_API_KEY is configured. It returns suggestions for a human
 * reviewer — it never verifies, publishes, or imports anything. Any failure
 * (network, timeout, invalid JSON) throws so the caller can fall back to the
 * rules-based assistant.
 */

const nullableText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null));

const ResponseSchema = z.object({
  category_slug: z.union([z.string(), z.null()]).optional(),
  category_confidence: z.number().min(0).max(1).optional(),
  populations: z.array(z.string()).max(12).optional().default([]),
  summary: nullableText,
  phone: nullableText,
  email: nullableText,
  address: nullableText,
  city: nullableText,
  county: nullableText,
  website: nullableText,
});

type Parsed = z.infer<typeof ResponseSchema>;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain JSON");
  return JSON.parse(body.slice(start, end + 1));
}

export class AnthropicDiscoveryAssistant implements DiscoveryAssistant {
  readonly name = "Anthropic Claude";
  readonly kind = "ai" as const;
  readonly engineId: string;
  private readonly model: string;
  private cache = new WeakMap<CandidateInput, Promise<Parsed>>();

  constructor(private readonly apiKey: string, model?: string) {
    this.model = model || "claude-sonnet-5";
    this.engineId = `anthropic:${this.model}`;
  }

  private prompt(c: CandidateInput, ctx: DiscoveryContext) {
    return [
      "You help staff at MittenLink, a Michigan disability resource directory, review a possible new resource.",
      "Your output is only a suggestion; a human reviews everything. Do not invent details that are not in the text.",
      "",
      "Respond with STRICT JSON only (no prose, no code fences) matching this shape:",
      '{"category_slug": string|null, "category_confidence": number (0-1), "populations": string[], "summary": string|null, "phone": string|null, "email": string|null, "address": string|null, "city": string|null, "county": string|null, "website": string|null}',
      "",
      `Allowed category slugs: ${ctx.categories.map((x) => `${x.slug} (${x.name})`).join(", ")}`,
      `Allowed population slugs: ${ctx.populations.map((x) => x.slug).join(", ")}`,
      "county must be a Michigan county name without the word 'County', or null. summary: one plain-language sentence, max 200 characters.",
      "",
      "Candidate:",
      `Name: ${c.name}`,
      `URL: ${c.url ?? "(none)"}`,
      `Found on source: ${c.sourceName ?? "(unknown)"}`,
      `Possible city: ${c.possibleCity ?? "(unknown)"}; possible county: ${c.possibleCounty ?? "(unknown)"}`,
      `Excerpt: ${c.excerpt ?? "(none)"}`,
    ].join("\n");
  }

  private run(c: CandidateInput, ctx: DiscoveryContext): Promise<Parsed> {
    const cached = this.cache.get(c);
    if (cached) return cached;
    const p = (async () => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, max_tokens: 800, messages: [{ role: "user", content: this.prompt(c, ctx) }] }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Anthropic API responded ${res.status}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      const parsed = ResponseSchema.safeParse(extractJson(text));
      if (!parsed.success) throw new Error("Model response failed validation");
      return parsed.data;
    })();
    this.cache.set(c, p);
    return p;
  }

  async suggestCategory(c: CandidateInput, ctx: DiscoveryContext): Promise<CategorySuggestion | null> {
    const r = await this.run(c, ctx);
    const slug = r.category_slug && ctx.categories.some((x) => x.slug === r.category_slug) ? r.category_slug : null;
    return slug ? { slug, confidence: r.category_confidence ?? 0.7, reason: null } : null;
  }

  async suggestPopulations(c: CandidateInput, ctx: DiscoveryContext): Promise<string[]> {
    const r = await this.run(c, ctx);
    const allowed = new Set(ctx.populations.map((p) => p.slug));
    return [...new Set(r.populations.filter((p) => allowed.has(p)))];
  }

  async extractOrganizationDetails(c: CandidateInput, ctx: DiscoveryContext): Promise<ExtractedDetails> {
    const r = await this.run(c, ctx);
    const county = r.county ? ctx.counties.find((n) => n.toLowerCase() === r.county!.replace(/\s+county$/i, "").toLowerCase()) ?? null : null;
    const zip = r.address?.match(/\b4[89]\d{3}\b/)?.[0] ?? null;
    return { phone: r.phone, email: r.email, address: r.address, city: r.city, county, zip, website: r.website ?? c.url };
  }

  async summarize(c: CandidateInput, ctx: DiscoveryContext) {
    return (await this.run(c, ctx)).summary;
  }

  async analyze(c: CandidateInput, ctx: DiscoveryContext): Promise<Omit<DiscoverySuggestions, "duplicates">> {
    const [category, populations, organization, summary] = await Promise.all([
      this.suggestCategory(c, ctx),
      this.suggestPopulations(c, ctx),
      this.extractOrganizationDetails(c, ctx),
      this.summarize(c, ctx),
    ]);
    return { category, populations, organization, summary };
  }
}
