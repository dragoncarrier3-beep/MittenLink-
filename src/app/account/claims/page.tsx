import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { asService } from "@/lib/db";
import { CLAIM_RELATIONSHIP_LABELS, CLAIM_STATUS_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { StatusPill, type Tone } from "@/components/common/badges";
import { StepIndicator, claimSteps } from "@/components/community/steps";
import { firstParam, type SearchParams } from "@/components/community/server";

export const metadata: Metadata = { title: "My Claims" };

const TONE: Record<string, Tone> = { draft: "neutral", submitted: "info", under_review: "info", more_info_required: "warning", approved: "success", rejected: "danger" };

interface ClaimRow {
  id: string;
  status: string;
  relationship: string;
  claimant_title: string;
  message_to_claimant: string | null;
  created_at: Date;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  updated_at: Date;
  org_id: string;
  org_title: string | null;
  org_slug: string | null;
  org_publication: string | null;
}

export default async function MyClaimsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/account/claims");
  const params = await searchParams;
  // Claims are read with RLS (own rows only).
  const claimRows = await asCurrentUser((sql) =>
    sql.query<Omit<ClaimRow, "org_title" | "org_slug" | "org_publication">>(
      `select c.id, c.status, c.relationship, c.claimant_title, c.message_to_claimant, c.created_at, c.submitted_at, c.reviewed_at, c.updated_at,
              c.organization_id as org_id
       from public.provider_claims c
       where c.claimant_user_id = auth.uid()
       order by case c.status when 'more_info_required' then 0 when 'draft' then 1 when 'submitted' then 2 when 'under_review' then 2 else 3 end, c.updated_at desc`,
    ),
  );
  // Organization names for the user's own claims. A listing the user submitted stays
  // pending (and hidden by RLS) until it is verified, so names are resolved server-side,
  // limited strictly to organizations referenced by this user's claims.
  const orgIds = [...new Set(claimRows.map((c) => c.org_id))];
  const orgs = orgIds.length
    ? await asService((sql) =>
        sql.query<{ id: string; title: string; slug: string; publication_status: string }>(
          `select l.id, l.title, l.slug, l.publication_status from public.listings l
           where l.id = any($1::uuid[]) and exists (select 1 from public.provider_claims c where c.organization_id = l.id and c.claimant_user_id = $2)`,
          [orgIds, user.id],
        ),
      )
    : [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const claims: ClaimRow[] = claimRows.map((c) => {
    const o = orgById.get(c.org_id);
    return { ...c, org_title: o?.title ?? null, org_slug: o?.slug ?? null, org_publication: o?.publication_status ?? null };
  });
  const managed = new Set(user.organizations.map((o) => o.id));

  return (
    <>
      <PageHeader
        title="My claims"
        description="Track requests to manage an organization's listing."
        actions={
          <Link href="/claim" className={buttonVariants({ variant: "outline" })}>
            Claim another provider
          </Link>
        }
      />
      {firstParam(params.submitted) === "1" && (
        <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft p-4 text-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-bold text-success">Your claim was submitted.</p>
            <p>An administrator will review it, usually within a few business days. We&apos;ll send you a notification when there&apos;s a decision.</p>
          </div>
        </div>
      )}
      {claims.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You haven't claimed any providers"
          description="If you work for an organization listed on MittenLink, you can claim its listing to help keep it up to date."
          action={{ label: "Claim a Provider", href: "/claim" }}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {claims.map((c) => {
            const title = c.org_title ?? "Organization";
            const pendingListing = c.org_publication === "pending";
            const claimHref = c.org_slug && !pendingListing ? `/providers/${c.org_slug}/claim` : null;
            return (
              <li key={c.id}>
                <article aria-labelledby={`claim-${c.id}`} className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id={`claim-${c.id}`} className="text-xl font-bold">
                        {c.org_slug && c.org_publication === "published" ? (
                          <Link href={`/providers/${c.org_slug}`} className="underline-offset-4 hover:underline">
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </h2>
                      <p className="text-muted-foreground">
                        {CLAIM_RELATIONSHIP_LABELS[c.relationship] ?? c.relationship}
                        {c.claimant_title ? ` · ${c.claimant_title}` : ""}
                      </p>
                      {pendingListing && <p className="mt-1 text-sm text-muted-foreground">This is a new listing you submitted. It will be published after review.</p>}
                    </div>
                    <StatusPill tone={TONE[c.status] ?? "neutral"}>{CLAIM_STATUS_LABELS[c.status] ?? c.status}</StatusPill>
                  </div>

                  <StepIndicator label={`Claim status for ${title}`} steps={claimSteps(c.status)} className="mt-4" />

                  {c.message_to_claimant && (c.status === "more_info_required" || c.status === "rejected" || c.status === "approved") && (
                    <div className={`mt-4 rounded-lg border p-4 ${c.status === "more_info_required" ? "border-warning/50 bg-warning-soft" : "border-info/30 bg-info-soft"}`}>
                      <p className="text-sm font-bold">Message from MittenLink</p>
                      <p className="mt-1">{c.message_to_claimant}</p>
                    </div>
                  )}

                  <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Started</dt>
                      <dd>{formatDate(c.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Submitted</dt>
                      <dd>{c.submitted_at ? formatDate(c.submitted_at) : "Not yet submitted"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Last reviewed</dt>
                      <dd>{c.reviewed_at ? formatDate(c.reviewed_at) : "Not yet reviewed"}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.status === "draft" && claimHref && (
                      <Link href={claimHref} className={buttonVariants()}>
                        Continue draft<span className="sr-only"> for {title}</span>
                      </Link>
                    )}
                    {c.status === "more_info_required" && claimHref && (
                      <Link href={claimHref} className={buttonVariants()}>
                        Respond to request<span className="sr-only"> for {title}</span>
                      </Link>
                    )}
                    {c.status === "approved" && managed.has(c.org_id) && (
                      <Link href="/provider" className={buttonVariants()}>
                        Go to Provider Dashboard
                      </Link>
                    )}
                    {c.status === "rejected" && claimHref && (
                      <Link href={claimHref} className={buttonVariants({ variant: "outline" })}>
                        Submit a new claim<span className="sr-only"> for {title}</span>
                      </Link>
                    )}
                    {(c.status === "submitted" || c.status === "under_review") && (
                      <p className="text-sm text-muted-foreground">No action needed. We&apos;ll notify you when the review is complete.</p>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
