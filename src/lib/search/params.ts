// Client-safe search parameter model. The URL is the source of truth for
// every search: these helpers parse and serialize it identically on the
// server (SSR) and in the browser (client-side updates).

export const KINDS = ["organization", "service", "program", "resource", "event"] as const;
export type Kind = (typeof KINDS)[number];

export const DELIVERY = ["in_person", "virtual", "home_based"] as const;
export const DELIVERY_LABELS: Record<string, string> = { in_person: "In Person", virtual: "Virtual", home_based: "Home Based" };

export const SORTS = ["relevance", "distance", "recent", "name", "date"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  relevance: "Relevance",
  distance: "Distance",
  recent: "Recently verified",
  name: "Name (A–Z)",
  date: "Event date",
};

export const RADII = [5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS = 25;
export const PAGE_SIZE = 20;

/** Populations offered as search filters (client specification). */
export const FILTER_POPULATIONS = ["children", "teens", "adults", "older-adults", "families", "caregivers"] as const;

export interface SearchParams {
  q: string;
  location: string;
  radius: number | null;
  category: string[];
  population: string[];
  delivery: string[];
  kind: Kind[];
  verified: boolean;
  accepting: boolean;
  free: boolean;
  insurance: boolean;
  accessible: boolean;
  language: string;
  orgType: string;
  sort: Sort;
  page: number;
  view: "list" | "map";
}

export const EMPTY_PARAMS: SearchParams = {
  q: "",
  location: "",
  radius: null,
  category: [],
  population: [],
  delivery: [],
  kind: [],
  verified: false,
  accepting: false,
  free: false,
  insurance: false,
  accessible: false,
  language: "",
  orgType: "",
  sort: "relevance",
  page: 1,
  view: "list",
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function getAll(raw: RawParams, key: string): string[] {
  let values: string[];
  if (raw instanceof URLSearchParams) values = [...raw.getAll(key), ...raw.getAll(`${key}[]`)];
  else {
    const v = raw[key] ?? raw[`${key}[]`];
    values = v === undefined ? [] : Array.isArray(v) ? v : [v];
  }
  // Support both repeated keys and comma-separated values.
  return [...new Set(values.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean))];
}
function getOne(raw: RawParams, key: string): string {
  return getAll(raw, key)[0] ?? "";
}
const slugOk = (v: string) => /^[a-z0-9_-]{1,60}$/.test(v);
const flag = (v: string) => v === "1" || v === "true" || v === "on";

export function parseSearchParams(raw: RawParams): SearchParams {
  const radiusNum = Number(getOne(raw, "radius"));
  const pageNum = Number(getOne(raw, "page"));
  const sort = getOne(raw, "sort") as Sort;
  return {
    q: (raw instanceof URLSearchParams ? raw.get("q") ?? "" : [raw.q].flat()[0] ?? "").trim().slice(0, 200),
    location: (raw instanceof URLSearchParams ? raw.get("location") ?? "" : [raw.location].flat()[0] ?? "").trim().slice(0, 100),
    radius: (RADII as readonly number[]).includes(radiusNum) ? radiusNum : null,
    category: getAll(raw, "category").filter(slugOk).slice(0, 20),
    population: getAll(raw, "population").filter(slugOk).slice(0, 10),
    delivery: getAll(raw, "delivery").filter((d) => (DELIVERY as readonly string[]).includes(d)),
    kind: getAll(raw, "kind").filter((k): k is Kind => (KINDS as readonly string[]).includes(k)),
    verified: flag(getOne(raw, "verified")),
    accepting: flag(getOne(raw, "accepting")),
    free: flag(getOne(raw, "free")),
    insurance: flag(getOne(raw, "insurance")),
    accessible: flag(getOne(raw, "accessible")),
    language: slugOk(getOne(raw, "language")) ? getOne(raw, "language") : "",
    orgType: slugOk(getOne(raw, "orgType")) ? getOne(raw, "orgType") : "",
    sort: (SORTS as readonly string[]).includes(sort) ? sort : "relevance",
    page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(500, Math.floor(pageNum)) : 1,
    view: getOne(raw, "view") === "map" ? "map" : "list",
  };
}

/** Serialize to a stable query string (only non-default values). */
export function toQueryString(p: SearchParams, overrides: Partial<SearchParams> = {}): string {
  const s = { ...p, ...overrides };
  const out = new URLSearchParams();
  if (s.q) out.set("q", s.q);
  if (s.location) out.set("location", s.location);
  if (s.location && s.radius) out.set("radius", String(s.radius));
  for (const c of s.category) out.append("category", c);
  for (const c of s.population) out.append("population", c);
  for (const c of s.delivery) out.append("delivery", c);
  for (const c of s.kind) out.append("kind", c);
  if (s.verified) out.set("verified", "1");
  if (s.accepting) out.set("accepting", "1");
  if (s.free) out.set("free", "1");
  if (s.insurance) out.set("insurance", "1");
  if (s.accessible) out.set("accessible", "1");
  if (s.language) out.set("language", s.language);
  if (s.orgType) out.set("orgType", s.orgType);
  if (s.sort !== "relevance") out.set("sort", s.sort);
  if (s.page > 1) out.set("page", String(s.page));
  if (s.view === "map") out.set("view", "map");
  return out.toString();
}

export function searchHref(p: Partial<SearchParams>) {
  const qs = toQueryString({ ...EMPTY_PARAMS, ...p });
  return qs ? `/search?${qs}` : "/search";
}

/** Number of active refinement filters (excludes text query, location, sort, view, page). */
export function activeFilterCount(p: SearchParams) {
  return (
    p.category.length +
    p.population.length +
    p.delivery.length +
    p.kind.length +
    [p.verified, p.accepting, p.free, p.insurance, p.accessible, !!p.language, !!p.orgType].filter(Boolean).length
  );
}

export function hasCriteria(p: SearchParams) {
  return !!p.q || !!p.location || activeFilterCount(p) > 0;
}

/** Remove every refinement filter but keep query, location and view. */
export function clearFilters(p: SearchParams): SearchParams {
  return { ...EMPTY_PARAMS, q: p.q, location: p.location, radius: p.radius, view: p.view, sort: p.sort === "date" ? "relevance" : p.sort };
}

/** Filters as a privacy-safe JSON object (for search logs). */
export function filtersForLog(p: SearchParams) {
  const f: Record<string, unknown> = {};
  if (p.category.length) f.category = p.category;
  if (p.population.length) f.population = p.population;
  if (p.delivery.length) f.delivery = p.delivery;
  if (p.kind.length) f.kind = p.kind;
  for (const k of ["verified", "accepting", "free", "insurance", "accessible"] as const) if (p[k]) f[k] = true;
  if (p.language) f.language = p.language;
  if (p.orgType) f.orgType = p.orgType;
  return f;
}
