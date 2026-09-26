import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/common/page";
import { InfoCallout, SignInPrompt } from "@/components/community/notices";
import { loadCategoryOptions, loadLanguageOptions, loadPopulationOptions } from "@/components/community/server";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = {
  title: "List Your Organization",
  description: "Submit your organization to MittenLink, Michigan's disability resource network. Listing is free and reviewed by our team.",
};

const NEXT_STEPS = [
  "Submit your organization's details. It takes about ten minutes.",
  "A MittenLink verifier checks the information with your website or by phone.",
  "Once approved, your listing is published with a verification badge and review date.",
  "If you asked to manage the listing, an administrator confirms your role and gives you Provider Dashboard access.",
];

export default async function ListYourOrganizationPage() {
  const user = await getCurrentUser();
  const header = (
    <PageHeader
      title="List your organization"
      description="MittenLink helps people with disabilities, families, and professionals across Michigan find services. Listing your organization is free."
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "List your organization" }]}
    />
  );
  const aside = (
    <aside className="order-first flex flex-col gap-4 lg:order-none">
      <Panel>
        <h2 className="text-lg font-bold">What happens next</h2>
        <ol className="mt-3 ml-5 list-decimal space-y-2">
          {NEXT_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Panel>
      <InfoCallout title="Already on MittenLink?">
        <p>
          Search for your organization and{" "}
          <Link href="/claim" className="font-semibold text-primary underline">
            claim the existing listing
          </Link>{" "}
          instead of creating a new one.
        </p>
      </InfoCallout>
    </aside>
  );

  if (!user) {
    return (
      <div className="container-page py-8">
        {header}
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="flex max-w-2xl flex-col gap-6">
            <section aria-labelledby="who-heading">
              <h2 id="who-heading" className="text-2xl font-bold">
                Who can list an organization?
              </h2>
              <p className="mt-2 text-lg">
                Nonprofits, government agencies, health care and therapy providers, schools, advocacy groups, and community groups that serve people with
                disabilities in Michigan. Someone who works for or represents the organization should submit it.
              </p>
            </section>
            <SignInPrompt next="/list-your-organization">
              We ask you to sign in so we can follow up about your submission and, if you choose, give you access to manage the listing once it&apos;s
              approved. Creating an account is free.
            </SignInPrompt>
          </div>
          {aside}
        </div>
      </div>
    );
  }

  const [categories, populations, languages] = await Promise.all([loadCategoryOptions(), loadPopulationOptions(), loadLanguageOptions()]);
  return (
    <div className="container-page py-8">
      {header}
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="max-w-2xl">
          <OrganizationForm
            categories={categories}
            populations={populations}
            languages={languages}
            user={{ name: user.fullName, title: user.jobTitle ?? "", email: user.email }}
          />
        </div>
        {aside}
      </div>
    </div>
  );
}
