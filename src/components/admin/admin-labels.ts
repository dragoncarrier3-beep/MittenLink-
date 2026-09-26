// Client-safe labels and helpers used across the admin record screens.

export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed; undefined when empty. */
export function sp(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const t = v?.trim();
  return t ? t : undefined;
}

/** Build a URL that keeps current filters and applies overrides (undefined/"" removes a key). */
export function hrefWith(base: string, current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  const merged: Record<string, string | number | undefined> = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && !(k === "page" && String(v) === "1")) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export const PUBLICATION_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  published: "Published",
  archived: "Archived",
};

export const PUBLICATION_TONE: Record<string, "success" | "warning" | "neutral" | "info"> = {
  draft: "neutral",
  pending: "info",
  published: "success",
  archived: "neutral",
};

export const LOCATION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  temporarily_closed: "Temporarily closed",
  closed: "Closed",
};

export const CONTACT_KIND_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  website: "Website",
  address: "Address",
  fax: "Fax",
};

export const CONTACT_SOURCE_LABELS: Record<string, string> = {
  official_website: "Official website",
  government_source: "Government source",
  provider_confirmation: "Provider confirmation",
  phone_confirmation: "Phone confirmation",
  email_confirmation: "Email confirmation",
  manual_research: "Manual research",
  source_watch: "Source Watch",
  community_submission: "Community submission",
};

export const CONFIDENCE_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
export const CONTACT_STATUS_LABELS: Record<string, string> = { active: "Active", unverified: "Unverified", outdated: "Outdated" };

export const MEMBER_ROLE_LABELS: Record<string, string> = { owner: "Owner", manager: "Manager", editor: "Editor" };

export const VERIFICATION_METHOD_OPTIONS = [
  { value: "provider_confirmation", label: "Provider confirmation" },
  { value: "official_website", label: "Official website" },
  { value: "government_source", label: "Government source" },
  { value: "phone_confirmation", label: "Phone confirmation" },
  { value: "email_confirmation", label: "Email confirmation" },
  { value: "manual_research", label: "Manual research" },
];

export const ROLE_KEYS = ["community_member", "provider", "verifier", "admin", "super_admin"] as const;

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  community_member: "Can save resources, submit corrections and family experience reports.",
  provider: "Can claim organizations and propose moderated updates.",
  verifier: "Can work the verification queue and review community input.",
  admin: "Can manage records, claims, users (read-only roles), categories and billing.",
  super_admin: "Full access, including role management and platform settings.",
};

export const optionsFrom = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));

/** Pretty-print JSON for audit details. */
export function prettyJson(v: unknown) {
  if (v === null || v === undefined) return "—";
  try {
    return JSON.stringify(typeof v === "string" ? JSON.parse(v) : v, null, 2);
  } catch {
    return String(v);
  }
}
