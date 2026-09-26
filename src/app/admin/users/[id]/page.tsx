import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, isSuperAdmin, requireAdmin } from "@/lib/auth";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { StatusPill } from "@/components/common/badges";
import { AdminActionForm } from "@/components/admin/action-form";
import { DemoFlag } from "@/components/admin/record-parts";
import { MEMBER_ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_KEYS } from "@/components/admin/admin-labels";
import { getUserAdmin } from "@/lib/data/admin-records";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { CLAIM_STATUS_LABELS, label, ROLE_LABELS } from "@/lib/labels";
import { setUserActiveAction, updateRolesAction } from "../actions";

export const metadata: Metadata = { title: "User details" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireAdmin(`/admin/users/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const superAdmin = isSuperAdmin(viewer);
  const data = await getUserAdmin(id, superAdmin);
  if (!data) notFound();
  const { profile, roles, organizations, claims, activity, superAdminCount } = data;
  const roleKeys = roles.map((r) => r.role_key);
  const isSelf = viewer.id === profile.id;
  const targetIsAdmin = roleKeys.includes("admin") || roleKeys.includes("super_admin");
  const isLastSuperAdmin = roleKeys.includes("super_admin") && profile.is_active && superAdminCount <= 1;
  const canToggleActive = !isSelf && (!targetIsAdmin || hasRole(viewer, "super_admin")) && !(profile.is_active && isLastSuperAdmin);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users", href: "/admin/users" }, { label: profile.full_name }]}
        eyebrow="User"
        title={profile.full_name}
        description={profile.email}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusPill tone={profile.is_active ? "success" : "neutral"}>{profile.is_active ? "Active" : "Deactivated"}</StatusPill>
        <DemoFlag show={profile.is_demo} />
        {isSelf && <StatusPill tone="info">This is you</StatusPill>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section title="Details">
            <Panel>
              <DetailList
                items={[
                  { label: "Name", value: profile.full_name },
                  { label: "Email", value: <span className="break-all">{profile.email}</span> },
                  { label: "Job title", value: profile.job_title },
                  { label: "Phone", value: profile.phone },
                  { label: "Roles", value: roleKeys.length ? roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") : "No roles" },
                  { label: "Account created", value: formatDateTime(profile.created_at) },
                  { label: "Last updated", value: formatDateTime(profile.updated_at) },
                ]}
              />
            </Panel>
          </Section>

          <Section title="Managed organizations">
            <DataTable
              caption={`Organizations managed by ${profile.full_name}`}
              rows={organizations}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">This person does not manage any organizations.</p>}
              columns={[
                { key: "org", header: "Organization", primary: true, cell: (r) => <Link href={`/admin/organizations/${r.id}#managers`} className="text-primary underline">{r.title}</Link> },
                { key: "role", header: "Role", cell: (r) => label(MEMBER_ROLE_LABELS, r.member_role) },
                { key: "status", header: "Access", cell: (r) => (r.status === "active" ? "Active" : "Revoked") },
                { key: "since", header: "Since", cell: (r) => formatShortDate(r.created_at) },
              ]}
            />
          </Section>

          <Section title="Claims">
            <DataTable
              caption={`Claims submitted by ${profile.full_name}`}
              rows={claims}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No claims.</p>}
              columns={[
                { key: "org", header: "Organization", primary: true, cell: (r) => <Link href={`/admin/organizations/${r.org_id}#claims`} className="text-primary underline">{r.org_title}</Link> },
                { key: "status", header: "Status", cell: (r) => label(CLAIM_STATUS_LABELS, r.status) },
                { key: "submitted", header: "Submitted", cell: (r) => (r.submitted_at ? formatShortDate(r.submitted_at) : "Not submitted") },
              ]}
            />
          </Section>

          <Section title="Recent activity" description="The latest audit log entries recorded for actions this person took.">
            <DataTable
              caption={`Recent audit entries by ${profile.full_name}`}
              rows={activity}
              rowKey={(r) => r.id}
              empty={<p className="rounded-xl border bg-card p-4 text-muted-foreground">No recorded activity.</p>}
              columns={[
                { key: "when", header: "When", primary: true, cell: (r) => formatDateTime(r.created_at) },
                { key: "action", header: "Action", cell: (r) => <code className="text-sm">{r.action}</code> },
                { key: "entity", header: "Record", cell: (r) => `${r.entity_label ?? "—"} (${r.entity_type})` },
              ]}
            />
            {activity.length > 0 && profile.full_name && (
              <Link href={`/admin/audit?actor=${encodeURIComponent(profile.full_name)}`} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline">
                View all activity in the audit log
              </Link>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Roles</h2>
            {!superAdmin ? (
              <>
                <p className="mb-3 rounded-lg border border-info/30 bg-info-soft p-3">Only Super Administrators can change roles.</p>
                <ul className="flex flex-col gap-2">
                  {ROLE_KEYS.map((k) => (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span>{ROLE_LABELS[k]}</span>
                      <span className="font-semibold">{roleKeys.includes(k) ? "Granted" : "—"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : isSelf ? (
              <p className="rounded-lg border border-info/30 bg-info-soft p-3">You can&apos;t change your own roles. Ask another Super Administrator if your access needs to change.</p>
            ) : (
              <AdminActionForm
                action={updateRolesAction}
                hidden={{ userId: profile.id }}
                label="Save Roles"
                variant="default"
                pendingLabel="Saving roles…"
                confirm={{
                  title: `Change roles for ${profile.full_name}?`,
                  description: "Their access changes immediately and they will be notified. This is recorded in the audit log.",
                  confirmLabel: "Change roles",
                }}
              >
                <fieldset>
                  <legend className="mb-2 font-semibold">Assigned roles</legend>
                  <div className="flex flex-col gap-2">
                    {ROLE_KEYS.map((k) => (
                      <label key={k} className="flex min-h-11 items-start gap-3 rounded-lg border bg-card px-3 py-2">
                        <input type="checkbox" name="roles[]" value={k} defaultChecked={roleKeys.includes(k)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
                        <span>
                          <span className="font-semibold">{ROLE_LABELS[k]}</span>
                          <span className="block text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[k]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {isLastSuperAdmin && <p className="mt-2 text-sm text-muted-foreground">This is the only active Super Administrator, so that role can&apos;t be removed.</p>}
                </fieldset>
              </AdminActionForm>
            )}
          </Panel>

          <Panel as="section">
            <h2 className="mb-3 text-xl font-bold">Account access</h2>
            {isSelf ? (
              <p className="text-muted-foreground">You can&apos;t deactivate your own account.</p>
            ) : !canToggleActive ? (
              <p className="text-muted-foreground">
                {isLastSuperAdmin ? "The last active Super Administrator can't be deactivated." : "Only Super Administrators can deactivate or reactivate administrator accounts."}
              </p>
            ) : profile.is_active ? (
              <>
                <p className="mb-3 text-muted-foreground">Deactivating signs this person out and blocks sign-in. Their records and history are kept.</p>
                <AdminActionForm
                  action={setUserActiveAction}
                  hidden={{ userId: profile.id, active: "false" }}
                  label="Deactivate account"
                  variant="destructive"
                  pendingLabel="Deactivating…"
                  confirm={{
                    title: `Deactivate ${profile.full_name}?`,
                    description: "They will be signed out and unable to sign in until an administrator reactivates the account.",
                    confirmLabel: "Deactivate",
                    destructive: true,
                  }}
                />
              </>
            ) : (
              <>
                <p className="mb-3 text-muted-foreground">This account is deactivated and cannot sign in.</p>
                <AdminActionForm
                  action={setUserActiveAction}
                  hidden={{ userId: profile.id, active: "true" }}
                  label="Reactivate account"
                  variant="default"
                  pendingLabel="Reactivating…"
                  confirm={{ title: `Reactivate ${profile.full_name}?`, description: "They will be able to sign in again with their existing roles.", confirmLabel: "Reactivate" }}
                />
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
