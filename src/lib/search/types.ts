// Client-safe types shared by the search API, SSR page and UI.

export type MatchScope = "nearby" | "serves_area" | "statewide" | "anywhere";

export interface ListingPoint {
  lat: number;
  lng: number;
  label: string | null;
}

/** Everything a result card needs (dates are ISO strings so JSON and RSC both work). */
export interface ListingCardData {
  id: string;
  kind: "organization" | "service" | "program" | "resource" | "event";
  slug: string;
  title: string;
  summary: string;
  city: string | null;
  county: string | null;
  distanceMiles: number | null;
  matchScope: MatchScope | null;
  statewide: boolean;
  virtual: boolean;
  categories: { slug: string; name: string }[];
  populations: string[];
  verificationStatus: string;
  lastVerifiedAt: string | null;
  /** Listing tier of the organization (own or parent). Informational only — never used for ranking. */
  tier: "free" | "enhanced" | null;
  parent: { title: string; slug: string } | null;
  event: { startsAt: string; endsAt: string; isInPerson: boolean; venue: string | null; eventType: string } | null;
  resourceType: string | null;
  points: ListingPoint[];
}

export interface ResolvedLocation {
  kind: "city" | "zip" | "county";
  label: string;
  countyId: number;
  countyName: string;
  lat: number | null;
  lng: number | null;
  /** Radius actually applied (null for county matches). */
  radius: number | null;
}

export interface SearchFallback {
  /** Related resources found by broadening the search (never invented). */
  related: ListingCardData[];
  relatedLabel: string;
  relatedHref: string | null;
}

export interface SearchResponse {
  ok: true;
  results: ListingCardData[];
  total: number;
  localCount: number;
  statewideCount: number;
  page: number;
  pageSize: number;
  location: ResolvedLocation | null;
  /** The location text could not be matched to a Michigan place. */
  locationUnmatched: string | null;
  /** The location text was matched to a similarly spelled place. */
  locationCorrectedFrom: string | null;
  /** Natural-language query was split into query + location. */
  interpreted: { q: string; location: string } | null;
  outcome: "ok" | "low" | "zero";
  /** Local results are zero for a located search (statewide may still exist). */
  noLocalMatch: boolean;
  fallback: SearchFallback | null;
  savedIds: string[];
  signedIn: boolean;
}

export interface SearchErrorResponse {
  ok: false;
  error: string;
}

export interface PlaceSuggestion {
  id: string;
  kind: "city" | "zip" | "county";
  label: string;
  detail: string;
}

export interface FilterOptions {
  categories: { slug: string; name: string }[];
  populations: { slug: string; name: string }[];
  languages: { code: string; name: string }[];
  orgTypes: { value: string; label: string }[];
}
