// Canonical public URLs for each record type.
export function listingHref(kind: string, slug: string) {
  switch (kind) {
    case "organization":
      return `/providers/${slug}`;
    case "service":
      return `/services/${slug}`;
    case "program":
      return `/programs/${slug}`;
    case "resource":
      return `/guides/${slug}`;
    case "event":
      return `/events/${slug}`;
    default:
      return "/search";
  }
}
