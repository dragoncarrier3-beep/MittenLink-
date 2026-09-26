import type { Metadata } from "next";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { DetailList, PageHeader, Panel } from "@/components/common/page";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const [profile] = await asCurrentUser((sql) =>
    sql.query<{ full_name: string; job_title: string | null; phone: string | null; email: string; created_at: Date }>(
      "select full_name, job_title, phone, email, created_at from public.profiles where id = auth.uid()",
    ),
  );

  return (
    <>
      <PageHeader title="Profile" description="Update how your name and contact details appear to MittenLink staff." />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel className="max-w-2xl">
          <h2 className="mb-4 text-xl font-bold">Your details</h2>
          <ProfileForm defaults={{ fullName: profile?.full_name ?? user.fullName, jobTitle: profile?.job_title ?? "", phone: profile?.phone ?? "" }} />
        </Panel>
        <Panel as="aside">
          <h2 className="mb-4 text-xl font-bold">Account</h2>
          <DetailList
            className="sm:grid-cols-1"
            items={[
              { label: "Email", value: user.email },
              { label: "Roles", value: user.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || ROLE_LABELS.community_member },
              ...(user.organizations.length ? [{ label: "Organizations you manage", value: user.organizations.map((o) => o.title).join(", ") }] : []),
              { label: "Member since", value: formatDate(profile?.created_at) },
            ]}
          />
          <p className="mt-4 text-sm text-muted-foreground">To change your email address or roles, contact a MittenLink administrator.</p>
        </Panel>
      </div>
    </>
  );
}
