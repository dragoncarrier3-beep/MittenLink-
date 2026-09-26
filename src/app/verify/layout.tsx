import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { asService } from "@/lib/db";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export const metadata: Metadata = { title: { default: "Verification", template: "%s | MittenLink Verification" } };

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("/verify");
  const [counts] = await asService((sql) =>
    sql.query<{ mine: number; team: number }>(
      `select
         (select count(*)::int from verification_tasks where assigned_to = $1 and status in ('open', 'in_progress')) as mine,
         (select count(*)::int from verification_tasks where status in ('open', 'in_progress') and assigned_to is null) as team`,
      [user.id],
    ),
  ).catch(() => [{ mine: 0, team: 0 }]);
  return (
    <WorkspaceShell
      label="Verification"
      title="Resource Verifier"
      nav={[
        { href: "/verify", label: "My Verification Queue", count: counts?.mine, exact: true },
        { href: "/verify/team", label: "Unassigned Tasks", count: counts?.team },
        { href: "/verify/completed", label: "Recently Completed" },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
