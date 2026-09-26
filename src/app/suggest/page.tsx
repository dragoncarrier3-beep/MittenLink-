import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, SearchCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { asPublic } from "@/lib/db";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { firstParam, loadCategoryOptions, loadCountyOptions, type SearchParams } from "@/components/community/server";
import { SuggestForm } from "./suggest-form";

export const metadata: Metadata = {
  title: "Suggest a Resource",
  description: "Tell MittenLink about a resource we're missing, or what you were looking for and couldn't find.",
};

export default async function SuggestPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const mode = firstParam(params.type) === "need" ? "need" : "resource";
  const q = firstParam(params.q).slice(0, 500);
  const location = firstParam(params.location).slice(0, 120);
  const [counties, categories, user] = await Promise.all([loadCountyOptions(), loadCategoryOptions(), getCurrentUser()]);

  // Prefill the county when the location matches a known Michigan city or ZIP.
  let countyId = "";
  if (location) {
    const [place] = await asPublic((sql) =>
      sql.query<{ county_id: number }>(
        "select county_id from public.places where zip = $1 or lower(name) = lower($1) order by (kind = 'zip') desc, population desc nulls last limit 1",
        [location.replace(/,?\s*(mi|michigan)$/i, "").trim()],
      ),
    );
    if (place) countyId = String(place.county_id);
  }

  const keep = new URLSearchParams();
  if (q) keep.set("q", q);
  if (location) keep.set("location", location);
  const tabHref = (type: string) => {
    const p = new URLSearchParams(keep);
    p.set("type", type);
    return `/suggest?${p.toString()}`;
  };
  const tabs = [
    { type: "resource", label: "Suggest a resource", icon: Lightbulb },
    { type: "need", label: "Tell us what you were looking for", icon: SearchCheck },
  ];

  return (
    <div className="container-page py-8">
      <PageHeader
        title={mode === "resource" ? "Suggest a resource" : "Tell MittenLink what you were looking for"}
        description={
          mode === "resource"
            ? "Know a program, service, or organization that should be on MittenLink? Tell us about it and our team will review it."
            : "Couldn't find what you needed? Your request helps MittenLink find and add resources where they're missing."
        }
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Suggest a resource" }]}
      />
      <div className="max-w-2xl">
        <nav aria-label="Type of suggestion" className="mb-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {tabs.map((t) => {
              const active = t.type === mode;
              return (
                <li key={t.type}>
                  <Link
                    href={tabHref(t.type)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-2 rounded-lg border-2 px-4 py-2 font-semibold",
                      active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <t.icon className="size-5 shrink-0" aria-hidden />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <SuggestForm
          key={mode}
          mode={mode}
          counties={counties}
          categories={categories}
          defaults={{ q, location, countyId, email: user?.email ?? "" }}
          signedIn={!!user}
        />
      </div>
    </div>
  );
}
