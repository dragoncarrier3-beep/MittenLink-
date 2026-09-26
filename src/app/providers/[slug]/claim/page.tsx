import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, Clock } from "lucide-react";
import { asCurrentUser, getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { track } from "@/lib/server/analytics";
import { CLAIM_STATUS_LABELS } from "@/lib/labels";
import { formatDate, hostname } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common/page";
import { VerificationBadge } from "@/components/common/badges";
import { InfoCallout, SignInPrompt } from "@/components/community/notices";
import { StepIndicator, type Step } from "@/components/community/steps";
import { firstParam, type SearchParams } from "@/components/community/server";
import { ClaimForm } from "./claim-form";

type Params = Promise<{ slug: string }>;

interface Org {
  id: string;
  slug: string;
  title: string;
  primary_city: string | null;
  verification_status: string;
  website: string | null;
  claimed: boolean;
}

interface ClaimRow {
  id: string;
  status: string;
  relationship: string;
  claimant_name: string;
  claimant_title: string;
  work_email: string;
  work_phone: string | null;
  verification_details: string;
  evidence_url: string | null;
  message_to_claimant: string | null;
  submitted_at: Date | null;
  updated_at: Date;
}

async function loadOrg(slug: string) {
  const [org] = await asPublic((sql) =>
    sql.query<Org>(
      `select l.id, l.slug, l.title, l.primary_city, l.verification_status, o.website, (o.claimed_at is not null) as claimed
       from public.listings l join public.organizations o on o.id = l.id
       where l.kind = 'organization' and l.slug = $1 and l.publication_status = 'published'`,
      [slug],
    ),
  );
  return org ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const org = await loadOrg(slug);
  return { title: org ? `Claim ${org.title}` : "Claim a Provider" };
}

function flowSteps(current: 1 | 2 | 3): Step[] {
  const labels = ["Sign in or create an account", "Tell us about your role", "MittenLink reviews your claim"];
  return labels.map((label, i) => ({
    label,
    state: i + 1 < current ? "complete" : i + 1 === current ? "current" : "upcoming",
  }));
}

export default async function ClaimProviderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const org = await loadOrg(slug);
  if (!org) notFound();
  const user = await getCurrentUser();
  const providerHref = `/providers/${org.slug}`;
  const next = `/providers/${org.slug}/claim`;
  const breadcrumbs = [{ label: "Home", href: "/" }, { label: "Claim a provider", href: "/claim" }, { label: org.title, href: providerHref }, { label: "Claim" }];

  const orgCard = (
    <Panel>
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">Organization</h2>
      <p className="mt-2 text-xl font-bold">{org.title}</p>
      {org.primary_city && <p className="text-muted-foreground">{org.primary_city}, Michigan</p>}
      <VerificationBadge status={org.verification_status} className="mt-3" />
      {org.claimed && <p className="mt-3 text-sm text-muted-foreground">This listing already has a verified manager. You can still request access; an administrator will confirm your role.</p>}
      <p className="mt-4 flex flex-col gap-1">
        <Link href={providerHref} className="font-semibold text-primary underline">
          View the public listing<span className="sr-only">: {org.title}</span>
        </Link>
        <Link href={`/report?listing=${org.id}`} className="font-semibold text-primary underline">
          Report outdated information
        </Link>
      </p>
    </Panel>
  );

  // ----------------------------------------------------------- signed out
  if (!user) {
    return (
      <div className="container-page py-8">
        <PageHeader title={`Claim ${org.title}`} description="Claiming lets your team keep this listing accurate. It's free." breadcrumbs={breadcrumbs} />
        <StepIndicator label="Claim progress" steps={flowSteps(1)} className="mb-8" />
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="flex max-w-2xl flex-col gap-6">
            <section aria-labelledby="how-heading">
              <h2 id="how-heading" className="text-2xl font-bold">
                How claiming works
              </h2>
              <ol className="mt-3 ml-5 list-decimal space-y-2 text-lg">
                <li>Sign in, or create a free account using your work email.</li>
                <li>Tell us your role and how we can confirm that you work with {org.title}.</li>
                <li>A MittenLink administrator reviews your claim, usually within a few business days, and emails you the decision.</li>
                <li>Once approved, you can suggest updates from your Provider Dashboard. MittenLink reviews changes before they&apos;re published.</li>
              </ol>
            </section>
            <SignInPrompt next={next}>
              You need an account so we can follow up with you about your claim and give you access once it&apos;s approved.
            </SignInPrompt>
          </div>
          <aside className="order-first lg:order-none">{orgCard}</aside>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- signed in
  const manages = user.organizations.some((o) => o.id === org.id);
  const claims = manages
    ? []
    : await asCurrentUser((sql) =>
        sql.query<ClaimRow>(
          `select id, status, relationship, claimant_name, claimant_title, work_email, work_phone, verification_details, evidence_url,
                  message_to_claimant, submitted_at, updated_at
           from public.provider_claims where organization_id = $1 and claimant_user_id = $2
           order by created_at desc limit 5`,
          [org.id, user.id],
        ),
      );
  const active = claims.find((c) => ["draft", "submitted", "under_review", "more_info_required"].includes(c.status));
  const lastRejected = !active ? claims.find((c) => c.status === "rejected") : undefined;

  if (manages) {
    return (
      <div className="container-page py-8">
        <PageHeader title={`Claim ${org.title}`} breadcrumbs={breadcrumbs} />
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <Panel className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <BadgeCheck className="size-6 text-success" aria-hidden /> You already manage this organization
            </h2>
            <p className="mt-2">You can update {org.title}&apos;s listing from your Provider Dashboard. Changes are reviewed before they&apos;re published.</p>
            <Link href="/provider" className={`${buttonVariants()} mt-4`}>
              Go to Provider Dashboard
            </Link>
          </Panel>
          <aside className="order-first lg:order-none">{orgCard}</aside>
        </div>
      </div>
    );
  }

  if (active && (active.status === "submitted" || active.status === "under_review")) {
    return (
      <div className="container-page py-8">
        <PageHeader title={`Claim ${org.title}`} breadcrumbs={breadcrumbs} />
        <StepIndicator label="Claim progress" steps={flowSteps(3)} className="mb-8" />
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <Panel className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Clock className="size-6 text-info" aria-hidden /> Your claim is {CLAIM_STATUS_LABELS[active.status].toLowerCase()}
            </h2>
            <p className="mt-2">
              You submitted a claim for {org.title}
              {active.submitted_at ? ` on ${formatDate(active.submitted_at)}` : ""}. An administrator is reviewing it, and we&apos;ll notify you as soon as
              there&apos;s a decision.
            </p>
            <Link href="/account/claims" className={`${buttonVariants({ variant: "outline" })} mt-4`}>
              View My Claims
            </Link>
          </Panel>
          <aside className="order-first lg:order-none">{orgCard}</aside>
        </div>
      </div>
    );
  }

  const resubmitting = active?.status === "more_info_required";
  if (!active) await track("claim_started", { listingId: org.id });
  const saved = firstParam(sp.saved) === "1" && active?.status === "draft";

  return (
    <div className="container-page py-8">
      <PageHeader
        title={`Claim ${org.title}`}
        description="Tell us about your role. We use this only to confirm that you can represent the organization."
        breadcrumbs={breadcrumbs}
      />
      <StepIndicator label="Claim progress" steps={flowSteps(2)} className="mb-8" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex max-w-2xl flex-col gap-6">
          {saved && (
            <div role="status" className="rounded-lg border border-success/40 bg-success-soft p-4 font-semibold text-success">
              Your draft was saved. You can come back to finish it any time from My Claims.
            </div>
          )}
          {resubmitting && (
            <div role="alert" className="rounded-xl border-2 border-warning/50 bg-warning-soft p-5 text-foreground">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <AlertTriangle className="size-5 text-warning" aria-hidden /> MittenLink needs more information
              </h2>
              {active?.message_to_claimant && (
                <blockquote className="mt-3 border-l-4 border-warning pl-4 text-lg">{active.message_to_claimant}</blockquote>
              )}
              <p className="mt-3">Update your claim below and resubmit it. Your earlier answers are filled in for you.</p>
            </div>
          )}
          {!resubmitting && active?.status === "draft" && !saved && (
            <InfoCallout title="Continue your draft">
              You started this claim on {formatDate(active.updated_at)}. Your saved answers are filled in below.
            </InfoCallout>
          )}
          {lastRejected && (
            <InfoCallout title="Your previous claim was not approved">
              {lastRejected.message_to_claimant ?? "You can submit a new claim with more information about your role."}
            </InfoCallout>
          )}
          <ClaimForm
            organizationId={org.id}
            slug={org.slug}
            organizationName={org.title}
            websiteDomain={hostname(org.website)}
            resubmitting={resubmitting}
            defaults={
              active
                ? {
                    relationship: active.relationship,
                    claimantName: active.claimant_name,
                    claimantTitle: active.claimant_title,
                    workEmail: active.work_email,
                    workPhone: active.work_phone ?? "",
                    verificationDetails: active.verification_details,
                    evidenceUrl: active.evidence_url ?? "",
                  }
                : { claimantName: user.fullName, claimantTitle: user.jobTitle ?? "", workEmail: user.email }
            }
          />
        </div>
        <aside className="order-first lg:order-none">{orgCard}</aside>
      </div>
    </div>
  );
}
