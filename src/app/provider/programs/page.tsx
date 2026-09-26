import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/states";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { PendingNotice } from "@/components/provider/pending-notice";
import { listChangeRequests, listPrograms, loadProviderContext, openRequestsByTarget, type ProgramRecord } from "@/lib/data/provider";
import { formatDate, formatDay } from "@/lib/format";
import { listingHref } from "@/lib/links";
import { withdrawChangeRequest } from "../change-actions";

export const metadata: Metadata = { title: "Programs" };

function dates(p: ProgramRecord) {
  if (!p.start_date && !p.end_date) return "Ongoing";
  if (p.start_date && p.end_date) return `${formatDay(p.start_date)} – ${formatDay(p.end_date)}`;
  return p.start_date ? `Starts ${formatDay(p.start_date)}` : `Ends ${formatDay(p.end_date)}`;
}

export default async function ProgramsPage() {
  const ctx = await loadProviderContext("/provider/programs");
  const [programs, requests] = await Promise.all([listPrograms(ctx.org.id), listChangeRequests(ctx.org.id, { openOnly: true })]);
  const pendingByTarget = openRequestsByTarget(requests);
  const pendingNew = requests.filter((r) => r.target_type === "program" && r.action === "create");

  return (
    <>
      <PageHeader
        title="Programs"
        description="Time-limited or application-based programs, such as camps, cohorts or grant-funded initiatives. Changes are reviewed before they are published."
        actions={
          <Link href="/provider/programs/new" className={buttonVariants()}>
            <Plus aria-hidden /> Add a program
          </Link>
        }
      />
      {pendingNew.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <h2 className="text-xl font-bold">New programs waiting for review</h2>
          {pendingNew.map((r) => (
            <div key={r.id} className="flex flex-col gap-2">
              <p className="font-semibold">{r.target_title}</p>
              <PendingNotice request={r} currentUserId={ctx.user.id} withdrawAction={withdrawChangeRequest} compact />
              <Link href={`/provider/programs/new?revise=${r.id}`} className="text-sm font-semibold text-primary underline">
                Revise {r.target_title}
              </Link>
            </div>
          ))}
        </div>
      )}
      <DataTable<ProgramRecord>
        caption={`Programs offered by ${ctx.org.title}`}
        rows={programs}
        rowKey={(p) => p.id}
        empty={
          <EmptyState icon={ClipboardList} title="No programs listed yet" description="Add a program so families can learn how to apply." action={{ label: "Add a program", href: "/provider/programs/new" }} />
        }
        columns={[
          {
            key: "title",
            header: "Program",
            primary: true,
            cell: (p) => (
              <div className="flex flex-col gap-1">
                <span>{p.title}</span>
                <span className="text-sm font-normal text-muted-foreground">{p.summary}</span>
              </div>
            ),
          },
          { key: "dates", header: "Dates", cell: dates },
          {
            key: "status",
            header: "Status",
            cell: (p) => {
              const pending = pendingByTarget.get(p.id);
              return (
                <div className="flex flex-col items-start gap-2">
                  <VerificationBadge status={p.verification_status} />
                  {pending && (
                    <StatusPill tone={pending.status === "more_info_required" ? "warning" : "info"}>
                      {pending.status === "more_info_required" ? "More information requested" : "Update pending review"} — submitted{" "}
                      {formatDate(pending.created_at, { month: "short", day: "numeric" })}
                    </StatusPill>
                  )}
                </div>
              );
            },
          },
          {
            key: "actions",
            header: "Actions",
            srOnlyHeader: true,
            cell: (p) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/provider/programs/${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {pendingByTarget.has(p.id) ? "Review pending update" : "Edit"}
                  <span className="sr-only"> for {p.title}</span>
                </Link>
                {p.publication_status === "published" && (
                  <Link href={listingHref("program", p.slug)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    View public page<span className="sr-only"> for {p.title}</span>
                  </Link>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
