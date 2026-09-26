import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, Info, ShieldCheck, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCandidate, getLookups } from "@/lib/data/operations";
import { isModelEngine, suggestionLabel, type DuplicateMatch } from "@/lib/integrations/discovery/types";
import { KIND_LABELS, SOURCE_TYPE_LABELS, label } from "@/lib/labels";
import { formatDate, formatDateTime, hostname } from "@/lib/format";
import { DetailList, PageHeader, Panel, Section } from "@/components/common/page";
import { StatusPill, VerificationBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { InternalNotes } from "@/components/staff/internal-notes";
import { ActionButton } from "@/components/operations/action-button";
import { CandidateStatusPill, DuplicateConfidence } from "@/components/operations/status";
import { ImportForm, ReviewFieldsForm } from "@/components/operations/source-watch-forms";
import { adminListingHref } from "@/components/operations/hrefs";
import { acceptSuggestionAction, generateSuggestionsAction, setCandidateStatusAction } from "../../actions";

export const metadata: Metadata = { title: "Review Candidate" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CandidatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  await requireAdmin(`/admin/source-watch/candidates/${id}`);
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const [data, lookups] = await Promise.all([getCandidate(id), getLookups()]);
  if (!data) notFound();
  const { candidate: c, duplicates } = data;
  const categories = lookups.categories.map((x) => ({ value: String(x.id), label: x.name }));
  const counties = lookups.counties.map((x) => ({ value: String(x.id), label: `${x.name} County` }));
  const s = c.suggestions ?? {};
  const hasSuggestions = !!(s.summary || s.category || s.populations?.length || s.organization);
  const suggestedCategory = s.category?.slug ? lookups.categories.find((x) => x.slug === s.category!.slug) : undefined;
  const popNames = (s.populations ?? []).map((p) => lookups.populations.find((x) => x.slug === p)?.name ?? p);
  const org = s.organization ?? null;
  const imported = c.status === "imported";
  const locked = imported;
  const pathname = `/admin/source-watch/candidates/${c.id}`;

  const statusActions: { status: string; label: string; show: boolean; variant?: "default" | "outline" | "destructive" }[] = [
    { status: "reviewing", label: c.status === "rejected" ? "Reopen Review" : "Start Review", show: c.status === "new" || c.status === "rejected" || c.status === "possible_duplicate" || c.status === "approved_for_import" },
    { status: "possible_duplicate", label: "Mark Possible Duplicate", show: c.status !== "possible_duplicate" && c.status !== "rejected" },
    { status: "approved_for_import", label: "Approve for Import", show: c.status !== "approved_for_import" && c.status !== "rejected", variant: "default" },
    { status: "rejected", label: "Reject", show: c.status !== "rejected", variant: "destructive" },
  ];

  return (
    <>
      <PageHeader
        title={c.name}
        eyebrow="Source Watch candidate"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Source Watch", href: "/admin/source-watch" }, { label: c.name }]}
        actions={<CandidateStatusPill status={c.status} />}
      />

      {sp.added === "1" && (
        <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft p-4 font-semibold text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> Candidate added. It was checked against existing listings for possible duplicates and is ready for review.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel as="section">
            <h2 className="mb-4 text-xl font-bold">Candidate details</h2>
            <DetailList
              items={[
                {
                  label: "Web address",
                  value: c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline">
                      {c.url} <ExternalLink className="size-3.5" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null,
                },
                { label: "Source", value: c.source_name ? `${c.source_name}${c.source_type ? ` (${label(SOURCE_TYPE_LABELS, c.source_type)})` : ""}` : "Added by staff" },
                { label: "Discovered", value: formatDate(c.discovered_at) },
                { label: "Possible category", value: c.category_name },
                { label: "Possible location", value: [c.possible_city, c.county_name ? `${c.county_name} County` : null].filter(Boolean).join(", ") || null },
                { label: "Duplicate confidence", value: <DuplicateConfidence value={c.duplicate_confidence} /> },
                { label: "Last reviewed", value: c.reviewed_at ? `${formatDateTime(c.reviewed_at)}${c.reviewed_by_name ? ` by ${c.reviewed_by_name}` : ""}` : "Not yet reviewed" },
                ...(imported && c.imported_listing_id
                  ? [
                      {
                        label: "Imported record",
                        value: (
                          <Link href={adminListingHref(c.imported_kind ?? "organization", c.imported_listing_id)} className="text-primary underline">
                            {c.imported_title} ({label(KIND_LABELS, c.imported_kind)})
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <h3 className="mt-6 mb-2 text-lg font-bold">Excerpt from the source</h3>
            {c.excerpt ? (
              <blockquote className="rounded-lg border-l-4 border-primary bg-muted p-4 whitespace-pre-line">{c.excerpt}</blockquote>
            ) : (
              <p className="text-muted-foreground">No excerpt was captured.</p>
            )}
          </Panel>

          <SuggestionsPanel
            candidateId={c.id}
            engine={c.suggestion_engine}
            hasSuggestions={hasSuggestions}
            locked={locked}
            summary={s.summary ?? null}
            category={suggestedCategory ? { name: suggestedCategory.name, confidence: s.category?.confidence ?? null, reason: s.category?.reason ?? null, accepted: suggestedCategory.id === c.suggested_category_id } : null}
            populations={popNames}
            org={org}
            cityAccepted={!!org?.city && org.city === c.possible_city}
            countyAccepted={!!org?.county && org.county === c.county_name}
            generatedAt={s.generated_at ?? null}
          />

          <Section title="Possible duplicates" description="Existing MittenLink listings that may describe the same resource, found by name similarity, website domain, and phone number.">
            {duplicates.length === 0 ? (
              <Panel>
                <p className="text-muted-foreground">No similar existing listings were found. Generate suggestions to run a fresh duplicate check.</p>
              </Panel>
            ) : (
              <ul className="flex flex-col gap-4">
                {duplicates.map((m) => (
                  <li key={m.listing_id}>
                    <DuplicateCard
                      match={m}
                      candidate={{ name: c.name, url: c.url, city: c.possible_city, county: c.county_name, phone: org?.phone ?? null }}
                      linked={m.listing_id === c.duplicate_listing_id}
                      candidateId={c.id}
                      locked={locked}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <InternalNotes entityType="candidate" entityId={c.id} revalidate={pathname} />
        </div>

        <aside className="flex flex-col gap-6" aria-label="Review actions">
          <Panel as="section">
            <h2 className="text-xl font-bold">Review decision</h2>
            {locked ? (
              <p className="mt-2">This candidate was imported as a pending draft record. Continue in the verification queue.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Decisions are made by staff. Suggestions never change the status on their own.</p>
                <div className="mt-4 flex flex-col gap-3">
                  {statusActions
                    .filter((a) => a.show)
                    .map((a) => (
                      <ActionButton key={a.status} action={setCandidateStatusAction} hidden={{ id: c.id, status: a.status }} label={a.label} variant={a.variant ?? "outline"} />
                    ))}
                </div>
              </>
            )}
          </Panel>

          {c.status === "approved_for_import" && (
            <Panel as="section">
              <h2 className="mb-3 text-xl font-bold">Import</h2>
              <ImportForm id={c.id} name={c.name} categories={categories} counties={counties} defaults={{ categoryId: c.suggested_category_id, countyId: c.possible_county_id }} />
            </Panel>
          )}
          {!locked && c.status !== "approved_for_import" && c.status !== "rejected" && (
            <Panel className="bg-muted text-sm">
              <p>
                <strong>Import</strong> becomes available after you approve this candidate for import.
              </p>
            </Panel>
          )}

          {!locked && (
            <Panel as="section">
              <h2 className="mb-3 text-xl font-bold">Review details</h2>
              <ReviewFieldsForm id={c.id} categories={categories} counties={counties} defaults={{ categoryId: c.suggested_category_id, city: c.possible_city, countyId: c.possible_county_id }} />
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}

function SuggestionsPanel({
  candidateId,
  engine,
  hasSuggestions,
  locked,
  summary,
  category,
  populations,
  org,
  cityAccepted,
  countyAccepted,
  generatedAt,
}: {
  candidateId: string;
  engine: string | null;
  hasSuggestions: boolean;
  locked: boolean;
  summary: string | null;
  category: { name: string; confidence: number | null; reason: string | null; accepted: boolean } | null;
  populations: string[];
  org: { phone: string | null; email?: string | null; address?: string | null; city: string | null; county: string | null; zip?: string | null; website?: string | null } | null;
  cityAccepted: boolean;
  countyAccepted: boolean;
  generatedAt: string | null;
}) {
  const ai = isModelEngine(engine);
  const accept = (field: string, text: string, accepted: boolean) =>
    locked ? null : accepted ? (
      <StatusPill tone="success" icon={<CheckCircle2 className="size-4" aria-hidden />}>
        Accepted
      </StatusPill>
    ) : (
      <ActionButton action={acceptSuggestionAction} hidden={{ id: candidateId, field }} label="Accept suggestion" size="sm" srContext={text} pendingLabel="Applying…" />
    );
  return (
    <Panel as="section" className="border-enhanced/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Sparkles className="size-5 text-enhanced" aria-hidden /> Suggestions
        </h2>
        {hasSuggestions && (
          <StatusPill tone={ai ? "enhanced" : "info"} icon={ai ? <Sparkles className="size-4" aria-hidden /> : <Info className="size-4" aria-hidden />} className="whitespace-normal">
            {suggestionLabel(engine)}
          </StatusPill>
        )}
      </div>
      <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Suggestions help staff review faster. They never verify, publish, import, or override a staff decision. Accepting a suggestion only copies the value into the review fields — importing still
          requires a human decision.
        </span>
      </p>

      {!hasSuggestions ? (
        <p className="mt-4">No suggestions yet for this candidate.</p>
      ) : (
        <dl className="mt-4 flex flex-col gap-4">
          <SuggestionRow term="Summary">{summary ?? <span className="text-muted-foreground">No summary suggested</span>}</SuggestionRow>
          <SuggestionRow term="Category" action={category ? accept("category", `category ${category.name}`, category.accepted) : null}>
            {category ? (
              <>
                {category.name}
                {category.confidence !== null && <span className="text-muted-foreground"> · {Math.round(category.confidence * 100)}% confidence</span>}
                {category.reason && <span className="block text-sm text-muted-foreground">{category.reason}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">No category suggested</span>
            )}
          </SuggestionRow>
          <SuggestionRow term="Populations served">{populations.length ? populations.join(", ") : <span className="text-muted-foreground">None suggested</span>}</SuggestionRow>
          <SuggestionRow term="City" action={org?.city ? accept("city", `city ${org.city}`, cityAccepted) : null}>
            {org?.city ?? <span className="text-muted-foreground">Not found</span>}
          </SuggestionRow>
          <SuggestionRow term="County" action={org?.county ? accept("county", `county ${org.county}`, countyAccepted) : null}>
            {org?.county ? `${org.county} County` : <span className="text-muted-foreground">Not found</span>}
          </SuggestionRow>
          <SuggestionRow term="Contact details found">
            {[org?.phone && `Phone: ${org.phone}`, org?.email && `Email: ${org.email}`, org?.address && `Address: ${org.address}`, org?.zip && `ZIP: ${org.zip}`, org?.website && `Website: ${hostname(org.website)}`]
              .filter(Boolean)
              .join(" · ") || <span className="text-muted-foreground">None found</span>}
          </SuggestionRow>
        </dl>
      )}
      {generatedAt && <p className="mt-3 text-sm text-muted-foreground">Generated {formatDateTime(generatedAt)}</p>}
      {!locked && (
        <div className="mt-4 border-t pt-4">
          <ActionButton
            action={generateSuggestionsAction}
            hidden={{ id: candidateId }}
            label={hasSuggestions ? "Refresh Suggestions" : "Generate Suggestions"}
            pendingLabel="Generating suggestions…"
          />
        </div>
      )}
    </Panel>
  );
}

function SuggestionRow({ term, children, action }: { term: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-b pb-3 last:border-b-0">
      <dt className="font-semibold">{term}</dt>
      <dd className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </dd>
    </div>
  );
}

function DuplicateCard({
  match: m,
  candidate,
  linked,
  candidateId,
  locked,
}: {
  match: DuplicateMatch;
  candidate: { name: string; url: string | null; city: string | null; county: string | null; phone: string | null };
  linked: boolean;
  candidateId: string;
  locked: boolean;
}) {
  const rows: [string, string | null, string | null][] = [
    ["Name", candidate.name, m.title],
    ["Website", hostname(candidate.url), hostname(m.website)],
    ["Phone", candidate.phone, m.phone],
    ["City", candidate.city, m.city],
    ["County", candidate.county ? `${candidate.county} County` : null, m.county ? `${m.county} County` : null],
  ];
  return (
    <article className="rounded-xl border bg-card p-5" aria-labelledby={`dup-${m.listing_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`dup-${m.listing_id}`} className="text-lg font-bold">
            <Link href={adminListingHref(m.kind, m.listing_id)} className="text-primary underline">
              {m.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            Existing {label(KIND_LABELS, m.kind).toLowerCase()} · {m.publication_status === "published" ? "Published" : `Not public (${m.publication_status})`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DuplicateConfidence value={m.confidence} />
          <VerificationBadge status={m.verification_status} />
        </div>
      </div>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Side-by-side comparison of this candidate and {m.title}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-3">Field</th>
            <th scope="col" className="py-2 pr-3">This candidate</th>
            <th scope="col" className="py-2">Existing listing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([f, a, b]) => {
            const same = !!a && !!b && a.toLowerCase() === b.toLowerCase();
            return (
              <tr key={f} className="border-b align-top last:border-b-0">
                <th scope="row" className="py-2 pr-3 font-semibold">{f}</th>
                <td className="py-2 pr-3 break-words">{a ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="py-2 break-words">
                  {b ?? <span className="text-muted-foreground">—</span>}
                  {same && <span className="ml-2 font-semibold text-warning">(match)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {linked ? (
          <StatusPill tone="warning">Linked as likely existing listing</StatusPill>
        ) : (
          !locked && <ActionButton action={acceptSuggestionAction} hidden={{ id: candidateId, field: "duplicate", listingId: m.listing_id }} label="Link as Likely Duplicate" size="sm" srContext={`: ${m.title}`} />
        )}
        <Link href={adminListingHref(m.kind, m.listing_id)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Open existing listing<span className="sr-only">: {m.title}</span>
        </Link>
      </div>
    </article>
  );
}
