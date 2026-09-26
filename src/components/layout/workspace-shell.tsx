import { WorkspaceNav, type WorkspaceNavItem } from "./workspace-nav";

/**
 * Two-column shell for signed-in workspaces (Provider, Verifier, Admin).
 * Sidebar navigation on large screens; a collapsible section menu on phones.
 */
export function WorkspaceShell({
  label,
  title,
  nav,
  children,
  context,
}: {
  label: string; // accessible name for the navigation landmark, e.g. "Admin"
  title: string; // shown above the nav
  nav: WorkspaceNavItem[];
  children: React.ReactNode;
  context?: React.ReactNode; // e.g. organization switcher
}) {
  return (
    <div className="container-page py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <p className="mb-2 text-sm font-bold tracking-wide text-primary uppercase">{title}</p>
          {context && <div className="mb-3">{context}</div>}
          <WorkspaceNav label={label} items={nav} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export type { WorkspaceNavItem };
