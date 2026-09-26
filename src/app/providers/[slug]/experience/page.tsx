import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { PageHeader } from "@/components/common/page";
import { InfoCallout } from "@/components/community/notices";
import { ExperienceForm } from "./experience-form";

type Params = Promise<{ slug: string }>;

async function loadProvider(slug: string) {
  return asPublic(async (sql) => {
    const [org] = await sql.query<{ id: string; title: string; slug: string }>(
      `select l.id, l.title, l.slug from public.listings l join public.organizations o on o.id = l.id
       where l.kind = 'organization' and l.slug = $1 and l.publication_status = 'published'`,
      [slug],
    );
    if (!org) return null;
    const services = await sql.query<{ id: string; title: string }>(
      `select l.id, l.title from public.services s join public.listings l on l.id = s.id
       where s.organization_id = $1 and l.publication_status = 'published' order by l.title`,
      [org.id],
    );
    return { org, services };
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadProvider(slug);
  return { title: data ? `Share Your Experience with ${data.org.title}` : "Share Your Experience" };
}

export default async function ExperiencePage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await loadProvider(slug);
  if (!data) notFound();
  const { org, services } = data;
  const user = await getCurrentUser();
  const providerHref = `/providers/${org.slug}`;

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Share your family's experience"
        description={
          <>
            Tell other families what it was like to work with <strong className="text-foreground">{org.title}</strong>. It takes about five
            minutes, and you don&apos;t need an account.
          </>
        }
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Providers", href: "/providers" }, { label: org.title, href: providerHref }, { label: "Share your experience" }]}
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-2xl">
          <ExperienceForm
            organizationId={org.id}
            organizationName={org.title}
            providerHref={providerHref}
            services={services.map((s) => ({ value: s.id, label: s.title }))}
            signedIn={!!user}
            currentYear={new Date().getFullYear()}
          />
        </div>
        <aside className="order-first flex flex-col gap-4 lg:order-none">
          <InfoCallout title="How family reports work">
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>This is not an open review site. Every report is read by a MittenLink moderator before anything is shared.</li>
              <li>Published reports are always anonymous and never include contact details.</li>
              <li>Reports describe one family&apos;s experience. They are not a professional rating or endorsement.</li>
            </ul>
          </InfoCallout>
          <p className="text-sm text-muted-foreground">
            Is something on this listing out of date?{" "}
            <Link href={`/report?listing=${org.id}`} className="font-semibold text-primary underline">
              Report outdated information
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
