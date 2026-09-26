import { KIND_PLURAL } from "@/lib/labels";

/*
 * Saved search params are stored as the search page's query-string values
 * ({ q, location, radius, type, category, ... }). These helpers turn them back
 * into a /search URL and a readable one-line summary.
 */

type ParamValue = string | number | boolean | null | undefined | (string | number)[];
export type SavedSearchParams = Record<string, ParamValue>;

export function savedSearchHref(params: SavedSearchParams | null | undefined) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, String(v)));
    else qs.set(key, value === true ? "1" : String(value));
  }
  const s = qs.toString();
  return s ? `/search?${s}` : "/search";
}

const FLAG_LABELS: Record<string, string> = {
  verified: "verified only",
  verified_only: "verified only",
  accepting: "accepting new clients",
  accepting_only: "accepting new clients",
  free: "free",
  free_only: "free",
  insurance: "accepts insurance",
  insurance_only: "accepts insurance",
  accessible: "wheelchair accessible",
  accessible_only: "wheelchair accessible",
  statewide: "includes statewide options",
  virtual: "virtual options",
};

const SKIP = new Set(["page", "sort", "view", "lat", "lng", "county_id", "countyId"]);

const humanize = (s: string) => s.replace(/[-_]+/g, " ").trim();
const list = (v: ParamValue) => (Array.isArray(v) ? v.map(String) : v === null || v === undefined || v === "" ? [] : String(v).split(","));

export function describeSavedSearch(params: SavedSearchParams | null | undefined): string {
  const p = params ?? {};
  const parts: string[] = [];
  const q = p.q ?? p.query;
  if (q) parts.push(`“${String(q)}”`);
  const kinds = list(p.type ?? p.kind ?? p.kinds);
  if (kinds.length) parts.push(kinds.map((k) => KIND_PLURAL[k]?.toLowerCase() ?? humanize(k)).join(", "));
  const categories = list(p.category ?? p.categories);
  if (categories.length) parts.push(`in ${categories.map(humanize).join(", ")}`);
  const populations = list(p.population ?? p.populations);
  if (populations.length) parts.push(`for ${populations.map(humanize).join(", ")}`);
  const location = p.location ?? p.near ?? p.zip;
  if (location) parts.push(`${p.radius ? `within ${p.radius} miles of` : "near"} ${String(location)}`);
  else if (p.county) parts.push(`in ${humanize(String(p.county))} County`);
  const delivery = list(p.delivery);
  if (delivery.length) parts.push(delivery.map(humanize).join(" or "));
  if (p.language) parts.push(`in ${humanize(String(p.language))}`);
  const flags = Object.entries(p)
    .filter(([k, v]) => FLAG_LABELS[k] && (v === true || v === "1" || v === "true" || v === 1))
    .map(([k]) => FLAG_LABELS[k]);
  const handled = new Set(["q", "query", "type", "kind", "kinds", "category", "categories", "population", "populations", "location", "near", "zip", "radius", "county", "delivery", "language", ...Object.keys(FLAG_LABELS)]);
  const other = Object.entries(p)
    .filter(([k, v]) => !handled.has(k) && !SKIP.has(k) && v !== null && v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => `${humanize(k)}: ${list(v).map(humanize).join(", ")}`);
  const all = [...parts, ...flags, ...other];
  return all.length ? all.join(" · ") : "All resources";
}
