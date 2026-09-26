/** Admin edit page for any listing kind (organization → /admin/organizations/{id}, etc.). */
export function adminListingHref(kind: string, id: string) {
  const plural: Record<string, string> = { organization: "organizations", service: "services", program: "programs", resource: "resources", event: "events" };
  return plural[kind] ? `/admin/${plural[kind]}/${id}` : "/admin";
}
