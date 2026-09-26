import { setActiveOrganizationAction } from "./org-actions";

/** Organization switcher (works without JavaScript). */
export function OrgSwitcher({ organizations, activeId }: { organizations: { id: string; title: string }[]; activeId: string }) {
  if (organizations.length <= 1) {
    return <p className="rounded-lg border bg-card px-3 py-2 font-semibold">{organizations[0]?.title}</p>;
  }
  return (
    <form action={setActiveOrganizationAction} className="flex flex-col gap-2">
      <label htmlFor="active-org" className="text-sm font-semibold">
        Managing
      </label>
      <select id="active-org" name="organizationId" defaultValue={activeId} className="min-h-11 rounded-lg border border-input bg-card px-3">
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-11 rounded-lg border bg-card px-3 font-semibold hover:bg-muted">
        Switch organization
      </button>
    </form>
  );
}
