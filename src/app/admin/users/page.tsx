import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { isSuperAdmin, requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { StatusPill } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { FilterBar, ResultSummary } from "@/components/admin/filter-bar";
import { DemoFlag } from "@/components/admin/record-parts";
import { hrefWith, optionsFrom, sp, type SearchParams } from "@/components/admin/admin-labels";
import { listUsers, PAGE_SIZE } from "@/lib/data/admin-records";
import { formatShortDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAdmin("/admin/users");
  const params = await searchParams;
  const current = { q: sp(params.q), role: sp(params.role), status: sp(params.status) };
  const page = parsePage(params.page);
  const { rows, total } = await listUsers({ ...current, page });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
        title="Users"
        description="Everyone with a MittenLink account, their roles and the organizations they manage."
      />
      {!isSuperAdmin(user) && (
        <p className="mb-5 rounded-lg border border-info/30 bg-info-soft p-4 text-foreground">Only Super Administrators can change roles. You can view accounts and deactivate non-administrator accounts.</p>
      )}
      <FilterBar
        action="/admin/users"
        q={current.q}
        searchLabel="Search by name or email"
        filters={[
          { name: "role", label: "Role", options: optionsFrom(ROLE_LABELS), value: current.role, allLabel: "All roles" },
          { name: "status", label: "Account status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Deactivated" }], value: current.status },
        ]}
      />
      <ResultSummary total={total} page={page} pageSize={PAGE_SIZE} noun="users" />
      <DataTable
        caption="Users"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={Users} title="No users found" description="Try a different search or clear the filters." />}
        columns={[
          {
            key: "name",
            header: "Name",
            primary: true,
            cell: (r) => (
              <span className="flex flex-col gap-1">
                <Link href={`/admin/users/${r.id}`} className="text-primary underline">
                  {r.full_name}
                </Link>
                <DemoFlag show={r.is_demo} />
              </span>
            ),
          },
          { key: "email", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> },
          { key: "roles", header: "Roles", cell: (r) => (r.roles.length ? r.roles.map((k) => ROLE_LABELS[k] ?? k).join(", ") : <span className="text-muted-foreground">No roles</span>) },
          { key: "status", header: "Status", cell: (r) => <StatusPill tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Deactivated"}</StatusPill> },
          { key: "orgs", header: "Manages", cell: (r) => (r.organizations.length ? r.organizations.join(", ") : <span className="text-muted-foreground">—</span>) },
          { key: "created", header: "Created", cell: (r) => formatShortDate(r.created_at) },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => hrefWith("/admin/users", current, { page: p })} label="User pages" />
    </>
  );
}
