import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page";
import { firstParam, type SearchParams } from "@/components/community/server";

export const metadata: Metadata = { title: "Organization Submitted" };

export default async function SubmittedPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/list-your-organization");
  const params = await searchParams;
  const emailFailed = firstParam(params.email) === "failed";
  return (
    <div className="container-page py-8">
      <PageHeader title="Thank you — your organization was submitted" breadcrumbs={[{ label: "Home", href: "/" }, { label: "List your organization", href: "/list-your-organization" }, { label: "Submitted" }]} />
      <div className="max-w-2xl rounded-xl border border-success/40 bg-success-soft p-6" role="status">
        <p className="flex items-start gap-2 text-lg font-semibold">
          <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden />
          Your listing is saved and waiting for review. It is not public yet.
        </p>
        {emailFailed && <p className="mt-2 text-sm font-semibold text-warning">Your submission was saved, but the confirmation email could not be sent.</p>}
        <h2 className="mt-5 text-xl font-bold">What happens next</h2>
        <ol className="mt-2 ml-5 list-decimal space-y-2">
          <li>A MittenLink verifier reviews the details you shared, usually within five business days.</li>
          <li>We may contact you or check your website to confirm the information.</li>
          <li>When approved, your listing is published and you&apos;ll get a notification.</li>
          <li>If you asked to manage the listing, you can follow that request in My Claims.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/claims" className={buttonVariants()}>
            View My Claims
          </Link>
          <Link href="/account" className={buttonVariants({ variant: "outline" })}>
            Go to My Account
          </Link>
        </div>
      </div>
    </div>
  );
}
